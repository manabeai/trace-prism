import type { Column, Frame, Value } from '../trace/types';

export type Shape =
  | { kind: 'int' | 'float' | 'bool' | 'string' | 'char' | 'null' | 'unknown' }
  | { kind: 'array' | 'set'; item: Shape }
  | { kind: 'map'; key: Shape; value: Shape }
  | { kind: 'record'; fields: { name: string; shape: Shape }[] };

export type SearchField = { name: string; shape: Shape; sample?: Value; nullable?: boolean };
export type Projection = 'sum' | 'size' | 'min' | 'max';
export type Predicate =
  | '<'
  | '<='
  | '>'
  | '>='
  | '=='
  | '!='
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'subsetOf'
  | 'supersetOf'
  | 'hasKey'
  | 'changed'
  | 'is true'
  | 'is false'
  | 'is null';
export type Operand = { kind: 'literal'; source: string; value: Value } | { kind: 'field'; name: string };
export type Clause = {
  field: SearchField;
  projection?: Projection;
  predicate?: Predicate;
  operand?: Operand;
};
export type Query = { clauses: Clause[]; connectors: ('and' | 'or')[] };
export type Stage = 'field' | 'operation' | 'predicate' | 'operand' | 'complete';
export type Candidate = {
  kind: 'field' | 'projection' | 'predicate' | 'literal' | 'reference' | 'connector';
  key: string;
  label: string;
  detail: string;
  type?: Shape;
};

export const emptyQuery = (): Query => ({ clauses: [], connectors: [] });
export const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase();

export function shapeOf(value: Value, sourceType?: string): Shape {
  if (value.t === 'string') return { kind: /\bchar\b/i.test(sourceType ?? '') ? 'char' : 'string' };
  if (value.t === 'array' || value.t === 'set')
    return { kind: value.t, item: value.items.length ? shapeOf(value.items[0]) : { kind: 'unknown' } };
  if (value.t === 'map')
    return {
      kind: 'map',
      key: value.entries.length ? shapeOf(value.entries[0].key) : { kind: 'unknown' },
      value: value.entries.length ? shapeOf(value.entries[0].value) : { kind: 'unknown' },
    };
  if (value.t === 'record')
    return {
      kind: 'record',
      fields: value.fields.map((field) => ({
        name: field.name,
        shape: shapeOf(field.value, field.sourceType),
      })),
    };
  return { kind: value.t };
}

export function searchFields(columns: readonly Column[], frames: readonly Frame[]): SearchField[] {
  return columns.map((column) => {
    const observed = frames
      .map((frame) => frame.values[column.name]?.value)
      .filter((value): value is Value => value !== undefined);
    const sample =
      observed.find((value) => {
        if (value.t === 'null') return false;
        if (value.t === 'array' || value.t === 'set') return value.items.length > 0;
        if (value.t === 'map') return value.entries.length > 0;
        if (value.t === 'record') return value.fields.length > 0;
        return true;
      }) ??
      observed.find((value) => value.t !== 'null') ??
      observed[0];
    return {
      name: column.name,
      shape: sample ? shapeOf(sample, column.sourceType) : { kind: 'unknown' },
      sample,
      nullable: observed.some((value) => value.t === 'null'),
    };
  });
}

export function sameShape(left: Shape, right: Shape): boolean {
  if (left.kind === 'unknown' || right.kind === 'unknown') return true;
  if (left.kind !== right.kind) return false;
  if (left.kind === 'array' || left.kind === 'set')
    return (right.kind === 'array' || right.kind === 'set') && sameShape(left.item, right.item);
  if (left.kind === 'map' && right.kind === 'map')
    return sameShape(left.key, right.key) && sameShape(left.value, right.value);
  if (left.kind === 'record' && right.kind === 'record')
    return (
      left.fields.length === right.fields.length &&
      left.fields.every((field) => {
        const other = right.fields.find((candidate) => candidate.name === field.name);
        return Boolean(other && sameShape(field.shape, other.shape));
      })
    );
  return true;
}

export function shapeLabel(shape: Shape): string {
  if (shape.kind === 'array') return `Vec<${shapeLabel(shape.item)}>`;
  if (shape.kind === 'set') return `Set<${shapeLabel(shape.item)}>`;
  if (shape.kind === 'map') return `Map<${shapeLabel(shape.key)}, ${shapeLabel(shape.value)}>`;
  if (shape.kind === 'record') return 'record';
  if (shape.kind === 'unknown') return 'value';
  return shape.kind === 'string' ? 'String' : shape.kind;
}

export function projectedShape(clause: Clause): Shape {
  if (!clause.projection) return clause.field.shape;
  if (clause.projection === 'size') return { kind: 'int' };
  if (clause.field.shape.kind === 'array') return clause.field.shape.item;
  return { kind: 'unknown' };
}

export function operandShape(clause: Clause): Shape {
  const shape = projectedShape(clause);
  if (clause.predicate === 'contains')
    return shape.kind === 'array' || shape.kind === 'set' ? shape.item : { kind: 'string' };
  if (clause.predicate === 'hasKey' && shape.kind === 'map') return shape.key;
  return shape;
}

export function stageOf(query: Query): Stage {
  if (query.connectors.length === query.clauses.length && query.clauses.length) return 'field';
  const clause = query.clauses.at(-1);
  if (!clause) return 'field';
  if (!clause.predicate) return clause.projection ? 'predicate' : 'operation';
  if (['changed', 'is true', 'is false', 'is null'].includes(clause.predicate)) return 'complete';
  return clause.operand ? 'complete' : 'operand';
}

export function isComplete(query: Query): boolean {
  return (
    query.clauses.length > 0 &&
    query.connectors.length === query.clauses.length - 1 &&
    stageOf(query) === 'complete'
  );
}

export function parseLiteral(shape: Shape, input: string): Value | undefined {
  const text = input.trim();
  if (shape.kind === 'int') return /^-?\d+$/.test(text) ? { t: 'int', v: text } : undefined;
  if (shape.kind === 'float')
    return /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? { t: 'float', v: text } : undefined;
  if (shape.kind === 'bool')
    return /^(true|false)$/i.test(text) ? { t: 'bool', v: normalize(text) === 'true' } : undefined;
  if (shape.kind === 'null') return text === 'null' ? { t: 'null' } : undefined;
  if (shape.kind === 'string' || shape.kind === 'char') {
    if (!text) return undefined;
    let value = text;
    if (text.startsWith('"') || text.endsWith('"')) {
      if (!(text.startsWith('"') && text.endsWith('"') && text.length >= 2)) return undefined;
      try {
        value = JSON.parse(text) as string;
      } catch {
        return undefined;
      }
    } else if (text.startsWith("'") || text.endsWith("'")) {
      if (!(text.startsWith("'") && text.endsWith("'") && text.length >= 2)) return undefined;
      value = text.slice(1, -1);
    }
    if (shape.kind === 'char' && [...value].length !== 1) return undefined;
    return { t: 'string', v: value };
  }
  if (
    (shape.kind === 'array' || shape.kind === 'set') &&
    (shape.item.kind === 'int' || shape.item.kind === 'float')
  ) {
    const open = shape.kind === 'array' ? '[' : '{';
    const close = shape.kind === 'array' ? ']' : '}';
    if (!text.startsWith(open) || !text.endsWith(close)) return undefined;
    const body = text.slice(1, -1).trim();
    const items = body ? body.split(',').map((part) => parseLiteral(shape.item, part)) : [];
    if (items.some((item) => item === undefined)) return undefined;
    return { t: shape.kind, items: items as Value[] };
  }
}

export function operandText(operand: Operand): string {
  return operand.kind === 'field' ? `@${operand.name}` : operand.source;
}

export function serializeQuery(query: Query): string {
  return query.clauses
    .map((clause, index) =>
      [
        index ? query.connectors[index - 1] : '',
        clause.field.name,
        clause.projection ?? '',
        clause.predicate ?? '',
        clause.operand ? operandText(clause.operand) : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ');
}
