import { For } from 'solid-js';
import { IconGridDots } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import { changesAffectPath, matchesAffectPath } from '../../../../trace/diff';
import { isMatrix } from '../../../value-shapes';
import type { ValueFormat, ValueOf } from '../../contract';

export const arrayMatrixFormat = {
  id: 'matrix',
  label: 'Matrix',
  icon: IconGridDots,
  isApplicable: isMatrix,
  render: (value, changes, matches) => (
    <div class="lv-matrix">
      <For each={value.items}>
        {(row, rowIndex) => (
          <div>
            <For each={row.t === 'array' ? row.items : []}>
              {(item, columnIndex) => (
                <span
                  classList={{
                    'is-updated': changesAffectPath(changes, [
                      { kind: 'index', index: rowIndex() },
                      { kind: 'index', index: columnIndex() },
                    ]),
                    'is-search-match': matchesAffectPath(matches, [
                      { kind: 'index', index: rowIndex() },
                      { kind: 'index', index: columnIndex() },
                    ]),
                  }}
                >
                  {valueText(item)}
                </span>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  ),
} satisfies ValueFormat<ValueOf<'array'>>;
