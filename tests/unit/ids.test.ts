import { describe, expect, it } from 'vitest';
import { runId, seqId, valueColumnId, valueName, viewInstanceId, algoColumnId } from '../../src/trace/ids';

describe('trace IDs', () => {
  it('validates canonical wire identities before branding', () => {
    expect(runId('run_1')).toBe('run_1');
    expect(() => runId('../run')).toThrow();
    expect(seqId('18446744073709551615')).toBe('18446744073709551615');
    expect(() => seqId('01')).toThrow();
    expect(() => seqId('18446744073709551616')).toThrow();
  });

  it('keeps raw value columns and Algo View columns disjoint', () => {
    expect(valueColumnId(valueName('a'))).toBe('value:a');
    expect(algoColumnId(viewInstanceId('1'))).toBe('algo:1');
  });
});
