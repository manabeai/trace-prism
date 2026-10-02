import { For, Show } from 'solid-js';
import { IconHash, IconLayoutGrid } from '@tabler/icons-solidjs';
import { valueText } from '../../../trace/value';
import { defineValuePresentation } from '../contract';
import { textFormat } from '../shared';

export const mapPresentation = defineValuePresentation<'map'>({
  kind: 'map',
  formats: [
    {
      id: 'entries',
      label: 'Entries',
      icon: IconLayoutGrid,
      render: (value) => (
        <div class="lv-entries">
          <For each={value.entries}>
            {(entry) => (
              <code>
                <b>{valueText(entry.key)}</b>: {valueText(entry.value)}
              </code>
            )}
          </For>
          <Show when={!value.entries.length}>
            <code>{'{}'}</code>
          </Show>
        </div>
      ),
    },
    {
      id: 'count',
      label: 'Count',
      icon: IconHash,
      render: (value) => <code>{value.entries.length} entries</code>,
    },
  ],
  fallback: textFormat(),
});
