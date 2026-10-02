import { For, Show } from 'solid-js';
import { IconBrackets } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import type { ValueFormat, ValueOf } from '../../contract';

export const setCellsFormat = {
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
} satisfies ValueFormat<ValueOf<'set'>>;
