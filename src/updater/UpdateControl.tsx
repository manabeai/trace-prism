import { isTauri } from '@tauri-apps/api/core';
import { IconDownload, IconRefresh } from '@tabler/icons-solidjs';
import { createSignal, onMount, Show, untrack } from 'solid-js';
import {
  supportsInAppUpdates,
  tauriUpdateService,
  type AvailableUpdate,
  type UpdateService,
} from './update-service';

type State = 'checking' | 'current' | 'available' | 'installing' | 'check-error' | 'install-error';

export function UpdateControl(props: { service?: UpdateService }) {
  const service = () => props.service ?? tauriUpdateService;
  const enabled = () => Boolean(props.service) || isTauri();
  const [manualInstall, setManualInstall] = createSignal(false);
  const [state, setState] = createSignal<State>('checking');
  const [update, setUpdate] = createSignal<AvailableUpdate | null>(null);
  const [error, setError] = createSignal('');

  const checkForUpdate = async () => {
    setState('checking');
    setError('');
    try {
      const available = await service().check();
      setUpdate(available);
      setState(available ? 'available' : 'current');
    } catch (cause) {
      setError(String(cause));
      setState('check-error');
    }
  };

  const installUpdate = async () => {
    const available = update();
    if (!available) return;
    setState('installing');
    setError('');
    try {
      await available.downloadAndInstall();
      await service().relaunch();
    } catch (cause) {
      setError(String(cause));
      setState('install-error');
    }
  };

  onMount(() => {
    if (!enabled()) return;
    void service()
      .bundleType()
      .then(
        (bundleType) => {
          if (!supportsInAppUpdates(bundleType)) {
            setManualInstall(true);
            return;
          }
          void untrack(checkForUpdate);
        },
        (cause) => {
          setError(String(cause));
          setState('check-error');
        },
      );
  });

  const label = () => {
    switch (state()) {
      case 'checking':
        return '更新を確認中';
      case 'current':
        return '最新版';
      case 'available':
        return `${update()?.version} に更新`;
      case 'installing':
        return '更新を適用中';
      case 'check-error':
        return '更新確認を再試行';
      case 'install-error':
        return '更新を再試行';
    }
  };

  return (
    <Show when={enabled()}>
      <Show
        when={!manualInstall()}
        fallback={
          <a class="dg-update-control" href="https://github.com/manabeai/trace-prism/releases">
            <IconDownload size="14" />
            更新版を入手
          </a>
        }
      >
        <button
          class="dg-update-control"
          type="button"
          disabled={state() === 'checking' || state() === 'installing'}
          title={error() || undefined}
          aria-live="polite"
          onClick={() =>
            void (state() === 'available' || state() === 'install-error' ? installUpdate() : checkForUpdate())
          }
        >
          <Show
            when={state() === 'available' || state() === 'install-error'}
            fallback={<IconRefresh size="14" />}
          >
            <IconDownload size="14" />
          </Show>
          {label()}
        </button>
      </Show>
    </Show>
  );
}
