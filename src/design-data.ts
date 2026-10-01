export type ValueKey = 'a' | 'left' | 'right' | 'mid' | 'ok' | 'seen' | 'score' | 'grid' | 'pos';
export type ValueKind = 'array' | 'integer' | 'boolean' | 'set' | 'map' | 'grid' | 'position';
export type Snapshot = {
  a: number[];
  left: number;
  right: number;
  mid: number;
  ok: boolean | null;
  seen: number[];
  score: Record<string, number>;
  grid: number[][];
  pos: [number, number];
};
export type Frame = { seq: number; span: number[]; source: string; changed: ValueKey[]; values: Snapshot; from?: number };
export type GraphNode = { id: string; kind: 'span' | 'record'; label: string; detail: string; seq?: number; x: number; y: number };
export type GraphEdge = { from: string; to: string };
export type TraceGraph = { mode: 'transition' | 'span'; nodes: GraphNode[]; edges: GraphEdge[]; height: number };

export const valueColumns: { key: ValueKey; kind: ValueKind; label: string; formats: { id: string; label: string }[] }[] = [
  { key: 'a', kind: 'array', label: 'a', formats: [{ id: 'cells', label: 'Numbers' }, { id: 'bars', label: 'Bars' }] },
  { key: 'left', kind: 'integer', label: 'left', formats: [{ id: 'number', label: 'Number' }, { id: 'scale', label: 'Position' }] },
  { key: 'right', kind: 'integer', label: 'right', formats: [{ id: 'number', label: 'Number' }, { id: 'scale', label: 'Position' }] },
  { key: 'mid', kind: 'integer', label: 'mid', formats: [{ id: 'number', label: 'Number' }, { id: 'scale', label: 'Position' }] },
  { key: 'ok', kind: 'boolean', label: 'ok', formats: [{ id: 'badge', label: 'Badge' }, { id: 'text', label: 'Text' }] },
  { key: 'seen', kind: 'set', label: 'seen', formats: [{ id: 'members', label: 'Members' }, { id: 'count', label: 'Count' }] },
  { key: 'score', kind: 'map', label: 'score', formats: [{ id: 'pairs', label: 'Entries' }, { id: 'count', label: 'Count' }] },
  { key: 'grid', kind: 'grid', label: 'grid', formats: [{ id: 'mini', label: 'Grid' }, { id: 'summary', label: 'Dimensions' }] },
  { key: 'pos', kind: 'position', label: 'pos', formats: [{ id: 'coords', label: 'Coordinates' }] },
];

export const sampleRuns = [
  { id: '024', time: '14:32:08', input: 'sample-03.in', status: 'Done', offset: 0, hasFrom: true },
  { id: '023', time: '14:28:41', input: 'sample-02.in', status: 'Done', offset: 3, hasFrom: true },
  { id: '022', time: '14:24:03', input: 'sample-01.in', status: 'Stopped', offset: -1, hasFrom: false },
] as const;

const board = [
  [0, 0, 1, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 0],
  [1, 0, 0, 0],
];

const base: Frame[] = [
  { seq: 0, span: [], source: 'main.rs:12', changed: ['a', 'left', 'right', 'mid', 'ok', 'seen', 'score', 'grid', 'pos'], values: { a: [2, 5, 8, 11, 15], left: 0, right: 5, mid: 2, ok: null, seen: [], score: { x: 0, y: 0 }, grid: board, pos: [0, 0] } },
  { seq: 1, span: [0], source: 'main.rs:18', changed: ['mid', 'pos'], values: { a: [2, 5, 8, 11, 15], left: 0, right: 5, mid: 2, ok: null, seen: [], score: { x: 0, y: 0 }, grid: board, pos: [0, 1] }, from: 0 },
  { seq: 2, span: [0, 0], source: 'main.rs:21', changed: ['ok', 'seen', 'pos'], values: { a: [2, 5, 8, 11, 15], left: 0, right: 5, mid: 2, ok: true, seen: [2], score: { x: 0, y: 0 }, grid: board, pos: [1, 1] }, from: 1 },
  { seq: 3, span: [0, 1], source: 'main.rs:24', changed: ['left'], values: { a: [2, 5, 8, 11, 15], left: 2, right: 5, mid: 2, ok: true, seen: [2], score: { x: 0, y: 0 }, grid: board, pos: [1, 1] }, from: 2 },
  { seq: 4, span: [0, 1], source: 'main.rs:27', changed: ['a', 'score'], values: { a: [2, 5, 9, 11, 15], left: 2, right: 5, mid: 2, ok: true, seen: [2], score: { x: 1, y: 0 }, grid: board, pos: [1, 1] }, from: 3 },
  { seq: 5, span: [1], source: 'main.rs:18', changed: ['mid', 'ok'], values: { a: [2, 5, 9, 11, 15], left: 2, right: 5, mid: 3, ok: null, seen: [2], score: { x: 1, y: 0 }, grid: board, pos: [1, 1] }, from: 0 },
  { seq: 6, span: [1, 0], source: 'main.rs:21', changed: ['ok', 'seen', 'pos'], values: { a: [2, 5, 9, 11, 15], left: 2, right: 5, mid: 3, ok: false, seen: [2, 3], score: { x: 1, y: 0 }, grid: board, pos: [2, 1] }, from: 5 },
  { seq: 7, span: [1, 0], source: 'main.rs:27', changed: ['right', 'score', 'pos'], values: { a: [2, 5, 9, 11, 15], left: 2, right: 4, mid: 3, ok: false, seen: [2, 3], score: { x: 1, y: 2 }, grid: board, pos: [2, 2] }, from: 6 },
  { seq: 8, span: [2], source: 'main.rs:31', changed: ['mid', 'pos'], values: { a: [2, 5, 9, 11, 15], left: 2, right: 4, mid: 4, ok: false, seen: [2, 3], score: { x: 1, y: 2 }, grid: board, pos: [2, 3] }, from: 7 },
];

export function framesForRun(runId: string): Frame[] {
  const run = sampleRuns.find(item => item.id === runId) ?? sampleRuns[0];
  return base.map(frame => ({
    ...frame,
    from: run.hasFrom ? frame.from : undefined,
    values: {
      ...frame.values,
      a: frame.values.a.map(value => value + run.offset),
      score: { x: frame.values.score.x + run.offset, y: frame.values.score.y },
    },
  }));
}

export const pathKey = (path: number[]) => path.join('/');
export const pathText = (path: number[]) => `[${path.join(', ')}]`;

export function deriveGraph(frames: Frame[]): TraceGraph {
  const mode = frames.some(frame => frame.from !== undefined) ? 'transition' : 'span';
  const nodes: Omit<GraphNode, 'x' | 'y'>[] = [];
  const edges: GraphEdge[] = [];
  const knownSeq = new Set(frames.map(frame => frame.seq));
  if (mode === 'transition') {
    for (const frame of frames) {
      nodes.push({ id: `seq:${frame.seq}`, kind: 'record', label: String(frame.seq).padStart(2, '0'), detail: pathText(frame.span), seq: frame.seq });
      if (frame.from !== undefined && knownSeq.has(frame.from)) edges.push({ from: `seq:${frame.from}`, to: `seq:${frame.seq}` });
    }
  } else {
    const paths = new Map<string, number[]>([['', []]]);
    for (const frame of frames) for (let length = 1; length <= frame.span.length; length++) {
      const prefix = frame.span.slice(0, length);
      paths.set(pathKey(prefix), prefix);
    }
    for (const path of [...paths.values()].sort((a, b) => a.length - b.length || pathKey(a).localeCompare(pathKey(b)))) {
      const id = `span:${pathKey(path)}`;
      nodes.push({ id, kind: 'span', label: pathText(path), detail: path.length ? 'span' : 'root' });
      if (path.length) edges.push({ from: `span:${pathKey(path.slice(0, -1))}`, to: id });
    }
    for (const frame of frames) {
      nodes.push({ id: `seq:${frame.seq}`, kind: 'record', label: String(frame.seq).padStart(2, '0'), detail: pathText(frame.span), seq: frame.seq });
      edges.push({ from: `span:${pathKey(frame.span)}`, to: `seq:${frame.seq}` });
    }
  }

  const children = new Map(nodes.map(node => [node.id, [] as string[]]));
  const parents = new Set<string>();
  for (const edge of edges) {
    children.get(edge.from)?.push(edge.to);
    parents.add(edge.to);
  }
  const roots = nodes.filter(node => !parents.has(node.id)).map(node => node.id);
  const positions = new Map<string, { x: number; y: number }>();
  let leaf = 0;
  let maxDepth = 0;
  const visiting = new Set<string>();
  const place = (id: string, depth: number): number => {
    if (positions.has(id)) return positions.get(id)!.x;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    maxDepth = Math.max(maxDepth, depth);
    const offspring = children.get(id) ?? [];
    const x = offspring.length ? offspring.reduce((sum, child) => sum + place(child, depth + 1), 0) / offspring.length : leaf++;
    positions.set(id, { x, y: depth * 76 + 55 });
    visiting.delete(id);
    return x;
  };
  for (const root of roots) place(root, 0);
  for (const node of nodes) if (!positions.has(node.id)) place(node.id, 0);
  const maxLeaf = Math.max(1, leaf - 1);
  return {
    mode,
    nodes: nodes.map(node => ({ ...node, x: 250 + (positions.get(node.id)!.x / maxLeaf) * 500, y: positions.get(node.id)!.y })),
    edges,
    height: Math.max(440, maxDepth * 76 + 100),
  };
}
