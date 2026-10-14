import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import Resizable from '@corvu/resizable';
import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconHistory,
  IconPlus,
  IconSettings,
} from '@tabler/icons-solidjs';
import { spanKey, spanText } from './trace/value';
import type { HistoryNode } from './trace/types';
import type { Seq } from './trace/ids';
import type { RunRepository } from './runs/RunRepository';
import { formatOptions } from './presentations/values/registry';
import { AlgoCell, templates } from './presentations/algo/registry';
import { createWorkspaceController } from './workspace/controller';
import { BrandMark } from './design/BrandMark';
import { createHistoryTable } from './workspace/history/table-adapter';
import { historyColumnLayout } from './workspace/history/column-layout';
import { FormatMenu } from './workspace/history/FormatMenu';
import { ValueCell } from './workspace/history/ValueCell';
import { SearchEditor } from './workspace/search/SearchEditor';
import { RelationGraph } from './workspace/graph/RelationGraph';
import { ViewDialog } from './workspace/views/ViewDialog';
import { UpdateControl } from './updater/UpdateControl';

const runTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function LiveWorkspace(props: { repository?: RunRepository }) {
  const controller = createWorkspaceController(untrack(() => props.repository));
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
    openDialog,
    toggleView,
    setSelectedSeq,
    setFormats,
  } = controller;
  const historyTable = createHistoryTable(tree, collapsed, () => current()?.id);
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
  let browsingTable = false;
  let focusedRunId = '';
  const scrollSelectedRowIntoView = () => {
    const row = tableViewport?.querySelector<HTMLElement>('.dg-frame-row.is-selected');
    if (!row || !tableViewport) return;
    const viewport = tableViewport.getBoundingClientRect();
    const bounds = row.getBoundingClientRect();
    const headerHeight = tableViewport.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const top = viewport.top + headerHeight + 8;
    const bottom = viewport.bottom - 8;
    if (bounds.top < top) tableViewport.scrollTop += bounds.top - top;
    else if (bounds.bottom > bottom) tableViewport.scrollTop += bounds.bottom - bottom;
  };
  const selectRecord = (seq: Seq | null) => {
    browsingTable = false;
    const frame = frames().find((item) => item.seq === seq);
    if (frame) {
      const ancestors = new Set<string>(
        frame.span.map((_, index) => spanKey(frame.span.slice(0, index + 1))),
      );
      if (collapsed().some((key) => ancestors.has(key)))
        setCollapsed((keys) => keys.filter((key) => !ancestors.has(key)));
    }
    setSelectedSeq(seq);
    requestAnimationFrame(scrollSelectedRowIntoView);
  };
  const focusKey = createMemo(() => `${current()?.id ?? ''}:${selected()?.seq ?? ''}`);
  createEffect(() => {
    const key = focusKey();
    const runId = current()?.id ?? '';
    if (runId !== focusedRunId) {
      browsingTable = false;
      focusedRunId = runId;
    }
    if (key.endsWith(':')) return;
    const frame = requestAnimationFrame(() => {
      if (focusKey() === key && !browsingTable) scrollSelectedRowIntoView();
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
        onClick={() => selectRecord(node.frame.seq)}
      >
        <th scope="row">
          <button
            aria-label={`Select record ${node.frame.seq}`}
            style={{ '--depth': String(depth) }}
            onClick={(event) => {
              event.stopPropagation();
              selectRecord(node.frame.seq);
            }}
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
                  onClick={() => openDialog()}
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
                      <div
                        class="dg-table-scroll"
                        ref={tableViewport}
                        tabIndex={0}
                        aria-label="Value history table"
                        onWheel={() => (browsingTable = true)}
                        onTouchMove={() => (browsingTable = true)}
                        onPointerDown={() => (browsingTable = true)}
                        onKeyDown={(event) => {
                          if (
                            ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(
                              event.key,
                            )
                          )
                            browsingTable = true;
                        }}
                      >
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
                          selectedSeq={selected()?.seq}
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
      <ViewDialog model={controller} />
    </div>
  );
}

export default LiveWorkspace;
