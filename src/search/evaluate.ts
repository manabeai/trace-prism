import type { ValuePath } from '../trace/diff';
import { diffValues } from '../trace/diff';
import type { Seq } from '../trace/ids';
import type { Frame, Value } from '../trace/types';
import { normalize, isComplete, type Clause, type Query } from './model';

export type FrameMatch = { seq: Seq; fields: ReadonlyMap<string, readonly ValuePath[]> };
export type SearchResults = { active: boolean; hits: readonly Seq[]; bySeq: ReadonlyMap<Seq, FrameMatch> };
const root: ValuePath = [];

function equal(left: Value, right: Value): boolean {
  return diffValues(left, right).length === 0;
}

function numeric(value: Value): number | bigint | undefined {
  if (value.t === 'int') {
    try {
      return BigInt(value.v);
    } catch {
      return undefined;
    }
  }
  if (value.t === 'float') {
    const number = Number(value.v);
    return Number.isNaN(number) ? undefined : number;
  }
}

function compare(left: Value, right: Value): number | undefined {
  const a = numeric(left),
    b = numeric(right);
  if (a !== undefined && b !== undefined) return a < b ? -1 : a > b ? 1 : 0;
  if (left.t === 'string' && right.t === 'string') return left.v < right.v ? -1 : left.v > right.v ? 1 : 0;
  if (left.t === 'bool' && right.t === 'bool') return Number(left.v) - Number(right.v);
  if (left.t === 'array' && right.t === 'array') {
    for (let index = 0; index < Math.min(left.items.length, right.items.length); index++) {
      const result = compare(left.items[index], right.items[index]);
      if (result === undefined) return undefined;
      if (result !== 0) return result;
    }
    return Math.sign(left.items.length - right.items.length);
  }
}

function project(value: Value, clause: Clause): Value | undefined {
  if (!clause.projection) return value;
  if (clause.projection === 'size') {
    const size =
      value.t === 'string'
        ? [...value.v].length
        : value.t === 'array' || value.t === 'set'
          ? value.items.length
          : value.t === 'map'
            ? value.entries.length
            : undefined;
    return size === undefined ? undefined : { t: 'int', v: String(size) };
  }
  if (value.t !== 'array') return undefined;
  const numbers = value.items.map(numeric);
  if (!numbers.length || numbers.some((number) => number === undefined)) return undefined;
  if (clause.projection === 'sum') {
    if (value.items.every((item) => item.t === 'int'))
      return {
        t: 'int',
        v: (numbers as bigint[]).reduce((sum, number) => sum + number, 0n).toString(),
      };
    return { t: 'float', v: String(numbers.reduce((sum, number) => Number(sum) + Number(number), 0)) };
  }
  return value.items.reduce((best, item) => {
    const result = compare(item, best);
    return result !== undefined && (clause.projection === 'min' ? result < 0 : result > 0) ? item : best;
  });
}

function operandValue(clause: Clause, frame: Frame): Value | undefined {
  return clause.operand?.kind === 'literal'
    ? clause.operand.value
    : clause.operand?.kind === 'field'
      ? frame.values[clause.operand.name]?.value
      : undefined;
}

function matchClause(clause: Clause, frame: Frame, hasPrevious: boolean): ValuePath[] | null {
  const source = frame.values[clause.field.name]?.value;
  if (!source || !clause.predicate) return null;
  if (clause.predicate === 'changed') {
    if (!hasPrevious) return null;
    const paths = frame.deltas[clause.field.name]?.map((change) => change.path) ?? [];
    return paths.length ? paths : null;
  }
  const left = project(source, clause);
  if (!left) return null;
  if (clause.predicate === 'is true') return left.t === 'bool' && left.v ? [root] : null;
  if (clause.predicate === 'is false') return left.t === 'bool' && !left.v ? [root] : null;
  if (clause.predicate === 'is null') return left.t === 'null' ? [root] : null;
  const right = operandValue(clause, frame);
  if (!right) return null;
  if (clause.predicate === '==') return equal(left, right) ? [root] : null;
  if (clause.predicate === '!=') return equal(left, right) ? null : [root];
  if (['<', '<=', '>', '>='].includes(clause.predicate)) {
    const result = compare(left, right);
    if (result === undefined) return null;
    return (clause.predicate === '<' && result < 0) ||
      (clause.predicate === '<=' && result <= 0) ||
      (clause.predicate === '>' && result > 0) ||
      (clause.predicate === '>=' && result >= 0)
      ? [root]
      : null;
  }
  if (clause.predicate === 'contains') {
    if (left.t === 'string' && right.t === 'string')
      return normalize(left.v).includes(normalize(right.v)) ? [root] : null;
    if (left.t === 'array') {
      const paths = left.items.flatMap((item, index): ValuePath[] =>
        equal(item, right) ? [[{ kind: 'index', index }]] : [],
      );
      return paths.length ? paths : null;
    }
    if (left.t === 'set') {
      const paths = left.items.flatMap((item): ValuePath[] =>
        equal(item, right) ? [[{ kind: 'member', value: item }]] : [],
      );
      return paths.length ? paths : null;
    }
  }
  if (clause.predicate === 'startsWith' && left.t === 'string' && right.t === 'string')
    return normalize(left.v).startsWith(normalize(right.v)) ? [root] : null;
  if (clause.predicate === 'endsWith' && left.t === 'string' && right.t === 'string')
    return normalize(left.v).endsWith(normalize(right.v)) ? [root] : null;
  if (clause.predicate === 'hasKey' && left.t === 'map') {
    const matches = left.entries.filter((entry) => equal(entry.key, right));
    return matches.length ? matches.map((entry): ValuePath => [{ kind: 'key', key: entry.key }]) : null;
  }
  if (
    (clause.predicate === 'subsetOf' || clause.predicate === 'supersetOf') &&
    left.t === 'set' &&
    right.t === 'set'
  ) {
    const a = clause.predicate === 'subsetOf' ? left.items : right.items;
    const b = clause.predicate === 'subsetOf' ? right.items : left.items;
    return a.length < b.length && a.every((item) => b.some((member) => equal(item, member))) ? [root] : null;
  }
  return null;
}

function freeTextPaths(value: Value, needle: string, path: ValuePath = []): ValuePath[] {
  if (value.t === 'array')
    return value.items.flatMap((item, index) =>
      freeTextPaths(item, needle, [...path, { kind: 'index', index }]),
    );
  if (value.t === 'set')
    return value.items.flatMap((item) =>
      freeTextPaths(item, needle, [...path, { kind: 'member', value: item }]),
    );
  if (value.t === 'map')
    return value.entries.flatMap((entry) => {
      const child = [...path, { kind: 'key' as const, key: entry.key }];
      return [
        ...(normalize(String(entry.key.t === 'null' ? 'null' : entry.key.v)).includes(needle) ? [child] : []),
        ...freeTextPaths(entry.value, needle, child),
      ];
    });
  if (value.t === 'record')
    return value.fields.flatMap((field) => {
      const child = [...path, { kind: 'field' as const, name: field.name }];
      return [
        ...(normalize(field.name).includes(needle) ? [child] : []),
        ...freeTextPaths(field.value, needle, child),
      ];
    });
  const text = value.t === 'null' ? 'null' : String(value.v);
  return normalize(text).includes(needle) ? [path] : [];
}

function addPaths(target: Map<string, ValuePath[]>, name: string, paths: ValuePath[]) {
  target.set(name, [...(target.get(name) ?? []), ...paths]);
}

export function evaluateSearch(frames: readonly Frame[], query: Query, text: string): SearchResults {
  const structured = isComplete(query);
  const needle = query.clauses.length ? '' : normalize(text.trim());
  if (!structured && !needle) return { active: false, hits: [], bySeq: new Map() };
  const bySeq = new Map<Seq, FrameMatch>();
  const hits: Seq[] = [];
  for (const [frameIndex, frame] of frames.entries()) {
    const fields = new Map<string, ValuePath[]>();
    if (structured) {
      const clauses = query.clauses.map((clause) => matchClause(clause, frame, frameIndex > 0));
      let matched = Boolean(clauses[0]);
      for (let index = 1; index < clauses.length; index++)
        matched =
          query.connectors[index - 1] === 'or'
            ? matched || Boolean(clauses[index])
            : matched && Boolean(clauses[index]);
      if (matched)
        query.clauses.forEach((clause, index) => {
          if (clauses[index]) addPaths(fields, clause.field.name, clauses[index]!);
        });
    } else if (!query.clauses.length) {
      for (const [name, field] of Object.entries(frame.values)) {
        const paths = normalize(name).includes(needle) ? [root] : freeTextPaths(field.value, needle);
        if (paths.length) addPaths(fields, name, paths);
      }
    }
    if (fields.size) {
      hits.push(frame.seq);
      bySeq.set(frame.seq, { seq: frame.seq, fields });
    }
  }
  return { active: true, hits, bySeq };
}
