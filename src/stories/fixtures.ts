import exampleTrace from '../../protocol/v2/example.ndjson?raw';
import type { RunRepository } from '../runs/RunRepository';
import { decodeRuns } from '../trace/decode';
import { materialize } from '../trace/materialize';
import { seqId } from '../trace/ids';
import type { Field, Frame, Value } from '../trace/types';

const records = exampleTrace
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Record<string, unknown>);

const run = (id: string, source: string, startedAt: string) => ({
  id,
  source,
  input: 'sample.in',
  startedAt,
  durationMs: 8,
  status: 'completed',
  frames: records.map((record) => ({ ...record, runId: id })),
});

const sampleRuns = decodeRuns({
  runs: [
    run('storybook-binary', 'binary-search.rs', '2026-10-02T12:00:00.000Z'),
    run('storybook-second', 'second-run.rs', '2026-10-02T11:53:00.000Z'),
  ],
});

export const recordedRepository: RunRepository = { list: async () => sampleRuns };
export const emptyRepository: RunRepository = { list: async () => ({ runs: [], errors: [] }) };
export const failingRepository: RunRepository = {
  list: async () => {
    throw new Error('Trace storage unavailable');
  },
};

export const sampleFrame = materialize(sampleRuns.runs[0].frames).frames[2];

const int = (value: number): Value => ({ t: 'int', v: String(value) });
export const arrayField: Field = {
  name: 'a',
  sourceType: 'Vec<i64>',
  value: { t: 'array', items: [3, 7, 11, 15, 19, 23].map(int) },
};
export const arrayChange = [
  { kind: 'updated' as const, path: [{ kind: 'index' as const, index: 3 }], before: int(11), after: int(15) },
];
export const setField: Field = { name: 'visited', value: { t: 'set', items: [2, 5, 8].map(int) } };
export const mapField: Field = {
  name: 'distance',
  value: {
    t: 'map',
    entries: [
      { key: { t: 'int', v: '2' }, value: int(0) },
      { key: { t: 'int', v: '5' }, value: int(1) },
    ],
  },
};
export const matrixField: Field = {
  name: 'board',
  value: {
    t: 'array',
    items: [
      [0, 1, 0],
      [0, 0, 0],
      [1, 0, 0],
    ].map((row) => ({ t: 'array', items: row.map(int) })),
  },
};

export const gridFrame: Frame = {
  seq: seqId('1'),
  span: [],
  source: 'maze.rs:14',
  values: {
    board: matrixField,
    pos: { name: 'pos', value: { t: 'array', items: [int(1), int(2)] } },
  },
  changed: [],
  deltas: {},
};

export const graphFrame: Frame = {
  seq: seqId('2'),
  span: [{ t: 'int', v: '1' }],
  source: 'dfs.rs:20',
  values: {
    adjacency: {
      name: 'adjacency',
      value: {
        t: 'array',
        items: [[1, 2], [3, 4], [5], [], [5], []].map((row) => ({ t: 'array', items: row.map(int) })),
      },
    },
    seen: {
      name: 'seen',
      value: { t: 'array', items: [true, true, false, true, false, false].map((v) => ({ t: 'bool', v })) },
    },
    u: { name: 'u', value: int(3) },
  },
  changed: ['seen', 'u'],
  deltas: {},
};
