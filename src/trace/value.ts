import type { Scalar, Value } from './types';
import { spanId } from './ids';

export const scalarText = (value: Scalar) =>
  value.t === 'string' ? JSON.stringify(value.v) : String(value.v);
export const spanText = (span: Scalar[]) => `[${span.map(scalarText).join(', ')}]`;
export const spanKey = (span: Scalar[]) => spanId(JSON.stringify(span));

export function legacyValue(input: unknown): Value {
  if (input === null) return { t: 'null' };
  if (typeof input === 'boolean') return { t: 'bool', v: input };
  if (typeof input === 'number') return { t: Number.isInteger(input) ? 'int' : 'float', v: String(input) };
  if (typeof input === 'string') return { t: 'string', v: input };
  if (Array.isArray(input)) return { t: 'array', items: input.map(legacyValue) };
  if (typeof input === 'object' && input && 't' in input) return input as Value;
  if (typeof input === 'object' && input)
    return {
      t: 'record',
      fields: Object.entries(input).map(([name, value]) => ({ name, value: legacyValue(value) })),
    };
  return { t: 'string', v: String(input) };
}

export function valueText(value: Value): string {
  switch (value.t) {
    case 'null':
      return 'null';
    case 'bool':
    case 'int':
    case 'float':
      return String(value.v);
    case 'string':
      return JSON.stringify(value.v);
    case 'array':
      return `[${value.items.map(valueText).join(', ')}]`;
    case 'set':
      return `{${value.items.map(valueText).join(', ')}}`;
    case 'map':
      return `{${value.entries.map((entry) => `${valueText(entry.key)}: ${valueText(entry.value)}`).join(', ')}}`;
    case 'record':
      return `{${value.fields.map((field) => `${field.name}: ${valueText(field.value)}`).join(', ')}}`;
  }
}
