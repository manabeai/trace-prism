import { invoke } from '@tauri-apps/api/core';
import { decodeRuns } from '../trace/decode';
import type { DecodedRuns } from '../trace/decode';
import type { RunRepository } from './RunRepository';

export class TauriRunRepository implements RunRepository {
  async list(signal?: AbortSignal): Promise<DecodedRuns> {
    signal?.throwIfAborted();
    const response = await invoke<unknown>('list_runs');
    signal?.throwIfAborted();
    const decoded = decodeRuns(response);
    if (response && typeof response === 'object' && 'errors' in response && Array.isArray(response.errors)) {
      decoded.errors.push(...response.errors.filter((error): error is string => typeof error === 'string'));
    }
    return decoded;
  }
}
