import type { Column, Field, Frame, Materialized, TraceRecord } from './types';
import { legacyValue } from './value';
import { seqId } from './ids';

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
    for (const field of state.values())
      if (!columns.has(field.name))
        columns.set(field.name, { name: field.name, kind: field.value.t, sourceType: field.sourceType });
    frames.push({
      seq: seqId(record.seq),
      span: record.span,
      from: record.from == null ? undefined : seqId(record.from),
      source: record.source ? `${record.source.file}:${record.source.line}` : '—',
      values: Object.fromEntries(state),
      changed,
    });
  }
  return { frames, columns: [...columns.values()] };
}
