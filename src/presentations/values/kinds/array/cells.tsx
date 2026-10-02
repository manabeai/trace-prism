import { For, Show } from 'solid-js';
import { IconBrackets } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import { changesAffectPath } from '../../../../trace/diff';
import { isMatrix, isNumericArray } from '../../../value-shapes';
import type { ValueFormat, ValueOf } from '../../contract';

export const arrayCellsFormat = {
  id: 'cells',
  label: (value) => (isNumericArray(value) ? 'Numbers' : 'Cells'),
  icon: IconBrackets,
  isApplicable: (value) => !isMatrix(value),
  render: (value, changes) => (
    <div class="dg-array">
      <For each={value.items}>
        {(item, index) => (
          <span
            title={valueText(item)}
            classList={{ 'is-updated': changesAffectPath(changes, [{ kind: 'index', index: index() }]) }}
          >
            {valueText(item)}
          </span>
        )}
      </For>
      <Show when={!value.items.length}>
        <code>[]</code>
      </Show>
    </div>
  ),
} satisfies ValueFormat<ValueOf<'array'>>;
