import { For, Show } from 'solid-js';
import { IconLayoutGrid } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import type { ValueFormat, ValueOf } from '../../contract';

export const mapEntriesFormat = {
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
} satisfies ValueFormat<ValueOf<'map'>>;
