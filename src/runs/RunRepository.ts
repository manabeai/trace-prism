import type { DecodedRuns } from '../trace/decode';

export interface RunRepository {
  list(selectedId: string | null, signal?: AbortSignal): Promise<DecodedRuns>;
}
