import { For } from 'solid-js';
import { IconChartBar } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import { changesAffectPath, matchesAffectPath } from '../../../../trace/diff';
import { isNumericArray, numberOf } from '../../../value-shapes';
import type { ValueFormat, ValueOf } from '../../contract';

export const arrayBarsFormat = {
  id: 'bars',
  label: 'Bars',
  icon: IconChartBar,
  isApplicable: isNumericArray,
  render: (value, changes, matches) => {
    const max = Math.max(1, ...value.items.map((item) => Math.abs(numberOf(item))));
    return (
      <div class="dg-bars" aria-label={valueText(value)}>
        <For each={value.items}>
          {(item, index) => (
            <span
              class="dg-bar-item"
              classList={{
                'is-search-match': matchesAffectPath(matches, [{ kind: 'index', index: index() }]),
              }}
            >
              <i
                style={{ height: `${Math.max(5, (Math.abs(numberOf(item)) / max) * 34)}px` }}
                classList={{ 'is-changed': changesAffectPath(changes, [{ kind: 'index', index: index() }]) }}
              />
              <small>{valueText(item)}</small>
            </span>
          )}
        </For>
      </div>
    );
  },
} satisfies ValueFormat<ValueOf<'array'>>;
