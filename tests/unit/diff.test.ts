import { describe, expect, it } from 'vitest';
import { changesAffectPath, diffValues, framesWithChangeAt } from '../../src/trace/diff';
import { materialize } from '../../src/trace/materialize';
import type { TraceRecord, Value } from '../../src/trace/types';

const int = (v: string): Value => ({ t: 'int', v });
const base = (seq: string): Pick<TraceRecord, 'format' | 'runId' | 'seq' | 'span'> => ({
  format: 'viz.trace/v2',
  runId: 'run-1',
  seq,
  span: [],
});

describe('typed value differences', () => {
  it('keeps nested array changes queryable by element path and chronological seq', () => {
    const records: TraceRecord[] = [
      {
        ...base('0'),
        kind: 'snapshot',
        values: [
          { name: 'board', value: { t: 'array', items: [{ t: 'array', items: [int('1'), int('2')] }] } },
        ],
      },
      {
        ...base('1'),
        kind: 'patch',
        ops: [
          {
            op: 'put',
            name: 'board',
            value: { t: 'array', items: [{ t: 'array', items: [int('1'), int('3')] }] },
          },
        ],
      },
      {
        ...base('2'),
        from: '0',
        kind: 'patch',
        ops: [
          {
            op: 'put',
            name: 'board',
            value: { t: 'array', items: [{ t: 'array', items: [int('1'), int('3')] }] },
          },
        ],
      },
      {
        ...base('3'),
        kind: 'patch',
        ops: [
          {
            op: 'put',
            name: 'board',
            value: { t: 'array', items: [{ t: 'array', items: [int('4'), int('3')] }] },
          },
        ],
      },
    ];
    const { frames } = materialize(records);
    expect(frames[1].deltas.board).toEqual([
      {
        kind: 'updated',
        path: [
          { kind: 'index', index: 0 },
          { kind: 'index', index: 1 },
        ],
        before: int('2'),
        after: int('3'),
      },
    ]);
    expect(frames[2].changed).toEqual([]);
    expect(frames[2].deltas).toEqual({});
    expect(
      framesWithChangeAt(frames, 'board', [
        { kind: 'index', index: 0 },
        { kind: 'index', index: 1 },
      ]).map((f) => f.seq),
    ).toEqual(['0', '1']);
    expect(
      framesWithChangeAt(frames.slice(1), 'board', [
        { kind: 'index', index: 0 },
        { kind: 'index', index: 0 },
      ]).map((f) => f.seq),
    ).toEqual(['3']);
    expect(changesAffectPath(frames[1].deltas.board, [{ kind: 'index', index: 0 }])).toBe(true);
    expect(changesAffectPath(frames[1].deltas.board, [{ kind: 'index', index: 1 }])).toBe(false);
  });

  it('ignores collection order and compares set members and map keys by typed identity', () => {
    const one = int('1');
    const textOne: Value = { t: 'string', v: '1' };
    const before: Value = { t: 'set', items: [one, textOne] };
    expect(diffValues(before, { t: 'set', items: [textOne, one] })).toEqual([]);
    expect(diffValues(before, { t: 'set', items: [one] })).toEqual([
      { kind: 'removed', path: [{ kind: 'member', value: textOne }], before: textOne },
    ]);

    const mapBefore: Value = {
      t: 'map',
      entries: [
        { key: { t: 'int', v: '1' }, value: int('10') },
        { key: { t: 'string', v: '1' }, value: int('20') },
      ],
    };
    const mapAfter: Value = {
      t: 'map',
      entries: [
        { key: { t: 'string', v: '1' }, value: int('21') },
        { key: { t: 'int', v: '1' }, value: int('10') },
      ],
    };
    expect(diffValues(mapBefore, mapAfter)).toEqual([
      {
        kind: 'updated',
        path: [{ kind: 'key', key: { t: 'string', v: '1' } }],
        before: int('20'),
        after: int('21'),
      },
    ]);
  });

  it('compares record fields by name and distinguishes a missing field from null', () => {
    const before: Value = { t: 'record', fields: [{ name: 'answer', value: { t: 'null' } }] };
    const after: Value = { t: 'record', fields: [] };
    expect(diffValues(before, after)).toEqual([
      { kind: 'removed', path: [{ kind: 'field', name: 'answer' }], before: { t: 'null' } },
    ]);
  });

  it('uses the v2 numeric equality rules for element identity', () => {
    expect(diffValues({ t: 'int', v: '-0' }, { t: 'int', v: '0' })).toEqual([]);
    expect(diffValues({ t: 'float', v: '1.0' }, { t: 'float', v: '1e0' })).toEqual([]);
    expect(diffValues({ t: 'float', v: '-0' }, { t: 'float', v: '0' })).toEqual([]);
  });
});
