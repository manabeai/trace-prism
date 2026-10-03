import { createMemo, createUniqueId, For, Show } from 'solid-js';
import { IconSitemap } from '@tabler/icons-solidjs';
import type { Value } from '../../../trace/types';
import { isBooleanArray, isIntegerSet } from '../../value-shapes';
import type { AlgoViewDefinition } from '../contract';
import styles from './adjacency-graph.module.css';

type Adjacency = number[][];
type Point = { x: number; y: number };

function vertexIndex(value: Value): number | undefined {
  if (value.t !== 'int') return undefined;
  const index = Number(value.v);
  return Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}

function adjacencyOf(value: Value | undefined): Adjacency | undefined {
  if (value?.t !== 'array') return undefined;
  const count = value.items.length;
  const rows: Adjacency = [];
  for (const row of value.items) {
    if (row.t !== 'array') return undefined;
    const neighbors: number[] = [];
    for (const item of row.items) {
      const index = vertexIndex(item);
      if (index === undefined || index >= count) return undefined;
      neighbors.push(index);
    }
    rows.push(neighbors);
  }
  return rows;
}

function point(index: number, count: number): Point {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(1, count);
  return { x: 128 + 99 * Math.cos(angle), y: 94 + 68 * Math.sin(angle) };
}

export const adjacencyGraph: AlgoViewDefinition = {
  id: 'graph',
  name: 'Graph',
  description:
    'Draw an adjacency list; optionally mark visited vertices from a bool array or set, and the current vertex.',
  summary: 'Adjacency list with optional visited and current vertex',
  roles: [
    { name: 'adjacency', shape: 'array', preferredNames: ['graph', 'g'] },
    { name: 'visited', shape: 'visited', optional: true, preferredNames: ['seen'] },
    { name: 'v', shape: 'int', optional: true, preferredNames: ['u', 'current'] },
  ],
  icon: IconSitemap,
  component: (props) => {
    const arrowId = createUniqueId();
    const bound = (role: string) => props.frame.values[props.view.bindings[role]]?.value;
    const adjacency = createMemo(() => adjacencyOf(bound('adjacency')));
    const current = createMemo(() => {
      const value = bound('v');
      return value ? vertexIndex(value) : undefined;
    });
    const visited = createMemo(() => {
      const value = bound('visited');
      if (value && isBooleanArray(value))
        return new Set(value.items.flatMap((item, index) => (item.t === 'bool' && item.v ? [index] : [])));
      if (value && isIntegerSet(value))
        return new Set(value.items.flatMap((item) => (item.t === 'int' ? [Number(item.v)] : [])));
      return new Set<number>();
    });
    const visible = createMemo(() => {
      const total = adjacency()?.length ?? 0;
      const indices = Array.from({ length: Math.min(total, 18) }, (_, index) => index);
      const focused = current();
      if (focused !== undefined && focused >= 18 && focused < total) indices[indices.length - 1] = focused;
      return indices;
    });
    const points = createMemo(
      () => new Map(visible().map((index, slot) => [index, point(slot, visible().length)])),
    );
    const edges = createMemo(() =>
      (adjacency() ?? []).flatMap((neighbors, source) =>
        points().has(source)
          ? neighbors.filter((target) => points().has(target)).map((target) => ({ source, target }))
          : [],
      ),
    );
    const edgeCount = createMemo(() => (adjacency() ?? []).reduce((sum, row) => sum + row.length, 0));
    return (
      <Show when={adjacency()} fallback={<span class="dg-quiet">—</span>}>
        <div class={styles.root}>
          <svg
            class={styles.canvas}
            viewBox="0 0 256 188"
            role="img"
            aria-label={`Input graph: ${adjacency()?.length ?? 0} vertices, ${edgeCount()} directed edges${current() !== undefined ? `, current vertex ${current()}` : ''}`}
          >
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 6 6"
                refX="5.5"
                refY="3"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 6 3 L 0 6 z" class={styles.arrow} />
              </marker>
            </defs>
            <For each={edges()}>
              {(edge) => {
                const source = points().get(edge.source)!;
                const target = points().get(edge.target)!;
                if (edge.source === edge.target) {
                  return (
                    <path
                      class={styles.edge}
                      d={`M ${source.x + 9} ${source.y - 10} C ${source.x + 22} ${source.y - 20}, ${source.x - 22} ${source.y - 20}, ${source.x - 9} ${source.y - 10}`}
                      fill="none"
                      marker-end={`url(#${arrowId})`}
                    />
                  );
                }
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const length = Math.hypot(dx, dy) || 1;
                return (
                  <line
                    class={styles.edge}
                    x1={source.x + (dx / length) * 15}
                    y1={source.y + (dy / length) * 15}
                    x2={target.x - (dx / length) * 15}
                    y2={target.y - (dy / length) * 15}
                    marker-end={`url(#${arrowId})`}
                  />
                );
              }}
            </For>
            <For each={visible()}>
              {(index) => {
                const position = points().get(index)!;
                return (
                  <g
                    class={styles.vertex}
                    classList={{
                      [styles.visited]: visited().has(index),
                      [styles.current]: current() === index,
                    }}
                    aria-label={`Vertex ${index}${visited().has(index) ? ', visited' : ''}${current() === index ? ', current' : ''}`}
                    transform={`translate(${position.x} ${position.y})`}
                  >
                    <circle r="13" />
                    <text text-anchor="middle" dominant-baseline="central">
                      {index}
                    </text>
                  </g>
                );
              }}
            </For>
          </svg>
          <div class={styles.meta}>
            <span>
              {adjacency()?.length ?? 0} vertices · {edgeCount()} edges
            </span>
            <Show when={visible().length < (adjacency()?.length ?? 0)}>
              <span>Showing {visible().length}</span>
            </Show>
          </div>
        </div>
      </Show>
    );
  },
};
