import { createMemo, For, Show } from 'solid-js';
import { IconGridDots } from '@tabler/icons-solidjs';
import { roleAccepts, type CompositeViewDefinition } from '../contract';
import { isMatrix, isPosition, numberOf } from '../../value-shapes';
import { valueText } from '../../../trace/value';

export const gridPosition: CompositeViewDefinition = {
  id: 'grid',
  name: 'Grid & position',
  description: 'Show a matrix with one highlighted position.',
  summary: 'Matrix + position',
  roles: [
    {
      name: 'board',
      shape: 'matrix',
      accepts: roleAccepts.matrix,
      previewHint: 'Changes the grid cells and walls.',
    },
    {
      name: 'position',
      shape: 'position',
      accepts: roleAccepts.position,
      previewHint: 'Moves the highlighted cell.',
    },
  ],
  preview: {
    board: {
      t: 'array',
      items: [
        [0, 0, 1, 0],
        [1, 0, 1, 0],
        [0, 0, 0, 0],
        [0, 1, 0, 1],
      ].map((row) => ({
        t: 'array' as const,
        items: row.map((cell) => ({ t: 'int' as const, v: String(cell) })),
      })),
    },
    position: {
      t: 'array',
      items: [
        { t: 'int', v: '2' },
        { t: 'int', v: '1' },
      ],
    },
  },
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
        <div
          class="dg-grid-view"
          tabIndex={props.inTable ? 0 : undefined}
          role={props.inTable ? 'group' : undefined}
          aria-label={
            props.inTable ? `Grid, current position ${coordinates()[0]}, ${coordinates()[1]}` : undefined
          }
        >
          <div class="dg-mini-grid" data-view-role="board" style={{ '--grid-columns': String(width()) }}>
            <For each={rows()}>
              {(line, y) => (
                <For each={line.t === 'array' ? line.items : []}>
                  {(cell, x) => (
                    <span
                      classList={{
                        wall: numberOf(cell) === 1,
                        current: coordinates()[0] === y() && coordinates()[1] === x(),
                      }}
                      data-view-role={
                        coordinates()[0] === y() && coordinates()[1] === x() ? 'position' : undefined
                      }
                      title={valueText(cell)}
                    />
                  )}
                </For>
              )}
            </For>
          </div>
          <code data-view-role="position">
            ({coordinates()[0]}, {coordinates()[1]})
          </code>
        </div>
      </Show>
    );
  },
};
