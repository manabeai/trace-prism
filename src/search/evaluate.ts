import type { ValuePath } from '../trace/diff';
import type { Seq } from '../trace/ids';
import type { Frame, Value } from '../trace/types';
import { normalize, isComplete, type Clause, type Query } from './model';
import { predicates } from './predicates';
import { projectValue } from './projections';

export type FrameMatch = { seq: Seq; fields: ReadonlyMap<string, readonly ValuePath[]> };
export type SearchResults = { active: boolean; hits: readonly Seq[]; bySeq: ReadonlyMap<Seq, FrameMatch> };
const root: ValuePath = [];

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
  const predicate = predicates[clause.predicate];
  const left = predicate.input === 'source' ? source : projectValue(source, clause.projection);
  if (!left) return null;
  return predicate.match({
    left,
    right: operandValue(clause, frame),
    frame,
    fieldName: clause.field.name,
    hasPrevious,
  });
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
