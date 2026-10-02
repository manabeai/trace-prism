import { For, Show } from 'solid-js';
import { IconBrackets, IconChartBar, IconGridDots } from '@tabler/icons-solidjs';
import { valueText } from '../../../trace/value';
import { isMatrix, isNumericArray, numberOf } from '../../value-shapes';
import { defineValuePresentation } from '../contract';
import { textFormat } from '../shared';

export const arrayPresentation = defineValuePresentation<'array'>({
  kind: 'array',
  formats: [
    {
      id: 'matrix',
      label: 'Matrix',
      icon: IconGridDots,
      isApplicable: isMatrix,
      render: (value) => (
        <div class="lv-matrix">
          <For each={value.items}>
            {(row) => (
              <div>
                <For each={row.t === 'array' ? row.items : []}>
                  {(item) => <span>{valueText(item)}</span>}
                </For>
              </div>
            )}
          </For>
        </div>
      ),
    },
    {
      id: 'cells',
      label: (value) => (isNumericArray(value) ? 'Numbers' : 'Cells'),
      icon: IconBrackets,
      isApplicable: (value) => !isMatrix(value),
      render: (value) => (
        <div class="dg-array">
          <For each={value.items}>{(item) => <span title={valueText(item)}>{valueText(item)}</span>}</For>
          <Show when={!value.items.length}>
            <code>[]</code>
          </Show>
        </div>
      ),
    },
    {
      id: 'bars',
      label: 'Bars',
      icon: IconChartBar,
      isApplicable: isNumericArray,
      render: (value) => {
        const max = Math.max(1, ...value.items.map((item) => Math.abs(numberOf(item))));
        return (
          <div class="dg-bars" aria-label={valueText(value)}>
            <For each={value.items}>
              {(item) => (
                <span class="dg-bar-item">
                  <i style={{ height: `${Math.max(5, (Math.abs(numberOf(item)) / max) * 34)}px` }} />
                  <small>{valueText(item)}</small>
                </span>
              )}
            </For>
          </div>
        );
      },
    },
  ],
  fallback: textFormat(),
});
