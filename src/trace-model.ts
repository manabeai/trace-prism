export type Scalar = { t: 'null'; v: null } | { t: 'bool'; v: boolean } | { t: 'int' | 'float' | 'string'; v: string };
export type Value =
  | { t: 'null' }
  | { t: 'bool'; v: boolean }
  | { t: 'int' | 'float' | 'string'; v: string }
  | { t: 'array' | 'set'; items: Value[] }
  | { t: 'map'; entries: { key: Scalar; value: Value }[] }
  | { t: 'record'; fields: Field[] };
export type Field = { name: string; sourceType?: string; value: Value };
type BaseRecord = { format: string; runId: string; seq: string; span: Scalar[]; from?: string | null; source?: { file: string; line: number; column?: number } };
export type TraceRecord = BaseRecord & (
  | { kind: 'snapshot'; values: Field[] }
  | { kind: 'patch'; ops: ({ op: 'put'; name: string; sourceType?: string; value: Value } | { op: 'drop'; name: string })[] }
  | { values: Field[] }
);
export type Run = { id: string; source: string; input: string; startedAt: string; durationMs: number; status: 'running' | 'completed' | 'interrupted'; frames: TraceRecord[] };
export type Frame = { seq: string; span: Scalar[]; from?: string; source: string; values: Record<string, Field>; changed: string[] };
export type Column = { name: string; kind: Value['t']; sourceType?: string };
export type Materialized = { frames: Frame[]; columns: Column[] };
export type GraphNode = { id: string; kind: 'span' | 'record'; label: string; detail: string; seq?: string; x: number; y: number };
export type GraphEdge = { from: string; to: string };
export type Graph = { mode: 'transition' | 'span'; nodes: GraphNode[]; edges: GraphEdge[]; height: number };

export const scalarText = (value: Scalar) => value.t === 'string' ? JSON.stringify(value.v) : String(value.v);
export const spanText = (span: Scalar[]) => `[${span.map(scalarText).join(', ')}]`;
export const spanKey = (span: Scalar[]) => JSON.stringify(span);

function legacyValue(input: unknown): Value {
  if (input === null) return { t: 'null' };
  if (typeof input === 'boolean') return { t: 'bool', v: input };
  if (typeof input === 'number') return { t: Number.isInteger(input) ? 'int' : 'float', v: String(input) };
  if (typeof input === 'string') return { t: 'string', v: input };
  if (Array.isArray(input)) return { t: 'array', items: input.map(legacyValue) };
  if (typeof input === 'object' && input && 't' in input) return input as Value;
  if (typeof input === 'object' && input) return { t: 'record', fields: Object.entries(input).map(([name, value]) => ({ name, value: legacyValue(value) })) };
  return { t: 'string', v: String(input) };
}

export function valueText(value: Value): string {
  switch (value.t) {
    case 'null': return 'null';
    case 'bool': case 'int': case 'float': return String(value.v);
    case 'string': return JSON.stringify(value.v);
    case 'array': return `[${value.items.map(valueText).join(', ')}]`;
    case 'set': return `{${value.items.map(valueText).join(', ')}}`;
    case 'map': return `{${value.entries.map(entry => `${valueText(entry.key)}: ${valueText(entry.value)}`).join(', ')}}`;
    case 'record': return `{${value.fields.map(field => `${field.name}: ${valueText(field.value)}`).join(', ')}}`;
  }
}

export function materialize(records: TraceRecord[]): Materialized {
  const state = new Map<string, Field>();
  const columns = new Map<string, Column>();
  const frames: Frame[] = [];
  for (const record of records) {
    const before = new Map(state);
    const changed: string[] = [];
    if ('kind' in record && record.kind === 'snapshot') {
      state.clear();
      for (const field of record.values) state.set(field.name, field);
      for (const name of new Set([...before.keys(), ...state.keys()])) {
        if (JSON.stringify(before.get(name)) !== JSON.stringify(state.get(name))) changed.push(name);
      }
    } else if ('kind' in record && record.kind === 'patch') {
      for (const op of record.ops) {
        if (op.op === 'drop') state.delete(op.name);
        else state.set(op.name, { name: op.name, sourceType: op.sourceType, value: op.value });
        changed.push(op.name);
      }
    } else if ('values' in record) {
      // Historical v1 traces store a partial observation in each event.
      for (const field of record.values) {
        const normalized = { ...field, value: legacyValue(field.value) };
        if (JSON.stringify(state.get(field.name)) !== JSON.stringify(normalized)) changed.push(field.name);
        state.set(field.name, normalized);
      }
    }
    for (const field of state.values()) if (!columns.has(field.name)) columns.set(field.name, { name: field.name, kind: field.value.t, sourceType: field.sourceType });
    frames.push({ seq: record.seq, span: record.span, from: record.from ?? undefined, source: record.source ? `${record.source.file}:${record.source.line}` : '—', values: Object.fromEntries(state), changed });
  }
  return { frames, columns: [...columns.values()] };
}

export type HistoryNode = { kind: 'group'; span: Scalar[]; children: HistoryNode[] } | { kind: 'frame'; frame: Frame };

export function groupFrames(frames: Frame[]): HistoryNode[] {
  const root: HistoryNode[] = [];
  const groups = new Map<string, Extract<HistoryNode, { kind: 'group' }>>();
  for (const frame of frames) {
    let children = root;
    for (let length = 1; length <= frame.span.length; length++) {
      const span = frame.span.slice(0, length);
      const key = spanKey(span);
      let group = groups.get(key);
      if (!group) {
        group = { kind: 'group', span, children: [] };
        groups.set(key, group);
        children.push(group);
      }
      children = group.children;
    }
    children.push({ kind: 'frame', frame });
  }
  return root;
}

export function deriveGraph(frames: Frame[]): Graph {
  const mode = frames.some(frame => frame.from !== undefined) ? 'transition' : 'span';
  const nodes: Omit<GraphNode, 'x' | 'y'>[] = [];
  const edges: GraphEdge[] = [];
  const knownSeq = new Set(frames.map(frame => frame.seq));
  if (mode === 'transition') {
    for (const frame of frames) {
      nodes.push({ id: `seq:${frame.seq}`, kind: 'record', label: frame.seq, detail: spanText(frame.span), seq: frame.seq });
      if (frame.from !== undefined && knownSeq.has(frame.from)) edges.push({ from: `seq:${frame.from}`, to: `seq:${frame.seq}` });
    }
  } else {
    const spans = new Map<string, Scalar[]>([[spanKey([]), []]]);
    for (const frame of frames) for (let length = 1; length <= frame.span.length; length++) {
      const prefix = frame.span.slice(0, length);
      spans.set(spanKey(prefix), prefix);
    }
    for (const span of [...spans.values()].sort((a, b) => a.length - b.length || spanText(a).localeCompare(spanText(b)))) {
      const id = `span:${spanKey(span)}`;
      nodes.push({ id, kind: 'span', label: span.length ? scalarText(span[span.length - 1]) : '∅', detail: spanText(span) });
      if (span.length) edges.push({ from: `span:${spanKey(span.slice(0, -1))}`, to: id });
    }
    for (const frame of frames) {
      nodes.push({ id: `seq:${frame.seq}`, kind: 'record', label: frame.seq, detail: spanText(frame.span), seq: frame.seq });
      edges.push({ from: `span:${spanKey(frame.span)}`, to: `seq:${frame.seq}` });
    }
  }
  const children = new Map(nodes.map(node => [node.id, [] as string[]]));
  const parents = new Set<string>();
  for (const edge of edges) { children.get(edge.from)?.push(edge.to); parents.add(edge.to); }
  const positions = new Map<string, { x: number; y: number }>();
  let leaf = 0;
  let maxDepth = 0;
  const place = (id: string, depth: number): number => {
    if (positions.has(id)) return positions.get(id)!.x;
    maxDepth = Math.max(maxDepth, depth);
    const offspring = children.get(id) ?? [];
    const x = offspring.length ? offspring.reduce((sum, child) => sum + place(child, depth + 1), 0) / offspring.length : leaf++;
    positions.set(id, { x, y: depth * 76 + 55 });
    return x;
  };
  for (const node of nodes.filter(node => !parents.has(node.id))) place(node.id, 0);
  for (const node of nodes) if (!positions.has(node.id)) place(node.id, 0);
  const maxLeaf = Math.max(1, leaf - 1);
  return { mode, nodes: nodes.map(node => ({ ...node, x: 150 + (positions.get(node.id)!.x / maxLeaf) * 700, y: positions.get(node.id)!.y })), edges, height: Math.max(440, maxDepth * 76 + 100) };
}
