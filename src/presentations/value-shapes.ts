import type { Value } from '../trace/types';

export const isNumericArray = (value: Value): value is Value & { t: 'array' } =>
  value.t === 'array' && value.items.every((item) => item.t === 'int' || item.t === 'float');

export const isBooleanArray = (value: Value): value is Value & { t: 'array' } =>
  value.t === 'array' && value.items.every((item) => item.t === 'bool');

export const isIntegerSet = (value: Value): value is Value & { t: 'set' } =>
  value.t === 'set' && value.items.every((item) => item.t === 'int');

export const isMatrix = (value: Value): value is Value & { t: 'array' } =>
  value.t === 'array' &&
  value.items.length > 0 &&
  value.items.every(
    (item) =>
      item.t === 'array' &&
      item.items.every((cell) => cell.t === 'int' || cell.t === 'float' || cell.t === 'bool'),
  );

export const isPosition = (value: Value): value is Value & { t: 'array' } =>
  value.t === 'array' && value.items.length === 2 && value.items.every((item) => item.t === 'int');

export const numberOf = (value?: Value): number =>
  value && (value.t === 'int' || value.t === 'float') ? Number(value.v) : NaN;
