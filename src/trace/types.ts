import type { RunId, Seq } from './ids';
import type { ValueChange } from './diff';

export type Scalar =
  { t: 'null'; v: null } | { t: 'bool'; v: boolean } | { t: 'int' | 'float' | 'string'; v: string };
export type Value =
  | { t: 'null' }
  | { t: 'bool'; v: boolean }
  | { t: 'int'; v: string }
  | { t: 'float'; v: string }
  | { t: 'string'; v: string }
  | { t: 'array'; items: Value[] }
  | { t: 'set'; items: Value[] }
  | { t: 'map'; entries: { key: Scalar; value: Value }[] }
  | { t: 'record'; fields: Field[] };
export type Field = { name: string; sourceType?: string; value: Value };
type BaseRecord = {
  format: string;
  runId: string;
  seq: string;
  span: Scalar[];
  from?: string | null;
  fromId?: Scalar[];
  source?: { file: string; line: number; column?: number };
};
export type TraceRecord = BaseRecord &
  (
    | { kind: 'snapshot'; values: Field[] }
    | {
        kind: 'patch';
        ops: (
          { op: 'put'; name: string; sourceType?: string; value: Value } | { op: 'drop'; name: string }
        )[];
      }
    | { values: Field[] }
  );
export type Run = {
  id: RunId;
  source: string;
  input: string;
  startedAt: string;
  durationMs: number;
  status: 'running' | 'completed' | 'interrupted';
  loaded: boolean;
  frames: TraceRecord[];
};
export type Frame = {
  seq: Seq;
  span: Scalar[];
  from?: Seq;
  fromId?: Scalar[];
  source: string;
  values: Record<string, Field>;
  changed: string[];
  deltas: Record<string, readonly ValueChange[]>;
};
export type Column = { name: string; kind: Value['t']; sourceType?: string };
export type Materialized = { frames: Frame[]; columns: Column[] };
export type GraphNode = {
  id: string;
  kind: 'span' | 'record';
  label: string;
  detail: string;
  seq?: Seq;
  seqs?: Seq[];
  x: number;
  y: number;
};
export type GraphEdge = { from: string; to: string };
export type Graph = {
  mode: 'transition' | 'span';
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
};

export type HistoryNode =
  { kind: 'group'; span: Scalar[]; children: HistoryNode[] } | { kind: 'frame'; frame: Frame };
