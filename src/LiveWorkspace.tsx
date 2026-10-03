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
import { AlgoCell, templates, validBindings, type Template } from './presentations/algo/registry';
import { createWorkspaceController } from './workspace/controller';
import { createHistoryTable } from './workspace/history/table-adapter';
import { FormatMenu } from './workspace/history/FormatMenu';
import { ValueCell } from './workspace/history/ValueCell';
function RelationGraph(props: {
  graph: Graph;
  runId: string;
  selectedSeq: string;
  select: (seq: Seq) => void;
}) {
  const [zoom, setZoom] = createSignal(100);
  let viewport: HTMLDivElement | undefined;
  let lastFocus = '';
  const nodes = createMemo(() => new Map(props.graph.nodes.map((node) => [node.id, node])));
  const focusSelected = (behavior: ScrollBehavior, force = false) => {
    const node = props.graph.nodes.find((item) => item.seq === props.selectedSeq);
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
              : 'Parents follow span ID prefixes'}
          </span>
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
                classList={{ 'is-selected': edge.to === `seq:${props.selectedSeq}` }}
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
                  'is-selected': node.seq === props.selectedSeq,
                  'is-actionable': node.seq !== undefined,
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
  const [wideSizes, setWideSizes] = createSignal([2 / 3, 1 / 3]);
  const [narrowSizes, setNarrowSizes] = createSignal([0.5, 0.5]);
  const [stacked, setStacked] = createSignal(false);
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
        classList={{ 'is-selected': selected()?.seq === node.frame.seq }}
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
            <td class="dg-value-cell">
              <Show
                when={!diffOnly() || node.frame.changed.includes(column.name)}
                fallback={<span class="dg-quiet">—</span>}
              >
                <ValueCell
                  field={node.frame.values[column.name]}
                  format={activeFormat(column)}
                  changes={node.frame.deltas[column.name]}
                />
              </Show>
            </td>
          )}
        </For>
        <For each={shownViews()}>
          {(view) => (
            <td class="dg-algo-cell">
              <AlgoCell view={view} frame={node.frame} />
            </td>
          )}
        </For>
      </tr>
    );

  return (
    <div class="workspace-root workspace-theme lv-workspace">
      <header class="dg-app-header">
        <div class="dg-brand">
          <span class="dg-mark">
            <IconGitBranch size="18" stroke="2" />
          </span>
          <strong>algo-vis</strong>
          <span class="dg-brand-divider" />
          <span>Data history</span>
        </div>
        <div class="dg-header-meta">
          <span class="dg-live-dot" />
          {current()?.status === 'running' ? 'Recording' : 'Local traces'}
          <small>Rust SDK</small>
        </div>
      </header>
      <Resizable class="dg-horizontal" role="main" aria-label="Workspace" initialSizes={[0.15, 0.85]}>
        <Resizable.Panel minSize={0.13} maxSize={0.3} class="dg-side-panel">
          <Resizable orientation="vertical" class="dg-vertical" initialSizes={[0.66, 0.34]}>
            <Resizable.Panel minSize={0.4} class="dg-top-panel">
              <aside class="dg-config" aria-label="Visible columns and Algo Views">
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
                <div class="dg-algo-heading">
                  <h2>
                    <IconBinaryTree size="16" stroke="1.8" />
                    Algo Views
                  </h2>
                  <button
                    class="dg-add-view"
                    aria-label="Add Algo View"
                    disabled={!frames().length}
                    onClick={() => openDialog()}
                  >
                    <IconPlus size="16" stroke="1.8" />
                  </button>
                </div>
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
                          onClick={() => openDialog(view)}
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
                      No runs yet. Start the server, then run code with <code>record!</code>.
                    </p>
                  }
                >
                  <div class="dg-run-list">
                    <For each={runs()}>
                      {(run) => (
                        <button
                          classList={{ active: current()?.id === run.id }}
                          onClick={() => chooseRun(run.id)}
                        >
                          <span class="dg-run-line">
                            <strong>Run</strong>
                            <time>{new Date(run.startedAt).toLocaleTimeString('en-US')}</time>
                          </span>
                          <code>{run.id}</code>
                          <span class="dg-run-sub">
                            {run.frames.length} records<span>{run.status}</span>
                          </span>
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
            <Show
              when={!error()}
              fallback={
                <div class="lv-message lv-error">
                  <strong>Could not connect to the local server.</strong>
                  <p>{error()}</p>
                  <code>npm run build && npm run serve</code>
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
                      Add <code>record!([], value)</code> to Rust code, then run it with the server open.
                    </p>
                  </div>
                }
              >
                <Show
                  when={frames().length}
                  fallback={
                    <div class="lv-message">
                      <strong>Waiting for the first record.</strong>
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
                        <table class="dg-history-table">
                          <thead>
                            <tr>
                              <th scope="col">seq</th>
                              <For each={shownColumns()}>
                                {(column) => (
                                  <th scope="col" class={`dg-heading-${column.kind}`}>
                                    <div class="dg-column-head">
                                      <span>
                                        <code>{column.name}</code>
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
                                        <small>Algo View</small>
                                      </span>
                                      <button
                                        class="dg-algo-head-action"
                                        aria-label={`Edit ${templates[view.template].name} bindings`}
                                        onClick={() => openDialog(view)}
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
                  <span>
                    <strong>seq {selected()?.seq ?? '—'}</strong>
                    <code>{selected() ? spanText(selected()!.span) : '[]'}</code>
                  </span>
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
            <Dialog.Content class="dg-dialog workspace-theme">
              <div class="dg-dialog-header">
                <Dialog.Title>
                  {editingId() !== null
                    ? `Edit ${templates[template()].name}`
                    : stage() === 'choose'
                      ? 'Add an Algo View'
                      : `Configure ${templates[template()].name}`}
                </Dialog.Title>
                <Dialog.CloseButton aria-label="Close dialog">
                  <IconX size="18" />
                </Dialog.CloseButton>
              </div>
              <Dialog.Description>
                {stage() === 'choose'
                  ? 'Choose a visualizer. Then bind its inputs to recorded values.'
                  : templates[template()].description}
              </Dialog.Description>
              <Show
                when={stage() === 'choose'}
                fallback={
                  <>
                    <div class="dg-binding-list">
                      <For each={templates[template()].roles}>
                        {(role) => (
                          <div class="dg-binding-row">
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
                                    onClick={() => setDraft((current) => ({ ...current, [role.name]: name }))}
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
                    <div class="dg-dialog-actions">
                      <Show when={editingId() === null}>
                        <button class="dg-back-action" onClick={() => setStage('choose')}>
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
                        {editingId() === null ? 'Add column' : 'Save bindings'}
                      </button>
                    </div>
                  </>
                }
              >
                <div class="dg-template-grid">
                  <For each={Object.values(templates)}>
                    {(definition) => (
                      <button onClick={() => chooseTemplate(definition.id as Template)}>
                        <Dynamic component={definition.icon} size="28" stroke="1.5" />
                        <strong>{definition.name}</strong>
                        <span>{definition.summary}</span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
    </div>
  );
}

export default LiveWorkspace;
