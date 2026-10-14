import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createHistoryTable } from '../../src/workspace/history/table-adapter';
import { runId, seqId } from '../../src/trace/ids';
import type { HistoryNode } from '../../src/trace/types';
import { spanKey } from '../../src/trace/value';

const span = [{ t: 'int' as const, v: '1' }];
const tree: HistoryNode[] = [
  {
    kind: 'group',
    span,
    children: [
      {
        kind: 'frame',
        frame: {
          seq: seqId('1'),
          span,
          source: 'test.rs:1',
          values: {},
          changed: [],
          deltas: {},
        },
      },
    ],
  },
];

describe('history table identity', () => {
  it('names rows by run while preserving span expansion', () => {
    createRoot((dispose) => {
      const [currentRun, setCurrentRun] = createSignal(runId('first'));
      const table = createHistoryTable(
        () => tree,
        () => [],
        currentRun,
      );
      expect(table.getRowModel().rows.map((row) => row.id)).toEqual([
        `first/span:${spanKey(span)}`,
        'first/seq:1',
      ]);
      setCurrentRun(runId('second'));
      expect(table.getRowModel().rows.map((row) => row.id)).toEqual([
        `second/span:${spanKey(span)}`,
        'second/seq:1',
      ]);
      dispose();
    });
  });
});
