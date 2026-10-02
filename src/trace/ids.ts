declare const identity: unique symbol;
export type Brand<Name extends string> = string & { readonly [identity]: Name };

export type RunId = Brand<'RunId'>;
export type Seq = Brand<'Seq'>;
export type ValueName = Brand<'ValueName'>;
export type SpanKey = Brand<'SpanKey'>;
export type ColumnId = Brand<'ColumnId'>;
export type ViewInstanceId = Brand<'ViewInstanceId'>;
export type FrameKey = Readonly<{ runId: RunId; seq: Seq }>;

const maxSeq = (1n << 64n) - 1n;

export function runId(input: string): RunId {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input)) throw new Error(`invalid run ID: ${input}`);
  return input as RunId;
}

export function seqId(input: string): Seq {
  if (!/^(0|[1-9][0-9]*)$/.test(input) || BigInt(input) > maxSeq) throw new Error(`invalid seq: ${input}`);
  return input as Seq;
}

export function valueName(input: string): ValueName {
  if (!input || input.length > 256) throw new Error('invalid value name');
  return input as ValueName;
}

export function spanId(input: string): SpanKey {
  return input as SpanKey;
}

export function valueColumnId(name: ValueName): ColumnId {
  return `value:${name}` as ColumnId;
}

export function algoColumnId(id: ViewInstanceId): ColumnId {
  return `algo:${id}` as ColumnId;
}

export function viewInstanceId(input: string): ViewInstanceId {
  if (!input) throw new Error('invalid view instance ID');
  return input as ViewInstanceId;
}
