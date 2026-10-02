import { describe, expect, it } from 'vitest';
import { deriveGraph } from '../../src/trace/relation-graph';
import { groupFrames } from '../../src/trace/span-tree';
import { materialize } from '../../src/trace/materialize';
import { spanKey } from '../../src/trace/value';
import type { Scalar, TraceRecord } from '../../src/trace/types';

const integer = (v: string) => ({ t: 'int', v }) as const;
const span = (...values: string[]): Scalar[] => values.map((v) => integer(v));
const base = (seq: string, id: Scalar[] = []): Pick<TraceRecord, 'format' | 'runId' | 'seq' | 'span'> => ({
  format: 'algo-vis/2',
  runId: 'run-1',
  seq,
  span: id,
});

describe('trace materialization', () => {
  it('preserves each historical state through snapshots, patches, and drops', () => {
    const records: TraceRecord[] = [
      { ...base('1'), kind: 'snapshot', values: [{ name: 'n', value: integer('1') }] },
      { ...base('2'), kind: 'patch', ops: [{ op: 'put', name: 'n', value: integer('2') }] },
      { ...base('3'), kind: 'patch', ops: [{ op: 'put', name: 'answer', value: integer('3') }] },
      { ...base('4'), kind: 'snapshot', values: [{ name: 'answer', value: integer('4') }] },
      { ...base('5'), kind: 'patch', ops: [{ op: 'drop', name: 'answer' }] },
    ];

    const { frames, columns } = materialize(records);
    expect(frames.map((frame) => Object.keys(frame.values))).toEqual([
      ['n'],
      ['n'],
      ['n', 'answer'],
      ['answer'],
      [],
    ]);
    expect(frames[0].values.n.value).toEqual(integer('1'));
    expect(frames[1].values.n.value).toEqual(integer('2'));
    expect(frames[3].changed).toEqual(['n', 'answer']);
    expect(frames[4].changed).toEqual(['answer']);
    expect(columns.map((column) => column.name)).toEqual(['n', 'answer']);
  });

  it('keeps large integer values and sequence IDs as strings', () => {
    const large = '900719925474099312345';
    const largeSeq = '9007199254740993';
    const { frames } = materialize([
      { ...base(largeSeq), kind: 'snapshot', values: [{ name: 'n', value: integer(large) }] },
    ]);
    expect(frames[0].seq).toBe(largeSeq);
    expect(frames[0].values.n.value).toEqual(integer(large));
  });
});

describe('history and graph projection', () => {
  it('groups frames by typed span prefix, including repeated IDs', () => {
    const { frames } = materialize([
      { ...base('1', span('2')), kind: 'snapshot', values: [] },
      { ...base('2', span('2', '0')), kind: 'snapshot', values: [] },
      { ...base('3', span('2')), kind: 'snapshot', values: [] },
    ]);
    const history = groupFrames(frames);
    expect(history).toHaveLength(1);
    expect(history[0].kind).toBe('group');
    if (history[0].kind === 'group') {
      expect(history[0].children.map((node) => node.kind)).toEqual(['frame', 'group', 'frame']);
    }
    expect(spanKey([{ t: 'string', v: '2' }])).not.toBe(spanKey(span('2')));
  });

  it('uses explicit from edges for a transition graph independently of sequence order', () => {
    const { frames } = materialize([
      { ...base('10', span('0')), kind: 'snapshot', values: [] },
      { ...base('11', span('1')), from: '10', kind: 'snapshot', values: [] },
      { ...base('12', span('2')), from: '10', kind: 'snapshot', values: [] },
    ]);
    const graph = deriveGraph(frames);
    expect(graph.mode).toBe('transition');
    expect(graph.edges).toEqual([
      { from: 'seq:10', to: 'seq:11' },
      { from: 'seq:10', to: 'seq:12' },
    ]);
  });

  it('falls back to the span tree when no transition origin is provided', () => {
    const { frames } = materialize([
      { ...base('1', span('0')), kind: 'snapshot', values: [] },
      { ...base('2', span('0', '1')), kind: 'snapshot', values: [] },
    ]);
    const graph = deriveGraph(frames);
    expect(graph.mode).toBe('span');
    expect(graph.edges).toContainEqual({
      from: `span:${spanKey(span('0'))}`,
      to: `span:${spanKey(span('0', '1'))}`,
    });
    expect(graph.edges).toContainEqual({ from: `span:${spanKey(span('0', '1'))}`, to: 'seq:2' });
  });
});
