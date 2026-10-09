import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeRuns } from '../../src/trace/decode';
import { materialize } from '../../src/trace/materialize';
import { pollRuns } from '../../src/runs/pollRuns';
import type { RunRepository } from '../../src/runs/RunRepository';
import type { DecodedRuns } from '../../src/trace/decode';

const event = JSON.parse(
  readFileSync(new URL('../../protocol/v2/example.ndjson', import.meta.url), 'utf8').split('\n')[0],
);
const run = {
  id: event.runId,
  source: 'binary.rs',
  input: '',
  startedAt: '2026-09-30T09:00:00.000Z',
  durationMs: 0,
  status: 'completed',
  frames: [event],
};

describe('run response boundary', () => {
  it('accepts valid records and isolates a malformed run', () => {
    const result = decodeRuns({ runs: [run, { ...run, id: 'broken' }] });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].frames[0].seq).toBe('0');
    expect(result.errors).toHaveLength(1);
  });

  it('rejects malformed envelopes', () => {
    expect(() => decodeRuns({ runs: {} })).toThrow('invalid runs response');
  });

  it('keeps saved v1 observations readable at the decoding boundary', () => {
    const legacy = {
      ...run,
      id: 'legacy',
      frames: [{ format: 'viz.trace/v1', seq: '0', span: [], values: [{ name: 'a', value: [1, 2] }] }],
    };
    const decoded = decodeRuns({ runs: [legacy] });
    expect(decoded.errors).toEqual([]);
    expect(materialize(decoded.runs[0].frames).frames[0].values.a.value).toEqual({
      t: 'array',
      items: [
        { t: 'int', v: '1' },
        { t: 'int', v: '2' },
      ],
    });
  });
});

afterEach(() => vi.useRealTimers());

describe('run polling', () => {
  it('does not overlap requests and aborts the current request on disposal', async () => {
    vi.useFakeTimers();
    let finish: (value: DecodedRuns) => void = () => undefined;
    const list = vi.fn(
      (_signal?: AbortSignal) =>
        new Promise<DecodedRuns>((resolve) => {
          finish = resolve;
        }),
    );
    const repository: RunRepository = { list };
    const onRuns = vi.fn();
    const stop = pollRuns(repository, onRuns, vi.fn(), 1000);
    expect(list).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(list).toHaveBeenCalledTimes(1);
    finish({ runs: [], errors: [] });
    await vi.advanceTimersByTimeAsync(0);
    expect(onRuns).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(list).toHaveBeenCalledTimes(2);
    const signal = list.mock.calls[1]?.[0];
    stop();
    expect(signal?.aborted).toBe(true);
    finish({ runs: [], errors: [] });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onRuns).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
