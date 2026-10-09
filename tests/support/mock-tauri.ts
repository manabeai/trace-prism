import type { Page } from '@playwright/test';

type MockTauriWindow = Window & {
  __TAURI_INTERNALS__: { invoke: (command: string) => Promise<unknown> };
  __traceprismListRunsCalls: number;
};

export async function mockRuns(page: Page, runs: unknown[]): Promise<void> {
  await page.addInitScript((sampleRuns) => {
    const nativeWindow = window as MockTauriWindow;
    nativeWindow.__traceprismListRunsCalls = 0;
    nativeWindow.__TAURI_INTERNALS__ = {
      invoke: async (command) => {
        if (command === 'plugin:app|bundle_type') return 'appimage';
        if (command === 'plugin:updater|check') return null;
        if (command !== 'list_runs') throw new Error(`Unexpected Tauri command: ${command}`);
        nativeWindow.__traceprismListRunsCalls += 1;
        return { runs: sampleRuns };
      },
    };
  }, runs);
}
