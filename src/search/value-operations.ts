import { diffValues } from '../trace/diff';
import type { Value } from '../trace/types';

export function equal(left: Value, right: Value): boolean {
  return diffValues(left, right).length === 0;
}

export function numeric(value: Value): number | bigint | undefined {
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

export function compare(left: Value, right: Value): number | undefined {
  const a = numeric(left);
  const b = numeric(right);
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
