import type { Page } from '@playwright/test';

type MockTauriWindow = Window & {
  __TAURI_INTERNALS__: {
    invoke: (command: string, args?: { selectedId?: string | null }) => Promise<unknown>;
  };
  __traceprismListRunsCalls: number;
  __traceprismSampleRuns: unknown[];
};

export async function mockRuns(page: Page, runs: unknown[]): Promise<void> {
  await page.addInitScript((sampleRuns) => {
    const nativeWindow = window as MockTauriWindow;
    nativeWindow.__traceprismListRunsCalls = 0;
    nativeWindow.__traceprismSampleRuns = sampleRuns;
    nativeWindow.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        if (command === 'plugin:app|bundle_type') return 'appimage';
        if (command === 'plugin:updater|check') return null;
        if (command !== 'list_runs') throw new Error(`Unexpected Tauri command: ${command}`);
        nativeWindow.__traceprismListRunsCalls += 1;
        const selectedId = args?.selectedId ?? (sampleRuns[0] as { id?: string } | undefined)?.id;
        return {
          runs: sampleRuns.map((run) => {
            if (!run || typeof run !== 'object' || Array.isArray(run)) return run;
            const item = run as Record<string, unknown>;
            return item.id === selectedId
              ? { ...item, loaded: true }
              : { ...item, loaded: false, frames: [] };
          }),
        };
      },
    };
  }, runs);
}
