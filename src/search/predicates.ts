import type { ValuePath } from '../trace/diff';
import type { Frame, Value } from '../trace/types';
import type { Candidate, Predicate, Shape } from './model';
import { normalize } from './normalize';
import { compare, equal } from './value-operations';

type MatchContext = {
  left: Value;
  right?: Value;
  frame: Frame;
  fieldName: string;
  hasPrevious: boolean;
};

type PredicateDefinition = {
  detail: (shape: Shape) => string;
  appliesTo: (shape: Shape) => boolean;
  order: number;
  input?: 'source';
  operandShape?: (shape: Shape) => Shape;
  match: (context: MatchContext) => ValuePath[] | null;
};

const root: ValuePath = [];
const hit = (matches: boolean): ValuePath[] | null => (matches ? [root] : null);
const any = () => true;
const equalityShape = (shape: Shape) => shape.kind !== 'null';
const orderable = (shape: Shape) => ['int', 'float', 'string', 'char', 'bool'].includes(shape.kind);
const orderedShape = (shape: Shape) =>
  shape.kind === 'int' || shape.kind === 'float' || (shape.kind === 'array' && orderable(shape.item));
const operand = (shape: Shape) => shape;
const withRight =
  (match: (left: Value, right: Value) => ValuePath[] | null) =>
  ({ left, right }: MatchContext) =>
    right ? match(left, right) : null;

function orderPredicate(
  detail: string,
  order: number,
  matches: (result: number) => boolean,
): PredicateDefinition {
  return {
    detail: (shape) => (shape.kind === 'array' ? `Lexicographically ${detail.toLowerCase()}` : detail),
    appliesTo: orderedShape,
    order,
    operandShape: operand,
    match: withRight((left, right) => {
      const result = compare(left, right);
      return result === undefined ? null : hit(matches(result));
    }),
  };
}

export const predicates: Record<Predicate, PredicateDefinition> = {
  '<': orderPredicate('Less than', 20, (result) => result < 0),
  '<=': orderPredicate('Less than or equal', 21, (result) => result <= 0),
  '>': orderPredicate('Greater than', 22, (result) => result > 0),
  '>=': orderPredicate('Greater than or equal', 23, (result) => result >= 0),
  '==': {
    detail: () => 'Equals',
    appliesTo: equalityShape,
    order: 30,
    operandShape: operand,
    match: withRight((left, right) => hit(equal(left, right))),
  },
  '!=': {
    detail: () => 'Does not equal',
    appliesTo: equalityShape,
    order: 31,
    operandShape: operand,
    match: withRight((left, right) => hit(!equal(left, right))),
  },
  contains: {
    detail: (shape) =>
      shape.kind === 'string'
        ? 'Contains text'
        : shape.kind === 'set'
          ? 'Contains a member'
          : 'Contains an element',
    appliesTo: (shape) => ['string', 'array', 'set'].includes(shape.kind),
    order: 10,
    operandShape: (shape) =>
      shape.kind === 'array' || shape.kind === 'set' ? shape.item : { kind: 'string' },
    match: withRight((left, right) => {
      if (left.t === 'string' && right.t === 'string')
        return hit(normalize(left.v).includes(normalize(right.v)));
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
      return null;
    }),
  },
  startsWith: {
    detail: () => 'Starts with text',
    appliesTo: (shape) => shape.kind === 'string',
    order: 11,
    operandShape: operand,
    match: withRight((left, right) =>
      left.t === 'string' && right.t === 'string'
        ? hit(normalize(left.v).startsWith(normalize(right.v)))
        : null,
    ),
  },
  endsWith: {
    detail: () => 'Ends with text',
    appliesTo: (shape) => shape.kind === 'string',
    order: 12,
    operandShape: operand,
    match: withRight((left, right) =>
      left.t === 'string' && right.t === 'string'
        ? hit(normalize(left.v).endsWith(normalize(right.v)))
        : null,
    ),
  },
  subsetOf: {
    detail: () => 'Proper subset of',
    appliesTo: (shape) => shape.kind === 'set',
    order: 11,
    operandShape: operand,
    match: withRight((left, right) => {
      if (left.t !== 'set' || right.t !== 'set') return null;
      return hit(
        left.items.length < right.items.length &&
          left.items.every((item) => right.items.some((member) => equal(item, member))),
      );
    }),
  },
  supersetOf: {
    detail: () => 'Proper superset of',
    appliesTo: (shape) => shape.kind === 'set',
    order: 12,
    operandShape: operand,
    match: withRight((left, right) => {
      if (left.t !== 'set' || right.t !== 'set') return null;
      return hit(
        right.items.length < left.items.length &&
          right.items.every((item) => left.items.some((member) => equal(item, member))),
      );
    }),
  },
  hasKey: {
    detail: () => 'Contains a key',
    appliesTo: (shape) => shape.kind === 'map',
    order: 10,
    operandShape: (shape) => (shape.kind === 'map' ? shape.key : shape),
    match: withRight((left, right) => {
      if (left.t !== 'map') return null;
      const matches = left.entries.filter((entry) => equal(entry.key, right));
      return matches.length ? matches.map((entry): ValuePath => [{ kind: 'key', key: entry.key }]) : null;
    }),
  },
  changed: {
    detail: () => 'Changed at this seq',
    appliesTo: any,
    order: 100,
    input: 'source',
    match: ({ frame, fieldName, hasPrevious }) => {
      if (!hasPrevious) return null;
      const paths = frame.deltas[fieldName]?.map((change) => change.path) ?? [];
      return paths.length ? paths : null;
    },
  },
  'is true': {
    detail: () => 'Value is true',
    appliesTo: (shape) => shape.kind === 'bool',
    order: 10,
    match: ({ left }) => hit(left.t === 'bool' && left.v),
  },
  'is false': {
    detail: () => 'Value is false',
    appliesTo: (shape) => shape.kind === 'bool',
    order: 11,
    match: ({ left }) => hit(left.t === 'bool' && !left.v),
  },
  'is null': {
    detail: () => 'Value is null',
    appliesTo: (shape) => shape.kind === 'null',
    order: 10,
    match: ({ left }) => hit(left.t === 'null'),
  },
};

export function predicateCandidatesFor(shape: Shape, nullable = false): Candidate[] {
  const available = Object.entries(predicates)
    .filter(
      ([key, definition]) => definition.appliesTo(shape) && !(key === 'is null' && shape.kind !== 'null'),
    )
    .sort(([, left], [, right]) => left.order - right.order)
    .map(([key, definition]): Candidate => ({
      kind: 'predicate',
      key,
      label: key,
      detail: definition.detail(shape),
      type: definition.operandShape?.(shape),
    }));
  if (nullable && shape.kind !== 'null') {
    const definition = predicates['is null'];
    available.push({ kind: 'predicate', key: 'is null', label: 'is null', detail: definition.detail(shape) });
  }
  return available;
}
