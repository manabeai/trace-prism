import { invoke } from '@tauri-apps/api/core';
import { watch } from '@tauri-apps/plugin-fs';
import { decodeRuns } from '../trace/decode';
import type { DecodedRuns } from '../trace/decode';
import type { RunRepository } from './RunRepository';

export class TauriRunRepository implements RunRepository {
  async watch(onChange: () => void): Promise<() => void> {
    const directory = await invoke<string>('watch_runs_dir');
    return watch(directory, onChange, { delayMs: 250, recursive: false });
  }

  async list(selectedId: string | null, signal?: AbortSignal): Promise<DecodedRuns> {
    signal?.throwIfAborted();
    const response = await invoke<unknown>('list_runs', { selectedId });
    signal?.throwIfAborted();
    const decoded = decodeRuns(response);
    if (response && typeof response === 'object' && 'errors' in response && Array.isArray(response.errors)) {
      decoded.errors.push(...response.errors.filter((error): error is string => typeof error === 'string'));
    }
    return decoded;
  }
}
