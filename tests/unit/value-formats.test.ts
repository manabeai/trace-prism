import { describe, expect, it } from 'vitest';
import { formatOptions } from '../../src/presentations/values/registry';
import type { Column, Frame, Value } from '../../src/trace/types';
import { seqId } from '../../src/trace/ids';

function options(value: Value): string[] {
  const column: Column = { name: 'x', kind: value.t };
  const frame: Frame = {
    seq: seqId('0'),
    span: [],
    source: 'test.rs:1',
    changed: ['x'],
    values: { x: { name: 'x', value } },
  };
  return formatOptions(column, [frame]).map((option) => option.id);
}

describe('value formats', () => {
  it('offers formats based on observed shape without inventing graph semantics for nested arrays', () => {
    expect(
      options({
        t: 'array',
        items: [
          { t: 'int', v: '1' },
          { t: 'int', v: '2' },
        ],
      }),
    ).toEqual(['cells', 'bars', 'text']);
    expect(options({ t: 'array', items: [{ t: 'array', items: [{ t: 'int', v: '1' }] }] })).toEqual([
      'matrix',
      'text',
    ]);
    expect(options({ t: 'set', items: [] })).toEqual(['cells', 'count', 'text']);
    expect(options({ t: 'map', entries: [] })).toEqual(['entries', 'count', 'text']);
  });
});
