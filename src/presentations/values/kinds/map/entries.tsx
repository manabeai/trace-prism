import { For, Show } from 'solid-js';
import { IconLayoutGrid } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import { changesAffectPath, matchesAffectPath } from '../../../../trace/diff';
import type { ValueFormat, ValueOf } from '../../contract';

export const mapEntriesFormat = {
  id: 'entries',
  label: 'Entries',
  icon: IconLayoutGrid,
  render: (value, changes, matches) => (
    <div class="lv-entries">
      <For each={value.entries}>
        {(entry) => (
          <code
            classList={{
              'is-updated': changesAffectPath(changes, [{ kind: 'key', key: entry.key }]),
              'is-search-match': matchesAffectPath(matches, [{ kind: 'key', key: entry.key }]),
            }}
          >
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
