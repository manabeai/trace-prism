#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(await readFile(new URL('./trace.schema.json', import.meta.url), 'utf8'));
const validateShape = new Ajv2020({ allErrors: true }).compile(schema);
const maxSeq = (1n << 64n) - 1n;

function canonical(value) {
  switch (value.t) {
    case 'null': return 'null';
    case 'bool': return `bool:${value.v}`;
    case 'int': return `int:${BigInt(value.v)}`;
    case 'float': {
      const number = Number(value.v);
      if (!Number.isFinite(number)) throw new Error(`non-finite float ${value.v}`);
      return `float:${Object.is(number, -0) ? 0 : number}`;
    }
    case 'string': return `string:${JSON.stringify(value.v)}`;
    case 'array': return `array:[${value.items.map(canonical).join(',')}]`;
    case 'set': {
      const items = value.items.map(canonical);
      if (new Set(items).size !== items.length) throw new Error('duplicate Set member');
      return `set:{${items.sort().join(',')}}`;
    }
    case 'map': {
      const entries = value.entries.map(entry => [canonical(entry.key), canonical(entry.value)]);
      if (new Set(entries.map(entry => entry[0])).size !== entries.length) throw new Error('duplicate Map key');
      return `map:{${entries.sort((a, b) => a[0].localeCompare(b[0])).map(entry => entry.join('=')).join(',')}}`;
    }
    case 'record': {
      const fields = value.fields.map(field => [field.name, canonical(field.value)]);
      if (new Set(fields.map(field => field[0])).size !== fields.length) throw new Error('duplicate record field');
      return `record:{${fields.sort((a, b) => a[0].localeCompare(b[0])).map(field => field.join('=')).join(',')}}`;
    }
    default: throw new Error(`unknown value type ${value.t}`);
  }
}

export function createTraceValidator() {
  const runs = new Map();
  let count = 0;
  const accept = (event, label = `record ${count + 1}`) => {
    if (!validateShape(event)) throw new Error(`${label}: ${validateShape.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
    const seq = BigInt(event.seq);
    if (seq > maxSeq) throw new Error(`${label}: seq exceeds u64`);
    let run = runs.get(event.runId);
    if (!run) {
      if (event.kind !== 'snapshot' || seq !== 0n) throw new Error(`${label}: a run must start with snapshot seq 0`);
      run = { nextSeq: 0n, records: new Set(), state: new Map() };
      runs.set(event.runId, run);
    }
    if (seq !== run.nextSeq) throw new Error(`${label}: expected seq ${run.nextSeq}, received ${seq}`);
    if (event.from !== undefined && (!run.records.has(event.from) || BigInt(event.from) >= seq)) throw new Error(`${label}: from must name an earlier record in the same run`);
    for (const segment of event.span) canonical(segment);
    if (event.kind === 'snapshot') {
      const state = new Map();
      for (const field of event.values) {
        if (state.has(field.name)) throw new Error(`${label}: duplicate value name ${field.name}`);
        canonical(field.value);
        state.set(field.name, field.value);
      }
      run.state = state;
    } else {
      const names = new Set();
      const state = new Map(run.state);
      for (const op of event.ops) {
        if (names.has(op.name)) throw new Error(`${label}: multiple operations for ${op.name}`);
        names.add(op.name);
        if (op.op === 'put') { canonical(op.value); state.set(op.name, op.value); }
        else {
          if (!state.has(op.name)) throw new Error(`${label}: cannot drop absent value ${op.name}`);
          state.delete(op.name);
        }
      }
      run.state = state;
    }
    run.records.add(event.seq);
    run.nextSeq = seq + 1n;
    count++;
  };
  const summary = () => ({
    runs: runs.size,
    records: count,
    finalStates: Object.fromEntries([...runs].map(([runId, run]) => [runId, Object.fromEntries(run.state)])),
  });
  return { accept, summary };
}

export function validateTraceLines(lines) {
  const validator = createTraceValidator();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); }
    catch (error) { throw new Error(`line ${index + 1}: invalid JSON: ${error.message}`); }
    validator.accept(event, `line ${index + 1}`);
  }
  return validator.summary();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2] ?? fileURLToPath(new URL('./example.ndjson', import.meta.url));
  try {
    const result = validateTraceLines((await readFile(path, 'utf8')).split('\n'));
    console.log(`${path}: ${result.records} records across ${result.runs} run(s) valid`);
  } catch (error) {
    console.error(`${path}: ${error.message}`);
    process.exitCode = 1;
  }
}
