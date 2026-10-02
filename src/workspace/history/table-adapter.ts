import {
  createColumnHelper,
  createExpandedRowModel,
  createTable,
  rowExpandingFeature,
  tableFeatures,
} from '@tanstack/solid-table';
import type { Accessor } from 'solid-js';
import type { HistoryNode } from '../../trace/types';
import { spanKey } from '../../trace/value';

const features = tableFeatures({ rowExpandingFeature, expandedRowModel: createExpandedRowModel() });
const helper = createColumnHelper<typeof features, HistoryNode>();
const columns = helper.columns([helper.display({ id: 'history', header: 'History' })]);

type GroupNode = Extract<HistoryNode, { kind: 'group' }>;

function groups(nodes: HistoryNode[]): GroupNode[] {
  return nodes.flatMap((node) => (node.kind === 'group' ? [node, ...groups(node.children)] : []));
}

export function createHistoryTable(tree: Accessor<HistoryNode[]>, collapsed: Accessor<string[]>) {
  return createTable({
    features,
    columns,
    get data() {
      return tree();
    },
    get state() {
      const hidden = new Set(collapsed());
      return {
        expanded: Object.fromEntries(
          groups(tree())
            .filter((node) => !hidden.has(spanKey(node.span)))
            .map((node) => [`span:${spanKey(node.span)}`, true]),
        ),
      };
    },
    getSubRows: (node) => (node.kind === 'group' ? node.children : undefined),
    getRowId: (node) => (node.kind === 'group' ? `span:${spanKey(node.span)}` : `seq:${node.frame.seq}`),
    getRowCanExpand: (row) => row.original.kind === 'group',
  });
}
