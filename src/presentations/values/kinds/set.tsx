import { For, Show } from 'solid-js';
import { IconBrackets, IconHash } from '@tabler/icons-solidjs';
import { valueText } from '../../../trace/value';
import { defineValuePresentation } from '../contract';
import { textFormat } from '../shared';

export const setPresentation = defineValuePresentation<'set'>({
  kind: 'set',
  formats: [
    {
      id: 'cells',
      label: 'Members',
      icon: IconBrackets,
      render: (value) => (
        <div class="dg-set">
          <For each={value.items}>{(item) => <span title={valueText(item)}>{valueText(item)}</span>}</For>
          <Show when={!value.items.length}>
            <code>∅</code>
          </Show>
        </div>
      ),
    },
    {
      id: 'count',
      label: 'Count',
      icon: IconHash,
      render: (value) => <code>{value.items.length} items</code>,
    },
  ],
  fallback: textFormat(),
});
