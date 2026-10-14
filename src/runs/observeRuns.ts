import type { DecodedRuns } from '../trace/decode';
import type { RunRepository } from './RunRepository';
import { pollRuns } from './pollRuns';

type Observation = { stop: () => void; refresh: () => void };

export function observeRuns(
  repository: RunRepository,
  selectedId: () => string | null,
  onRuns: (result: DecodedRuns) => void,
  onError: (error: unknown) => void,
): Observation {
  let stopped = false;
  let current: Observation | undefined;
  let unwatch: (() => void) | undefined;

  const refresh = () => {
    if (stopped) return;
    current?.refresh();
  };

  const start = (intervalMs: number | null) => {
    if (stopped) return;
    current = pollRuns(repository, selectedId, onRuns, onError, intervalMs);
  };

  if (repository.watch) {
    void repository.watch(refresh).then(
      (stopWatching) => {
        if (stopped) {
          stopWatching();
          return;
        }
        unwatch = stopWatching;
        start(null);
      },
      () => start(1000),
    );
  } else {
    start(1000);
  }

  return {
    refresh,
    stop: () => {
      stopped = true;
      current?.stop();
      unwatch?.();
    },
  };
}
