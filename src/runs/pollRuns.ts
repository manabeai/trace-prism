import type { DecodedRuns } from '../trace/decode';
import type { RunRepository } from './RunRepository';

export function pollRuns(
  repository: RunRepository,
  selectedId: () => string | null,
  onRuns: (result: DecodedRuns) => void,
  onError: (error: unknown) => void,
  intervalMs = 1000,
): { stop: () => void; refresh: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  let refreshPending = false;

  const tick = async () => {
    if (stopped || request) return;
    timer = undefined;
    const controller = new AbortController();
    request = controller;
    try {
      const result = await repository.list(selectedId(), controller.signal);
      if (!stopped && !controller.signal.aborted) onRuns(result);
    } catch (error) {
      if (!stopped && !controller.signal.aborted) onError(error);
    } finally {
      request = undefined;
      if (!stopped) {
        timer = setTimeout(() => void tick(), refreshPending ? 0 : intervalMs);
        refreshPending = false;
      }
    }
  };

  void tick();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      request?.abort();
    },
    refresh: () => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      if (request) {
        request.abort();
        refreshPending = true;
      } else {
        void tick();
      }
    },
  };
}
