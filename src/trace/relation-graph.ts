import type { Frame, Graph, GraphEdge, GraphNode, Scalar } from './types';
import { scalarText, spanKey, spanText } from './value';

export function deriveGraph(frames: Frame[]): Graph {
  const mode = frames.some((frame) => frame.from !== undefined) ? 'transition' : 'span';
  const nodes: Omit<GraphNode, 'x' | 'y'>[] = [];
  const edges: GraphEdge[] = [];
  const knownSeq = new Set(frames.map((frame) => frame.seq));
  if (mode === 'transition') {
    for (const frame of frames) {
      nodes.push({
        id: `seq:${frame.seq}`,
        kind: 'record',
        label: frame.seq,
        detail: spanText(frame.span),
        seq: frame.seq,
      });
      if (frame.from !== undefined && knownSeq.has(frame.from))
        edges.push({ from: `seq:${frame.from}`, to: `seq:${frame.seq}` });
    }
  } else {
    const spans = new Map<string, Scalar[]>([[spanKey([]), []]]);
    for (const frame of frames)
      for (let length = 1; length <= frame.span.length; length++) {
        const prefix = frame.span.slice(0, length);
        spans.set(spanKey(prefix), prefix);
      }
    for (const span of [...spans.values()].sort(
      (a, b) => a.length - b.length || spanText(a).localeCompare(spanText(b)),
    )) {
      const id = `span:${spanKey(span)}`;
      nodes.push({
        id,
        kind: 'span',
        label: span.length ? scalarText(span[span.length - 1]) : '∅',
        detail: spanText(span),
      });
      if (span.length) edges.push({ from: `span:${spanKey(span.slice(0, -1))}`, to: id });
    }
    for (const frame of frames) {
      nodes.push({
        id: `seq:${frame.seq}`,
        kind: 'record',
        label: frame.seq,
        detail: spanText(frame.span),
        seq: frame.seq,
      });
      edges.push({ from: `span:${spanKey(frame.span)}`, to: `seq:${frame.seq}` });
    }
  }
  const children = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const parents = new Set<string>();
  for (const edge of edges) {
    children.get(edge.from)?.push(edge.to);
    parents.add(edge.to);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let leaf = 0;
  let maxDepth = 0;
  const place = (id: string, depth: number): number => {
    if (positions.has(id)) return positions.get(id)!.x;
    maxDepth = Math.max(maxDepth, depth);
    const offspring = children.get(id) ?? [];
    const x = offspring.length
      ? offspring.reduce((sum, child) => sum + place(child, depth + 1), 0) / offspring.length
      : leaf++;
    positions.set(id, { x, y: depth * 76 + 55 });
    return x;
  };
  for (const node of nodes.filter((node) => !parents.has(node.id))) place(node.id, 0);
  for (const node of nodes) if (!positions.has(node.id)) place(node.id, 0);
  const leafGap = 92;
  const contentWidth = Math.max(0, leaf - 1) * leafGap;
  const width = Math.max(420, contentWidth + 128);
  const inset = (width - contentWidth) / 2;
  return {
    mode,
    nodes: nodes.map((node) => ({
      ...node,
      x: inset + positions.get(node.id)!.x * leafGap,
      y: positions.get(node.id)!.y,
    })),
    edges,
    width,
    height: Math.max(440, maxDepth * 76 + 100),
  };
}
