import type { DecodedRuns } from '../trace/decode';
import type { RunRepository } from './RunRepository';

export function pollRuns(
  repository: RunRepository,
  onRuns: (result: DecodedRuns) => void,
  onError: (error: unknown) => void,
  intervalMs = 1000,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;

  const tick = async () => {
    request = new AbortController();
    try {
      const result = await repository.list(request.signal);
      if (!stopped) onRuns(result);
    } catch (error) {
      if (!stopped) onError(error);
    } finally {
      request = undefined;
      if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
    }
  };

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    request?.abort();
  };
}
