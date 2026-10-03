import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTraceLines } from './validate.mjs';

const int = value => ({ t: 'int', v: String(value) });
const event = (seq, kind, body = {}) => ({ format: 'viz.trace/v2', runId: 'test', seq: String(seq), kind, span: [], ...body });
const lines = records => records.map(record => JSON.stringify(record));

test('example stream conforms to shape and sequence rules', async () => {
  const sample = await readFile(new URL('./example.ndjson', import.meta.url), 'utf8');
  const result = validateTraceLines(sample.split('\n'));
  assert.equal(result.records, 4);
  assert.deepEqual(result.finalStates['run-demo-001'].left, int(2));
});

test('patches follow seq order even when from points to an older branch', () => {
  const result = validateTraceLines(lines([
    event(0, 'snapshot', { values: [{ name: 'a', value: int(0) }] }),
    event(1, 'patch', { from: '0', ops: [{ op: 'put', name: 'a', value: int(1) }] }),
    event(2, 'patch', { from: '0', ops: [{ op: 'put', name: 'b', value: int(2) }] }),
  ]));
  assert.deepEqual(result.finalStates.test, { a: int(1), b: int(2) });
});

test('fromId matches an earlier typed span ID without changing patch order', () => {
  const result = validateTraceLines(lines([
    event(0, 'snapshot', { span: [int(0)], values: [{ name: 'n', value: int(0) }] }),
    event(1, 'patch', { span: [int(1)], fromId: [int(0)], ops: [{ op: 'put', name: 'n', value: int(1) }] }),
    event(2, 'patch', { span: [int(2)], fromId: [int(0)], ops: [{ op: 'put', name: 'n', value: int(2) }] }),
  ]));
  assert.deepEqual(result.finalStates.test.n, int(2));
  assert.throws(() => validateTraceLines(lines([
    event(0, 'snapshot', { span: [int(0)], values: [] }),
    event(1, 'patch', { span: [int(1)], fromId: [{ t: 'string', v: '0' }], ops: [] }),
  ])), /earlier span ID/);
  assert.throws(() => validateTraceLines(lines([
    event(0, 'snapshot', { span: [int(0)], values: [] }),
    event(1, 'patch', { span: [int(1)], from: '0', fromId: [int(0)], ops: [] }),
  ])), /only one/);
});

test('rejects future transitions and gaps in seq', () => {
  const first = event(0, 'snapshot', { values: [] });
  assert.throws(() => validateTraceLines(lines([first, event(1, 'patch', { from: '2', ops: [] })])), /earlier record/);
  assert.throws(() => validateTraceLines(lines([first, event(2, 'patch', { ops: [] })])), /expected seq 1/);
});

test('rejects duplicate typed Map keys and dropping absent values', () => {
  const duplicateMap = event(0, 'snapshot', { values: [{ name: 'm', value: { t: 'map', entries: [
    { key: int(1), value: int(2) }, { key: int(1), value: int(3) },
  ] } }] });
  assert.throws(() => validateTraceLines(lines([duplicateMap])), /duplicate Map key/);
  assert.throws(() => validateTraceLines(lines([
    event(0, 'snapshot', { values: [] }), event(1, 'patch', { ops: [{ op: 'drop', name: 'missing' }] }),
  ])), /cannot drop absent value/);
});
