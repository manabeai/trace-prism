import { createMemo, For, Show } from 'solid-js';
import { IconGitBranch } from '@tabler/icons-solidjs';
import type { AlgoViewDefinition } from '../contract';
import { numberOf } from '../../value-shapes';

export const binarySearch: AlgoViewDefinition = {
  id: 'binary',
  name: 'Range & marker',
  description: 'Show a numeric range, its marker, and a true or false value.',
  summary: 'Two bounds + marker + condition',
  roles: [
    { name: 'left', shape: 'int', previewHint: 'Moves the start of the highlighted range.' },
    { name: 'right', shape: 'int', previewHint: 'Moves the end of the highlighted range.' },
    { name: 'mid', shape: 'int', previewHint: 'Moves the marker.' },
    { name: 'predicate', shape: 'bool', previewHint: 'Changes the true or false indicator.' },
  ],
  icon: IconGitBranch,
  component: (props) => {
    const bound = (role: string) => props.frame.values[props.view.bindings[role]]?.value;
    const left = createMemo(() => numberOf(bound('left')));
    const right = createMemo(() => numberOf(bound('right')));
    const mid = createMemo(() => numberOf(bound('mid')));
    const predicate = createMemo(() => bound('predicate'));
    const predicateValue = createMemo(() => {
      const value = predicate();
      return value?.t === 'bool' ? value.v : undefined;
    });
    const width = createMemo(() => Math.min(24, Math.max(1, right())));
    const ready = createMemo(() => [left(), right(), mid()].every(Number.isFinite));
    return (
      <Show when={ready()} fallback={<span class="dg-quiet">—</span>}>
        <div class="dg-binary-view" aria-label={`left ${left()}, right ${right()}, mid ${mid()}`}>
          <div class="dg-binary-track">
            <For each={Array.from({ length: width() }, (_, index) => index)}>
              {(index) => (
                <span
                  classList={{ 'in-range': index >= left() && index < right(), 'is-mid': index === mid() }}
                  data-view-role={
                    [index === left() && 'left', index === right() - 1 && 'right', index === mid() && 'mid']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  <small>{index}</small>
                </span>
              )}
            </For>
          </div>
          <div class="dg-binary-readout">
            <code>
              <span data-view-role="left">L {left()}</span> · <span data-view-role="mid">M {mid()}</span> ·{' '}
              <span data-view-role="right">R {right()}</span>
            </code>
            <span
              class="dg-bool"
              data-view-role="predicate"
              classList={{
                'is-true': predicateValue() === true,
                'is-false': predicateValue() === false,
              }}
            >
              {predicateValue() === undefined ? 'pending' : String(predicateValue())}
            </span>
          </div>
        </div>
      </Show>
    );
  },
};
