import type { Value } from '../trace/types';
import type { Candidate, Projection, Shape } from './model';
import { compare, numeric } from './value-operations';

type ProjectionDefinition = {
  detail: (shape: Shape) => string;
  appliesTo: (shape: Shape) => boolean;
  resultShape: (shape: Shape) => Shape;
  evaluate: (value: Value) => Value | undefined;
};

const int: Shape = { kind: 'int' };
const arrayItem = (shape: Shape): Shape => (shape.kind === 'array' ? shape.item : { kind: 'unknown' });
const numericArray = (shape: Shape) =>
  shape.kind === 'array' && (shape.item.kind === 'int' || shape.item.kind === 'float');
const sizeOf = (value: Value): number | undefined => {
  if (value.t === 'string') return [...value.v].length;
  if (value.t === 'array' || value.t === 'set') return value.items.length;
  if (value.t === 'map') return value.entries.length;
};

function extreme(value: Value, direction: 'min' | 'max'): Value | undefined {
  if (value.t !== 'array' || !value.items.length || value.items.some((item) => numeric(item) === undefined))
    return undefined;
  return value.items.reduce((best, item) => {
    const result = compare(item, best);
    return result !== undefined && (direction === 'min' ? result < 0 : result > 0) ? item : best;
  });
}

export const projections: Record<Projection, ProjectionDefinition> = {
  size: {
    detail: (shape) =>
      shape.kind === 'string'
        ? 'Number of characters'
        : shape.kind === 'array'
          ? 'Number of elements'
          : 'Number of entries',
    appliesTo: (shape) => ['array', 'set', 'map', 'string'].includes(shape.kind),
    resultShape: () => int,
    evaluate: (value) => {
      const size = sizeOf(value);
      return size === undefined ? undefined : { t: 'int', v: String(size) };
    },
  },
  sum: {
    detail: () => 'Sum of elements',
    appliesTo: numericArray,
    resultShape: arrayItem,
    evaluate: (value) => {
      if (value.t !== 'array') return undefined;
      const numbers = value.items.map(numeric);
      if (!numbers.length || numbers.some((number) => number === undefined)) return undefined;
      if (value.items.every((item) => item.t === 'int'))
        return { t: 'int', v: (numbers as bigint[]).reduce((sum, number) => sum + number, 0n).toString() };
      return { t: 'float', v: String(numbers.reduce((sum, number) => Number(sum) + Number(number), 0)) };
    },
  },
  min: {
    detail: () => 'Smallest element',
    appliesTo: numericArray,
    resultShape: arrayItem,
    evaluate: (value) => extreme(value, 'min'),
  },
  max: {
    detail: () => 'Largest element',
    appliesTo: numericArray,
    resultShape: arrayItem,
    evaluate: (value) => extreme(value, 'max'),
  },
};

export function projectionCandidatesFor(shape: Shape): Candidate[] {
  return Object.entries(projections).flatMap(([key, definition]): Candidate[] =>
    definition.appliesTo(shape)
      ? [
          {
            kind: 'projection',
            key,
            label: key,
            detail: definition.detail(shape),
            type: definition.resultShape(shape),
          },
        ]
      : [],
  );
}

export function projectValue(value: Value, projection?: Projection): Value | undefined {
  return projection ? projections[projection].evaluate(value) : value;
}
