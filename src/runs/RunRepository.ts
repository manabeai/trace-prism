import type { DecodedRuns } from '../trace/decode';

export interface RunRepository {
  list(signal?: AbortSignal): Promise<DecodedRuns>;
}
