import { createMemo, For, Show } from 'solid-js';
import { IconGitBranch } from '@tabler/icons-solidjs';
import type { AlgoViewDefinition } from '../contract';
import { numberOf } from '../../value-shapes';

export const binarySearch: AlgoViewDefinition = {
  id: 'binary',
  name: 'Binary search',
  description: 'Bounds, midpoint, and predicate at every record.',
  summary: 'Bounds, midpoint, predicate',
  roles: [
    { name: 'left', shape: 'int' },
    { name: 'right', shape: 'int' },
    { name: 'mid', shape: 'int' },
    { name: 'predicate', shape: 'bool' },
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
                >
                  <small>{index}</small>
                </span>
              )}
            </For>
          </div>
          <div class="dg-binary-readout">
            <code>
              L {left()} · M {mid()} · R {right()}
            </code>
            <span
              class="dg-bool"
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
