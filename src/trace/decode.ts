import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../protocol/v2/trace.schema.json';
import type { Run, TraceRecord } from './types';
import { runId } from './ids';

const validateV2 = new Ajv2020({ allErrors: true }).compile(schema);
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function decodeRecord(input: unknown, runId: string): TraceRecord {
  if (!isObject(input)) throw new Error('record must be an object');
  if (input.format === 'viz.trace/v2') {
    if (!validateV2(input))
      throw new Error(`invalid v2 record: ${validateV2.errors?.map((error) => error.message).join(', ')}`);
    if (input.runId !== runId) throw new Error('record belongs to another run');
    return input as TraceRecord;
  }
  // Saved v1 observations have partial values and are normalized by materialize().
  if (typeof input.seq !== 'string' || !Array.isArray(input.span) || !Array.isArray(input.values)) {
    throw new Error('invalid legacy record');
  }
  return input as TraceRecord;
}

function decodeRun(input: unknown): Run {
  if (
    !isObject(input) ||
    typeof input.id !== 'string' ||
    !input.id ||
    typeof input.source !== 'string' ||
    typeof input.input !== 'string' ||
    typeof input.startedAt !== 'string' ||
    typeof input.durationMs !== 'number' ||
    !['running', 'completed', 'interrupted'].includes(String(input.status)) ||
    !Array.isArray(input.frames)
  )
    throw new Error('invalid run metadata');
  return {
    id: runId(input.id),
    source: input.source,
    input: input.input,
    startedAt: input.startedAt,
    durationMs: input.durationMs,
    status: input.status as Run['status'],
    frames: input.frames.map((frame) => decodeRecord(frame, input.id as string)),
  };
}

export type DecodedRuns = { runs: Run[]; errors: string[] };

export function decodeRuns(input: unknown): DecodedRuns {
  if (!isObject(input) || !Array.isArray(input.runs)) throw new Error('invalid runs response');
  const runs: Run[] = [];
  const errors: string[] = [];
  for (const [index, item] of input.runs.entries()) {
    try {
      runs.push(decodeRun(item));
    } catch (cause) {
      errors.push(`run ${index + 1}: ${String(cause)}`);
    }
  }
  return { runs, errors };
}
