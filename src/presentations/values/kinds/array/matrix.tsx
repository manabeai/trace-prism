import { For } from 'solid-js';
import { IconGridDots } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import { isMatrix } from '../../../value-shapes';
import type { ValueFormat, ValueOf } from '../../contract';

export const arrayMatrixFormat = {
  id: 'matrix',
  label: 'Matrix',
  icon: IconGridDots,
  isApplicable: isMatrix,
  render: (value) => (
    <div class="lv-matrix">
      <For each={value.items}>
        {(row) => (
          <div>
            <For each={row.t === 'array' ? row.items : []}>{(item) => <span>{valueText(item)}</span>}</For>
          </div>
        )}
      </For>
    </div>
  ),
} satisfies ValueFormat<ValueOf<'array'>>;
