import { createMemo, For, Show } from 'solid-js';
import { IconGridDots } from '@tabler/icons-solidjs';
import type { AlgoViewDefinition } from '../contract';
import { isMatrix, isPosition, numberOf } from '../../value-shapes';
import { valueText } from '../../../trace/value';

export const gridTraversal: AlgoViewDefinition = {
  id: 'grid',
  name: 'Grid traversal',
  description: 'Current position over the recorded grid.',
  summary: 'Grid with current position',
  roles: [
    { name: 'board', shape: 'matrix' },
    { name: 'position', shape: 'position' },
  ],
  icon: IconGridDots,
  component: (props) => {
    const board = createMemo(() => props.frame.values[props.view.bindings.board]?.value);
    const position = createMemo(() => props.frame.values[props.view.bindings.position]?.value);
    const rows = createMemo(() => {
      const value = board();
      return value && isMatrix(value) ? value.items : [];
    });
    const coordinates = createMemo(() => {
      const value = position();
      return value && isPosition(value) ? [numberOf(value.items[0]), numberOf(value.items[1])] : [NaN, NaN];
    });
    const valid = createMemo(() => rows().length > 0 && coordinates().every(Number.isFinite));
    const width = createMemo(() => {
      const first = rows()[0];
      return first?.t === 'array' ? first.items.length : 1;
    });
    return (
      <Show when={valid()} fallback={<span class="dg-quiet">—</span>}>
        <div class="dg-grid-view">
          <div class="dg-mini-grid" style={{ '--grid-columns': String(width()) }}>
            <For each={rows()}>
              {(line, y) => (
                <For each={line.t === 'array' ? line.items : []}>
                  {(cell, x) => (
                    <span
                      classList={{
                        wall: numberOf(cell) === 1,
                        current: coordinates()[0] === y() && coordinates()[1] === x(),
                      }}
                      title={valueText(cell)}
                    />
                  )}
                </For>
              )}
            </For>
          </div>
          <code>
            ({coordinates()[0]}, {coordinates()[1]})
          </code>
        </div>
      </Show>
    );
  },
};
