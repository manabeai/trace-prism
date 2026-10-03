import type { Frame, Graph, GraphEdge, GraphNode, Scalar } from './types';
import { scalarText, spanKey, spanText } from './value';

export type GraphPreference = 'from' | 'span';

export function hasFromLinks(frames: Frame[]): boolean {
  return frames.some((frame) => frame.from !== undefined || frame.fromId !== undefined);
}

export function deriveGraph(frames: Frame[], preference: GraphPreference = 'from'): Graph {
  const mode = preference === 'from' && hasFromLinks(frames) ? 'transition' : 'span';
  const nodes: Omit<GraphNode, 'x' | 'y'>[] = [];
  const edges: GraphEdge[] = [];

  if (mode === 'transition') {
    const knownSeq = new Set(frames.map((frame) => frame.seq));
    const latestById = new Map<string, string>();
    const showIds = frames.some((frame) => frame.fromId !== undefined);
    for (const frame of frames) {
      const id = `seq:${frame.seq}`;
      const fullLabel = frame.span.length ? scalarText(frame.span.at(-1)!) : frame.seq;
      nodes.push({
        id,
        kind: 'record',
        label: showIds ? (fullLabel.length > 8 ? `${fullLabel.slice(0, 7)}…` : fullLabel) : frame.seq,
        detail: `seq ${frame.seq} · ${spanText(frame.span)}`,
        seq: frame.seq,
      });
      const parent = frame.fromId
        ? latestById.get(spanKey(frame.fromId))
        : frame.from !== undefined && knownSeq.has(frame.from)
          ? `seq:${frame.from}`
          : undefined;
      if (parent) edges.push({ from: parent, to: id });
      latestById.set(spanKey(frame.span), id);
    }
  } else {
    const spans = new Map<string, { span: Scalar[]; seqs: Frame['seq'][] }>([
      [spanKey([]), { span: [], seqs: [] }],
    ]);
    for (const frame of frames) {
      for (let length = 1; length <= frame.span.length; length++) {
        const prefix = frame.span.slice(0, length);
        const key = spanKey(prefix);
        if (!spans.has(key)) spans.set(key, { span: prefix, seqs: [] });
      }
      spans.get(spanKey(frame.span))!.seqs.push(frame.seq);
    }
    for (const [key, { span, seqs }] of spans) {
      const id = `span:${key}`;
      nodes.push({
        id,
        kind: 'span',
        label: span.length ? scalarText(span.at(-1)!) : '∅',
        detail: spanText(span),
        seq: seqs.at(-1),
        seqs,
      });
      if (span.length) edges.push({ from: `span:${spanKey(span.slice(0, -1))}`, to: id });
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
