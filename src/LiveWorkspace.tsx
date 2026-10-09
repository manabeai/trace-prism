import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import Resizable from '@corvu/resizable';
import { Dialog } from '@kobalte/core/dialog';
import {
  IconBinaryTree,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconEye,
  IconGitBranch,
  IconHistory,
  IconPlus,
  IconSettings,
  IconX,
} from '@tabler/icons-solidjs';
import { spanKey, spanText } from './trace/value';
import type { Graph, GraphNode, HistoryNode } from './trace/types';
import type { Seq } from './trace/ids';
import type { RunRepository } from './runs/RunRepository';
import { formatOptions } from './presentations/values/registry';
import {
  AlgoCell,
  templates,
  validBindings,
  type AlgoView,
  type Template,
} from './presentations/algo/registry';
import { previewFrame, previewViews } from './presentations/algo/preview';
import { createWorkspaceController } from './workspace/controller';
import { BrandMark } from './design/BrandMark';
import { createHistoryTable } from './workspace/history/table-adapter';
import { historyColumnLayout } from './workspace/history/column-layout';
import { FormatMenu } from './workspace/history/FormatMenu';
import { ValueCell } from './workspace/history/ValueCell';
import { SearchEditor } from './workspace/search/SearchEditor';
import type { SearchResults } from './search/evaluate';
import { UpdateControl } from './updater/UpdateControl';

const runTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function ViewPreview(props: { template: Template; activeRole?: string }) {
  const hint = () =>
    templates[props.template].roles.find((role) => role.name === props.activeRole)?.previewHint ??
    templates[props.template].description;
  return (
    <div class="dg-template-preview dg-bind-preview" data-active-role={props.activeRole || undefined}>
      <div class="dg-preview-heading">
        <span>Example preview</span>
        <strong>{templates[props.template].name}</strong>
      </div>
      <div class="dg-preview-canvas">
        <AlgoCell view={previewViews[props.template]} frame={previewFrame} />
      </div>
      <p>{hint()}</p>
    </div>
  );
}

function RelationGraph(props: {
  graph: Graph;
  runId: string;
  selectedSeq: string;
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
    const node = props.graph.nodes.find(
      (item) => item.seq === props.selectedSeq || item.seqs?.includes(props.selectedSeq as Seq),
    );
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
                  'is-selected':
                    nodes().get(edge.to)?.seq === props.selectedSeq ||
                    nodes()
                      .get(edge.to)
                      ?.seqs?.includes(props.selectedSeq as Seq),
                  'is-search-dim':
                    props.search.active &&
                    !(nodes().get(edge.to)?.seq && props.search.bySeq.has(nodes().get(edge.to)!.seq!)) &&
                    !nodes()
                      .get(edge.to)
                      ?.seqs?.some((seq) => props.search.bySeq.has(seq)),
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
                  'is-selected':
                    node.seq === props.selectedSeq || node.seqs?.includes(props.selectedSeq as Seq),
                  'is-actionable': node.seq !== undefined,
                  'is-search-dim':
                    props.search.active &&
                    !(node.seq && props.search.bySeq.has(node.seq)) &&
                    !node.seqs?.some((seq) => props.search.bySeq.has(seq)),
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

export function LiveWorkspace(props: { repository?: RunRepository }) {
  const {
    runs,
    current,
    error,
    warning,
    visible,
    views,
    shownViews,
    collapsed,
    setCollapsed,
    diffOnly,
    setDiffOnly,
    searchQuery,
    setSearchQuery,
    searchText,
    setSearchText,
    searchFieldList,
    searchResults,
    dialogOpen,
    setDialogOpen,
    stage,
    setStage,
    template,
    editingId,
    draft,
    setDraft,
    frames,
    columns,
    shownColumns,
    selectedIndex,
    selected,
    tree,
    graph,
    canSwitchGraph,
    setGraphPreference,
    columnCount,
    chooseRun,
    toggleColumn,
    activeFormat,
    candidates,
    openDialog,
    chooseTemplate,
    saveView,
    toggleView,
    setSelectedSeq,
    setFormats,
  } = createWorkspaceController(untrack(() => props.repository));
  const historyTable = createHistoryTable(tree, collapsed);
  const columnLayout = createMemo(() => historyColumnLayout(shownColumns(), shownViews().length));
  const searchHitSet = createMemo(() => new Set(searchResults().hits));
  const searchTicks = createMemo(() => {
    const all = frames();
    const count = Math.min(all.length, 180);
    if (!count) return [];
    const hits = searchHitSet();
    return Array.from({ length: count }, (_, index) => {
      const from = Math.floor((index * all.length) / count);
      const to = Math.max(from + 1, Math.floor(((index + 1) * all.length) / count));
      return all.slice(from, to).some((frame) => hits.has(frame.seq));
    });
  });
  const [wideSizes, setWideSizes] = createSignal([2 / 3, 1 / 3]);
  const [narrowSizes, setNarrowSizes] = createSignal([0.5, 0.5]);
  const [stacked, setStacked] = createSignal(false);
  const [previewTemplate, setPreviewTemplate] = createSignal<Template>('binary');
  const [highlightedRole, setHighlightedRole] = createSignal<string | null>(null);
  let choosePanel: HTMLDivElement | undefined;
  let bindHeading: HTMLHeadingElement | undefined;
  const openAddView = () => {
    setPreviewTemplate('binary');
    setHighlightedRole(null);
    openDialog();
  };
  const openViewEditor = (view: AlgoView) => {
    setHighlightedRole(null);
    openDialog(view);
  };
  const selectViewLayout = (next: Template) => {
    setHighlightedRole(null);
    chooseTemplate(next);
    queueMicrotask(() => bindHeading?.focus({ preventScroll: true }));
  };
  const returnToLayouts = () => {
    setHighlightedRole(null);
    setStage('choose');
    queueMicrotask(() =>
      choosePanel
        ?.querySelector<HTMLButtonElement>(`[data-template="${template()}"]`)
        ?.focus({ preventScroll: true }),
    );
  };
  const historySizes = () => (stacked() ? narrowSizes() : wideSizes());
  const setHistorySizes = (sizes: number[]) => (stacked() ? setNarrowSizes(sizes) : setWideSizes(sizes));
  onMount(() => {
    const media = window.matchMedia('(max-width: 780px)');
    const update = () => setStacked(media.matches);
    update();
    media.addEventListener('change', update);
    onCleanup(() => media.removeEventListener('change', update));
  });
  let tableViewport: HTMLDivElement | undefined;
  const selectRecord = (seq: Seq | null) => {
    const frame = frames().find((item) => item.seq === seq);
    if (frame) {
      const ancestors = new Set<string>(
        frame.span.map((_, index) => spanKey(frame.span.slice(0, index + 1))),
      );
      if (collapsed().some((key) => ancestors.has(key)))
        setCollapsed((keys) => keys.filter((key) => !ancestors.has(key)));
    }
    setSelectedSeq(seq);
  };
  const focusKey = createMemo(() => `${current()?.id ?? ''}:${selected()?.seq ?? ''}`);
  createEffect(() => {
    const key = focusKey();
    if (key.endsWith(':')) return;
    const frame = requestAnimationFrame(() => {
      if (focusKey() !== key) return;
      const row = tableViewport?.querySelector<HTMLElement>('.dg-frame-row.is-selected');
      if (!row || !tableViewport) return;
      const viewport = tableViewport.getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      const headerHeight = tableViewport.querySelector('thead')?.getBoundingClientRect().height ?? 0;
      const top = viewport.top + headerHeight + 8;
      const bottom = viewport.bottom - 8;
      if (bounds.top < top) tableViewport.scrollTop += bounds.top - top;
      else if (bounds.bottom > bottom) tableViewport.scrollTop += bounds.bottom - bottom;
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });
  const count = (nodes: HistoryNode[]): number =>
    nodes.reduce((sum, node) => sum + (node.kind === 'frame' ? 1 : count(node.children)), 0);
  const renderNode = (node: HistoryNode, depth: number): JSX.Element =>
    node.kind === 'group' ? (
      <>
        <tr class="dg-group-row">
          <td colspan={columnCount()}>
            <button
              style={{ '--depth': String(depth) }}
              aria-expanded={!collapsed().includes(spanKey(node.span))}
              onClick={() =>
                setCollapsed((keys) =>
                  keys.includes(spanKey(node.span))
                    ? keys.filter((key) => key !== spanKey(node.span))
                    : [...keys, spanKey(node.span)],
                )
              }
            >
              <span class="dg-fold">
                <Show
                  when={collapsed().includes(spanKey(node.span))}
                  fallback={<IconChevronDown size="13" />}
                >
                  <IconChevronRight size="13" />
                </Show>
              </span>
              <code>{spanText(node.span)}</code>
              <span>{count(node.children)} records</span>
              <i />
            </button>
          </td>
        </tr>
      </>
    ) : (
      <tr
        class="dg-frame-row"
        classList={{
          'is-selected': selected()?.seq === node.frame.seq,
          'is-search-dim': searchResults().active && !searchHitSet().has(node.frame.seq),
          'is-search-hit': searchResults().active && searchHitSet().has(node.frame.seq),
        }}
        onClick={() => setSelectedSeq(node.frame.seq)}
      >
        <th scope="row">
          <button
            aria-label={`Select record ${node.frame.seq}`}
            style={{ '--depth': String(depth) }}
            onClick={() => setSelectedSeq(node.frame.seq)}
          >
            <span class="dg-seq-dot" />
            {node.frame.seq}
          </button>
        </th>
        <For each={shownColumns()}>
          {(column) => (
            <td
              class="dg-value-cell"
              classList={{
                'is-search-match': Boolean(
                  searchResults().bySeq.get(node.frame.seq)?.fields.get(column.name)?.length,
                ),
              }}
            >
              <Show
                when={
                  !diffOnly() ||
                  node.frame.changed.includes(column.name) ||
                  Boolean(searchResults().bySeq.get(node.frame.seq)?.fields.get(column.name)?.length)
                }
                fallback={<span class="dg-quiet">—</span>}
              >
                <ValueCell
                  field={node.frame.values[column.name]}
                  format={activeFormat(column)}
                  changes={node.frame.deltas[column.name]}
                  matches={searchResults().bySeq.get(node.frame.seq)?.fields.get(column.name)}
                />
              </Show>
            </td>
          )}
        </For>
        <For each={shownViews()}>
          {(view) => (
            <td class="dg-algo-cell">
              <AlgoCell view={view} frame={node.frame} inTable />
            </td>
          )}
        </For>
      </tr>
    );

  return (
    <div class="workspace-root workspace-theme lv-workspace">
      <header class="dg-app-header">
        <div class="dg-brand">
          <BrandMark />
          <strong>TracePrism</strong>
        </div>
        <div class="dg-header-meta">
          <Show when={current()?.status === 'running'}>
            <span class="dg-live-dot" />
            Recording
          </Show>
          <UpdateControl />
        </div>
      </header>
      <Resizable class="dg-horizontal" role="main" aria-label="Workspace" initialSizes={[0.15, 0.85]}>
        <Resizable.Panel minSize={0.13} maxSize={0.3} class="dg-side-panel">
          <Resizable orientation="vertical" class="dg-vertical" initialSizes={[0.66, 0.34]}>
            <Resizable.Panel minSize={0.4} class="dg-top-panel">
              <aside class="dg-config" aria-label="Values and views">
                <div class="dg-section-title">
                  <h2>
                    <IconEye size="16" stroke="1.8" />
                    Values
                  </h2>
                  <span>
                    {shownColumns().length} / {columns().length}
                  </span>
                </div>
                <Show
                  when={columns().length}
                  fallback={<p class="lv-sidebar-empty">Record values to add columns.</p>}
                >
                  <div class="dg-column-list">
                    <For each={columns()}>
                      {(column) => (
                        <div class="dg-column">
                          <label>
                            <input
                              type="checkbox"
                              checked={visible() === null || visible()!.includes(column.name)}
                              onChange={() => toggleColumn(column.name)}
                            />
                            <span class={`dg-type-mark dg-type-${column.kind}`} />
                            <code title={column.name}>{column.name}</code>
                            <small>{column.kind}</small>
                          </label>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <button
                  class="dg-add-view"
                  aria-label="Add View"
                  disabled={!frames().length}
                  onClick={openAddView}
                >
                  <span class="dg-add-view-icon" aria-hidden="true">
                    <IconPlus size="16" stroke="1.8" />
                  </span>
                  <span class="dg-add-view-label" aria-hidden="true">
                    Add View
                  </span>
                </button>
                <div class="dg-view-list">
                  <For each={views()}>
                    {(view) => (
                      <div class="dg-view-item">
                        <label>
                          <input
                            type="checkbox"
                            checked={view.enabled}
                            onChange={() => toggleView(view.id)}
                          />
                          <span class="dg-view-glyph">
                            <Dynamic component={templates[view.template].icon} size="15" />
                          </span>
                          <span>
                            <strong>{templates[view.template].name}</strong>
                            <small>
                              {Object.entries(view.bindings)
                                .filter(([, name]) => name)
                                .map(([role, name]) => `${role}=${name}`)
                                .join('  ')}
                            </small>
                          </span>
                        </label>
                        <button
                          aria-label={`Edit ${templates[view.template].name} bindings`}
                          onClick={() => openViewEditor(view)}
                        >
                          <IconSettings size="15" />
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </aside>
            </Resizable.Panel>
            <Resizable.Handle
              class="dg-resize-handle dg-resize-vertical"
              aria-label="Resize sidebar sections"
            />
            <Resizable.Panel minSize={0.2} class="dg-bottom-panel">
              <aside class="dg-runs" aria-label="Run history">
                <div class="dg-section-title">
                  <h2>
                    <IconHistory size="16" stroke="1.8" />
                    Runs
                  </h2>
                  <span>{runs().length}</span>
                </div>
                <Show when={warning()}>
                  <p class="lv-sidebar-empty" role="status">
                    {warning()}
                  </p>
                </Show>
                <Show
                  when={runs().length}
                  fallback={
                    <p class="lv-sidebar-empty">
                      No runs yet. Run Rust code with <code>record!</code> to create a trace.
                    </p>
                  }
                >
                  <div class="dg-run-list">
                    <For each={runs()}>
                      {(run) => (
                        <button
                          data-run-id={run.id}
                          classList={{ active: current()?.id === run.id }}
                          onClick={() => chooseRun(run.id)}
                        >
                          <span class="dg-run-line">
                            <time dateTime={run.startedAt}>
                              {runTimeFormatter.format(new Date(run.startedAt))}
                            </time>
                            <Show
                              when={run.status === 'completed'}
                              fallback={<span class="dg-run-status">{run.status}</span>}
                            >
                              <span class="dg-run-status dg-run-completed" role="img" aria-label="Completed">
                                <IconCheck size="14" stroke="2.5" />
                              </span>
                            </Show>
                          </span>
                          <Show when={run.loaded}>
                            <span class="dg-run-sub">{run.frames.length} records</span>
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </aside>
            </Resizable.Panel>
          </Resizable>
        </Resizable.Panel>
        <Resizable.Handle class="dg-resize-handle dg-resize-horizontal" aria-label="Resize sidebar" />
        <Resizable.Panel minSize={0.5} class="dg-main-panel">
          <div class="dg-main">
            <div class="dg-main-heading-row">
              <h1 class="dg-main-heading">Value history</h1>
              <Show when={current()}>
                <label class="dg-diff-control">
                  <input
                    type="checkbox"
                    checked={diffOnly()}
                    onChange={(event) => setDiffOnly(event.currentTarget.checked)}
                  />
                  Changes only
                </label>
              </Show>
            </div>
            <Show when={current() && frames().length}>
              <SearchEditor
                fields={searchFieldList()}
                query={searchQuery()}
                text={searchText()}
                results={searchResults()}
                selectedSeq={selected()?.seq}
                setQuery={setSearchQuery}
                setText={setSearchText}
                selectSeq={selectRecord}
              />
            </Show>
            <Show
              when={!error()}
              fallback={
                <div class="lv-message lv-error">
                  <strong>Could not read saved runs.</strong>
                  <p>{error()}</p>
                  <p>Check the trace storage directory and try again.</p>
                </div>
              }
            >
              <Show
                when={current()}
                fallback={
                  <div class="lv-message">
                    <IconHistory size="28" stroke="1.4" />
                    <strong>No runs yet</strong>
                    <p>
                      Add <code>record!([], value)</code> to Rust code, then run it.
                    </p>
                  </div>
                }
              >
                <Show
                  when={frames().length}
                  fallback={
                    <div class="lv-message">
                      <strong>
                        {current()?.loaded === false
                          ? 'Loading selected run…'
                          : 'Waiting for the first record.'}
                      </strong>
                    </div>
                  }
                >
                  <Resizable
                    class="dg-history-layout"
                    orientation={stacked() ? 'vertical' : 'horizontal'}
                    sizes={historySizes()}
                    onSizesChange={setHistorySizes}
                  >
                    <Resizable.Panel
                      minSize={0.12}
                      collapsible
                      collapsedSize={0}
                      class="dg-history-table-panel"
                    >
                      <div class="dg-table-scroll" ref={tableViewport}>
                        <table
                          class="dg-history-table"
                          style={{ 'min-width': `${columnLayout().minWidth}px` }}
                        >
                          <colgroup>
                            <col style={{ width: columnLayout().sequenceWidth }} />
                            <For each={columnLayout().valueWidths}>
                              {(width) => <col style={{ width }} />}
                            </For>
                            <For each={shownViews()}>
                              {() => <col style={{ width: columnLayout().viewWidth }} />}
                            </For>
                          </colgroup>
                          <thead>
                            <tr>
                              <th scope="col">seq</th>
                              <For each={shownColumns()}>
                                {(column) => (
                                  <th scope="col" class={`dg-heading-${column.kind}`}>
                                    <div class="dg-column-head">
                                      <span>
                                        <code title={`${column.name} · ${column.kind}`}>{column.name}</code>
                                        <small>{column.kind}</small>
                                      </span>
                                      <FormatMenu
                                        name={column.name}
                                        options={formatOptions(column, frames())}
                                        format={activeFormat(column)}
                                        select={(format) =>
                                          setFormats((current) => ({ ...current, [column.name]: format }))
                                        }
                                      />
                                    </div>
                                  </th>
                                )}
                              </For>
                              <For each={shownViews()}>
                                {(view) => (
                                  <th scope="col" class="dg-heading-algo">
                                    <div class="dg-column-head">
                                      <span>
                                        <code>{templates[view.template].name}</code>
                                        <small>View</small>
                                      </span>
                                      <button
                                        class="dg-algo-head-action"
                                        aria-label={`Edit ${templates[view.template].name} bindings`}
                                        onClick={() => openViewEditor(view)}
                                      >
                                        <IconSettings size="17" />
                                      </button>
                                    </div>
                                  </th>
                                )}
                              </For>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={historyTable.getRowModel().rows}>
                              {(row) => renderNode(row.original, row.depth)}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </Resizable.Panel>
                    <div class="dg-history-divider">
                      <Resizable.Handle
                        as="button"
                        type="button"
                        class="dg-history-grip"
                        aria-label="Resize table and graph"
                        aria-valuemin={0}
                        aria-valuemax={1}
                      />
                      <span class="dg-history-handle-mark" aria-hidden="true">
                        <i />
                        <i />
                      </span>
                    </div>
                    <Resizable.Panel
                      minSize={0.12}
                      collapsible
                      collapsedSize={0}
                      class="dg-history-graph-panel"
                    >
                      <div class="dg-graph-layout">
                        <RelationGraph
                          graph={graph()}
                          runId={current()?.id ?? ''}
                          selectedSeq={selected()?.seq ?? ''}
                          select={selectRecord}
                          canSwitch={canSwitchGraph()}
                          switchMode={() =>
                            setGraphPreference(graph().mode === 'transition' ? 'span' : 'from')
                          }
                          search={searchResults()}
                        />
                      </div>
                    </Resizable.Panel>
                  </Resizable>
                </Show>
                <div class="dg-playback">
                  <div class="dg-transport">
                    <button
                      aria-label="Previous record"
                      disabled={selectedIndex() <= 0}
                      onClick={() => selectRecord(frames()[selectedIndex() - 1]?.seq ?? null)}
                    >
                      <IconChevronLeft size="16" />
                    </button>
                    <button
                      aria-label="Next record"
                      disabled={selectedIndex() >= frames().length - 1}
                      onClick={() => selectRecord(frames()[selectedIndex() + 1]?.seq ?? null)}
                    >
                      <IconChevronRight size="16" />
                    </button>
                  </div>
                  <span class="dg-playback-position">
                    <strong title={`seq ${selected()?.seq ?? '—'}`}>seq {selected()?.seq ?? '—'}</strong>
                    <code title={selected() ? spanText(selected()!.span) : '[]'}>
                      {selected() ? spanText(selected()!.span) : '[]'}
                    </code>
                  </span>
                  <div class="dg-playback-slider">
                    <div
                      class="dg-search-ticks"
                      aria-hidden="true"
                      style={{ 'grid-template-columns': `repeat(${searchTicks().length}, minmax(0, 1fr))` }}
                    >
                      <For each={searchTicks()}>
                        {(hit) => (
                          <i
                            classList={{
                              'is-hit': searchResults().active && hit,
                              'is-dim': searchResults().active && !hit,
                            }}
                          />
                        )}
                      </For>
                    </div>
                    <input
                      aria-label="Record position"
                      type="range"
                      min="0"
                      max={Math.max(0, frames().length - 1)}
                      value={Math.max(0, selectedIndex())}
                      onInput={(event) =>
                        selectRecord(frames()[Number(event.currentTarget.value)]?.seq ?? null)
                      }
                    />
                  </div>
                  <button class="lv-latest" onClick={() => selectRecord(null)}>
                    Latest
                  </button>
                </div>
              </Show>
            </Show>
          </div>
        </Resizable.Panel>
      </Resizable>
      <Dialog open={dialogOpen()} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="dg-dialog-overlay" />
          <div class="dg-dialog-positioner">
            <Dialog.Content class="dg-dialog dg-dialog-picker workspace-theme">
              <div class="dg-dialog-header">
                <Dialog.Title>
                  {editingId() !== null ? `Edit ${templates[template()].name}` : 'Add View'}
                </Dialog.Title>
                <Dialog.CloseButton aria-label="Close dialog">
                  <IconX size="18" />
                </Dialog.CloseButton>
              </div>
              <Dialog.Description>
                {editingId() !== null
                  ? templates[template()].description
                  : 'Combine recorded values into a view. Choose a layout, then assign its inputs.'}
              </Dialog.Description>
              <div class="dg-stage-viewport">
                <div class="dg-stage-track" classList={{ 'is-binding': stage() === 'bind' }}>
                  <div
                    ref={choosePanel}
                    class="dg-stage dg-stage-choose"
                    aria-hidden={stage() !== 'choose'}
                    inert={stage() !== 'choose'}
                  >
                    <div class="dg-view-picker">
                      <div class="dg-template-list" aria-label="View layouts">
                        <For each={Object.values(templates)}>
                          {(definition) => (
                            <button
                              data-template={definition.id}
                              classList={{ active: previewTemplate() === definition.id }}
                              onMouseEnter={() => setPreviewTemplate(definition.id as Template)}
                              onFocus={() => setPreviewTemplate(definition.id as Template)}
                              onClick={() => selectViewLayout(definition.id as Template)}
                            >
                              <Dynamic component={definition.icon} size="21" stroke="1.7" />
                              <span>
                                <strong>{definition.name}</strong>
                                <small>{definition.summary}</small>
                              </span>
                              <IconChevronRight size="15" stroke="1.8" />
                            </button>
                          )}
                        </For>
                      </div>
                      <ViewPreview template={previewTemplate()} />
                    </div>
                  </div>
                  <div
                    class="dg-stage dg-stage-bind"
                    aria-hidden={stage() !== 'bind'}
                    inert={stage() !== 'bind'}
                  >
                    <div class="dg-bind-layout">
                      <div class="dg-bind-fields">
                        <div class="dg-bind-intro">
                          <h3 ref={bindHeading} tabIndex={-1}>
                            {templates[template()].name}
                          </h3>
                          <p>{templates[template()].description}</p>
                        </div>
                        <div class="dg-binding-list">
                          <For each={templates[template()].roles}>
                            {(role) => (
                              <div
                                class="dg-binding-row"
                                data-role={role.name}
                                onMouseEnter={() => setHighlightedRole(role.name)}
                                onMouseLeave={() => setHighlightedRole(null)}
                                onFocusIn={() => setHighlightedRole(role.name)}
                                onFocusOut={(event) => {
                                  if (!event.currentTarget.contains(event.relatedTarget as Node))
                                    setHighlightedRole(null);
                                }}
                              >
                                <div class="dg-binding-heading">
                                  <strong>{role.name}</strong>
                                  <small>
                                    {role.shape === 'visited' ? 'bool[] or set<int>' : role.shape}
                                    {role.optional ? ' · optional' : ''}
                                  </small>
                                </div>
                                <div class="dg-binding-current">
                                  <IconCode size="15" />
                                  <code>{draft()[role.name] || 'Not assigned'}</code>
                                </div>
                                <div class="dg-binding-choices">
                                  <Show when={role.optional}>
                                    <button
                                      classList={{ active: !draft()[role.name] }}
                                      onClick={() => setDraft((current) => ({ ...current, [role.name]: '' }))}
                                    >
                                      None
                                      <Show when={!draft()[role.name]}>
                                        <IconCheck size="14" />
                                      </Show>
                                    </button>
                                  </Show>
                                  <For
                                    each={candidates(role)}
                                    fallback={
                                      role.optional ? null : (
                                        <span class="lv-no-candidates">No compatible value</span>
                                      )
                                    }
                                  >
                                    {(name) => (
                                      <button
                                        classList={{ active: draft()[role.name] === name }}
                                        onClick={() =>
                                          setDraft((current) => ({ ...current, [role.name]: name }))
                                        }
                                      >
                                        <code>{name}</code>
                                        <Show when={draft()[role.name] === name}>
                                          <IconCheck size="14" />
                                        </Show>
                                      </button>
                                    )}
                                  </For>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                      <ViewPreview template={template()} activeRole={highlightedRole() ?? undefined} />
                    </div>
                    <div class="dg-dialog-actions">
                      <Show when={editingId() === null}>
                        <button class="dg-back-action" onClick={returnToLayouts}>
                          <IconChevronLeft size="16" />
                          Back
                        </button>
                      </Show>
                      <button
                        class="dg-primary-action"
                        disabled={!validBindings(templates[template()], draft(), frames())}
                        onClick={saveView}
                      >
                        <IconCheck size="16" />
                        {editingId() === null ? 'Add view' : 'Save bindings'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
    </div>
  );
}

export default LiveWorkspace;
