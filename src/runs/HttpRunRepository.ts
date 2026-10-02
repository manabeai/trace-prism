import { decodeRuns } from '../trace/decode';
import type { DecodedRuns } from '../trace/decode';
import type { RunRepository } from './RunRepository';

export class HttpRunRepository implements RunRepository {
  constructor(private readonly endpoint = '/api/runs') {}

  async list(signal?: AbortSignal): Promise<DecodedRuns> {
    const response = await fetch(this.endpoint, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return decodeRuns((await response.json()) as unknown);
  }
}
