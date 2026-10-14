import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { IconBinaryTree, IconGitBranch } from '@tabler/icons-solidjs';
import type { Graph, GraphNode } from '../../trace/types';
import type { Seq } from '../../trace/ids';
import type { SearchResults } from '../../search/evaluate';

function containsSeq(node: GraphNode | undefined, seq: Seq | undefined): boolean {
  return seq !== undefined && Boolean(node && (node.seq === seq || node.seqs?.includes(seq)));
}

function hasSearchHit(node: GraphNode | undefined, results: SearchResults): boolean {
  return Boolean(
    node &&
    ((node.seq !== undefined && results.bySeq.has(node.seq)) ||
      node.seqs?.some((seq) => results.bySeq.has(seq))),
  );
}

export function RelationGraph(props: {
  graph: Graph;
  runId: string;
  selectedSeq?: Seq;
  select: (seq: Seq) => void;
  canSwitch: boolean;
  switchMode: () => void;
  search: SearchResults;
}) {
  const [zoom, setZoom] = createSignal(100);
  let viewport: HTMLDivElement | undefined;
  let lastFocus = '';
  const nodes = createMemo(() => new Map(props.graph.nodes.map((node) => [node.id, node])));
  const focusSelected = (behavior: ScrollBehavior, force = false) => {
    const node = props.graph.nodes.find((item) => containsSeq(item, props.selectedSeq));
    const scale = zoom() / 100;
    const focus = node ? `${props.runId}:${node.id}:${node.x}:${node.y}:${scale}` : '';
    if (!node || !viewport || (!force && focus === lastFocus)) return;
    viewport.scrollTo({
      left: node.x * scale - viewport.clientWidth / 2,
      top: node.y * scale - viewport.clientHeight / 2,
      behavior,
    });
    lastFocus = focus;
  };
  createEffect(() => focusSelected(lastFocus ? 'smooth' : 'instant'));
  onMount(() => {
    if (!viewport) return;
    const observer = new ResizeObserver(() => focusSelected('instant', true));
    observer.observe(viewport);
    onCleanup(() => observer.disconnect());
  });
  const endpoint = (id: string): GraphNode => nodes().get(id)!;
  const edgePath = (from: string, to: string) => {
    const a = endpoint(from),
      b = endpoint(to),
      middle = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y + 18} C ${a.x} ${middle}, ${b.x} ${middle}, ${b.x} ${b.y - 18}`;
  };
  return (
    <section class="dg-graph" aria-label="Record relation graph">
      <div class="dg-graph-meta">
        <div>
          <strong>{props.graph.mode === 'transition' ? 'Transition graph' : 'Span hierarchy'}</strong>
          <span>
            {props.graph.mode === 'transition'
              ? 'Edges follow explicit from references'
              : 'IDs follow span prefixes'}
          </span>
          <Show when={props.canSwitch}>
            <button
              class="dg-graph-mode-switch"
              type="button"
              aria-label={props.graph.mode === 'transition' ? 'Show ID hierarchy' : 'Show from links'}
              onClick={() => props.switchMode()}
            >
              <Show when={props.graph.mode === 'transition'} fallback={<IconGitBranch size="15" />}>
                <IconBinaryTree size="15" />
              </Show>
              {props.graph.mode === 'transition' ? 'ID tree' : 'From links'}
            </button>
          </Show>
        </div>
        <label>
          Zoom{' '}
          <input
            type="range"
            min="70"
            max="140"
            value={zoom()}
            onInput={(event) => setZoom(Number(event.currentTarget.value))}
          />
          <output>{zoom()}%</output>
        </label>
      </div>
      <div class="dg-graph-scroll" ref={viewport}>
        <svg
          viewBox={`0 0 ${props.graph.width} ${props.graph.height}`}
          style={{
            width: `${(props.graph.width * zoom()) / 100}px`,
            height: `${(props.graph.height * zoom()) / 100}px`,
          }}
          role="group"
          aria-label="Record relations"
        >
          <For each={props.graph.edges}>
            {(edge) => (
              <path
                class="dg-graph-edge"
                classList={{
                  'is-selected': containsSeq(nodes().get(edge.to), props.selectedSeq),
                  'is-search-dim': props.search.active && !hasSearchHit(nodes().get(edge.to), props.search),
                }}
                d={edgePath(edge.from, edge.to)}
              />
            )}
          </For>
          <For each={props.graph.nodes}>
            {(node) => (
              <g
                class="dg-graph-node"
                classList={{
                  'is-span': node.kind === 'span',
                  'is-selected': containsSeq(node, props.selectedSeq),
                  'is-actionable': node.seq !== undefined,
                  'is-search-dim': props.search.active && !hasSearchHit(node, props.search),
                  'is-search-hit':
                    props.search.active && Boolean(node.seq && props.search.bySeq.has(node.seq)),
                }}
                transform={`translate(${node.x} ${node.y})`}
                role={node.seq !== undefined ? 'button' : undefined}
                tabindex={node.seq !== undefined ? 0 : undefined}
                aria-label={
                  node.seq !== undefined ? `Record ${node.seq}, span ${node.detail}` : `Span ${node.detail}`
                }
                onClick={() => node.seq !== undefined && props.select(node.seq)}
                onKeyDown={(event) => {
                  if (node.seq !== undefined && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    props.select(node.seq);
                  }
                }}
              >
                <circle r={node.kind === 'span' ? 23 : 18} />
                <text text-anchor="middle" dominant-baseline="central">
                  {node.label}
                </text>
                <title>{node.detail}</title>
              </g>
            )}
          </For>
        </svg>
      </div>
      <div class="dg-graph-legend">
        <span>
          <i class="dg-legend-span" />
          span
        </span>
        <span>
          <i class="dg-legend-record" />
          record
        </span>
        <span>
          <i class="dg-legend-current" />
          selected
        </span>
      </div>
    </section>
  );
}
