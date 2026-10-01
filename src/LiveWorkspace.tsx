import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import Resizable from '@corvu/resizable';
import { Dialog } from '@kobalte/core/dialog';
import { Popover } from '@kobalte/core/popover';
import { Icon123, IconBinaryTree, IconBrackets, IconChartBar, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconCircleCheck, IconCode, IconEye, IconGitBranch, IconGridDots, IconHash, IconHistory, IconLayoutGrid, IconList, IconPlus, IconSettings, IconTable, IconX } from '@tabler/icons-solidjs';
import { deriveGraph, groupFrames, materialize, spanKey, spanText, valueText } from './trace-model';
import type { Column, Field, Frame, Graph, GraphNode, HistoryNode, Run, Value } from './trace-model';

type Format = { id: string; label: string };
type Template = 'binary' | 'grid';
type Role = { name: string; shape: 'int' | 'bool' | 'matrix' | 'position' };
type AlgoView = { id: number; template: Template; bindings: Record<string, string>; enabled: boolean };
const templates: Record<Template, { name: string; description: string; roles: Role[] }> = {
  binary: { name: 'Binary search', description: 'Bounds, midpoint, and predicate at every record.', roles: [{ name: 'left', shape: 'int' }, { name: 'right', shape: 'int' }, { name: 'mid', shape: 'int' }, { name: 'predicate', shape: 'bool' }] },
  grid: { name: 'Grid traversal', description: 'Current position over the recorded grid.', roles: [{ name: 'board', shape: 'matrix' }, { name: 'position', shape: 'position' }] },
};
const iconFor = (format: string) => ({ bars: IconChartBar, cells: IconBrackets, number: Icon123, badge: IconCircleCheck, count: IconHash, matrix: IconGridDots, entries: IconLayoutGrid, fields: IconCode, text: IconList }[format] ?? IconList);
const isNumericArray = (value: Value): value is { t: 'array'; items: Value[] } => value.t === 'array' && value.items.every(item => item.t === 'int' || item.t === 'float');
const isMatrix = (value: Value): value is { t: 'array'; items: Value[] } => value.t === 'array' && value.items.length > 0 && value.items.every(item => item.t === 'array' && item.items.every(cell => cell.t === 'int' || cell.t === 'float' || cell.t === 'bool'));
const isPosition = (value: Value): value is { t: 'array'; items: Value[] } => value.t === 'array' && value.items.length === 2 && value.items.every(item => item.t === 'int');
const numberOf = (value?: Value) => value && (value.t === 'int' || value.t === 'float') ? Number(value.v) : NaN;
const formatOptions = (column: Column, frames: Frame[]): Format[] => {
  const observed = frames.map(frame => frame.values[column.name]?.value).find(Boolean);
  switch (column.kind) {
    case 'array': return observed && isMatrix(observed) ? [{ id: 'matrix', label: 'Matrix' }, { id: 'text', label: 'Text' }] : observed && isNumericArray(observed) ? [{ id: 'cells', label: 'Numbers' }, { id: 'bars', label: 'Bars' }, { id: 'text', label: 'Text' }] : [{ id: 'cells', label: 'Cells' }, { id: 'text', label: 'Text' }];
    case 'bool': return [{ id: 'badge', label: 'Badge' }, { id: 'text', label: 'Text' }];
    case 'set': return [{ id: 'cells', label: 'Members' }, { id: 'count', label: 'Count' }, { id: 'text', label: 'Text' }];
    case 'map': return [{ id: 'entries', label: 'Entries' }, { id: 'count', label: 'Count' }, { id: 'text', label: 'Text' }];
    case 'record': return [{ id: 'fields', label: 'Fields' }, { id: 'text', label: 'Text' }];
    case 'int': case 'float': return [{ id: 'number', label: 'Number' }, { id: 'text', label: 'Text' }];
    default: return [{ id: 'text', label: 'Text' }];
  }
};
const matches = (value: Value | undefined, shape: Role['shape']) => !!value && (shape === 'int' ? value.t === 'int' : shape === 'bool' ? value.t === 'bool' : shape === 'matrix' ? isMatrix(value) : isPosition(value));

function FormatMenu(props: { name: string; options: Format[]; format: string; select: (format: string) => void }) {
  const [open, setOpen] = createSignal(false);
  return <Popover open={open()} onOpenChange={setOpen}>
    <Popover.Trigger class="dg-format-trigger" aria-label={`Change ${props.name} display format`} title={`${props.name}: ${props.options.find(item => item.id === props.format)?.label}`}><Dynamic component={iconFor(props.format)} size="17" stroke="1.8" /><IconChevronDown size="12" stroke="1.8" /></Popover.Trigger>
    <Popover.Portal><Popover.Content class="dg-format-popover"><Popover.Title>Display {props.name}</Popover.Title><div class="dg-format-options"><For each={props.options}>{option => <button classList={{ active: props.format === option.id }} onClick={() => { props.select(option.id); setOpen(false); }}><Dynamic component={iconFor(option.id)} size="19" stroke="1.7" /><span>{option.label}</span><Show when={props.format === option.id}><IconCheck size="15" stroke="2" /></Show></button>}</For></div></Popover.Content></Popover.Portal>
  </Popover>;
}

function renderTyped(value: Value | undefined, format: string): JSX.Element {
  if (!value) return <span class="dg-quiet">—</span>;
  if (value.t === 'array' && format === 'bars' && isNumericArray(value)) {
    const max = Math.max(1, ...value.items.map(item => Math.abs(numberOf(item))));
    return <div class="dg-bars" aria-label={valueText(value)}><For each={value.items}>{item => <span class="dg-bar-item"><i style={{ height: `${Math.max(5, Math.abs(numberOf(item)) / max * 34)}px` }} /><small>{valueText(item)}</small></span>}</For></div>;
  }
  if (value.t === 'array' && format === 'matrix' && isMatrix(value)) return <div class="lv-matrix"><For each={value.items}>{row => <div><For each={row.t === 'array' ? row.items : []}>{item => <span>{valueText(item)}</span>}</For></div>}</For></div>;
  if (value.t === 'array' && format === 'cells') return <div class="dg-array"><For each={value.items}>{item => <span title={valueText(item)}>{valueText(item)}</span>}</For><Show when={!value.items.length}><code>[]</code></Show></div>;
  if (value.t === 'set' && format === 'count') return <code>{value.items.length} items</code>;
  if (value.t === 'set' && format === 'cells') return <div class="dg-set"><For each={value.items}>{item => <span title={valueText(item)}>{valueText(item)}</span>}</For><Show when={!value.items.length}><code>∅</code></Show></div>;
  if (value.t === 'map' && format === 'count') return <code>{value.entries.length} entries</code>;
  if (value.t === 'map' && format === 'entries') return <div class="lv-entries"><For each={value.entries}>{entry => <code><b>{valueText(entry.key)}</b>: {valueText(entry.value)}</code>}</For><Show when={!value.entries.length}><code>{'{}'}</code></Show></div>;
  if (value.t === 'record' && format === 'fields') return <div class="lv-entries"><For each={value.fields}>{field => <code><b>{field.name}</b>: {valueText(field.value)}</code>}</For><Show when={!value.fields.length}><code>{'{}'}</code></Show></div>;
  if (value.t === 'bool' && format === 'badge') return <span class="dg-bool" classList={{ 'is-true': value.v, 'is-false': !value.v }}>{String(value.v)}</span>;
  return <code class="lv-plain-value" title={valueText(value)}>{valueText(value)}</code>;
}
function ValueCell(props: { field?: Field; format: string; changed?: boolean }) {
  const output = createMemo(() => renderTyped(props.field?.value, props.format));
  return <div class="dg-value-body" classList={{ 'is-updated': props.changed }}>{output()}</div>;
}
function AlgoCell(props: { view: AlgoView; frame: Frame }) {
  const bound = (role: string) => props.frame.values[props.view.bindings[role]]?.value;
  if (props.view.template === 'binary') {
    const left = numberOf(bound('left')), right = numberOf(bound('right')), mid = numberOf(bound('mid'));
    const predicate = bound('predicate');
    if (![left, right, mid].every(Number.isFinite)) return <span class="dg-quiet">—</span>;
    const width = Math.min(24, Math.max(1, right));
    return <div class="dg-binary-view" aria-label={`left ${left}, right ${right}, mid ${mid}`}><div class="dg-binary-track"><For each={Array.from({ length: width }, (_, index) => index)}>{index => <span classList={{ 'in-range': index >= left && index < right, 'is-mid': index === mid }}><small>{index}</small></span>}</For></div><div class="dg-binary-readout"><code>L {left} · M {mid} · R {right}</code><span class="dg-bool" classList={{ 'is-true': predicate?.t === 'bool' && predicate.v, 'is-false': predicate?.t === 'bool' && !predicate.v }}>{predicate?.t === 'bool' ? String(predicate.v) : 'pending'}</span></div></div>;
  }
  const board = bound('board'), position = bound('position');
  if (!board || !isMatrix(board) || !position || !isPosition(position)) return <span class="dg-quiet">—</span>;
  const row = numberOf(position.items[0]), col = numberOf(position.items[1]);
  return <div class="dg-grid-view"><div class="dg-mini-grid" style={{ '--grid-columns': String(board.items[0]?.t === 'array' ? board.items[0].items.length : 1) }}><For each={board.items}>{(line, y) => <For each={line.t === 'array' ? line.items : []}>{(cell, x) => <span classList={{ wall: numberOf(cell) === 1, current: row === y() && col === x() }} title={valueText(cell)} />}</For>}</For></div><code>({row}, {col})</code></div>;
}

function RelationGraph(props: { graph: Graph; selectedSeq: string; select: (seq: string) => void }) {
  const [zoom, setZoom] = createSignal(100);
  const nodes = createMemo(() => new Map(props.graph.nodes.map(node => [node.id, node])));
  const endpoint = (id: string): GraphNode => nodes().get(id)!;
  const edgePath = (from: string, to: string) => { const a = endpoint(from), b = endpoint(to), middle = (a.y + b.y) / 2; return `M ${a.x} ${a.y + 18} C ${a.x} ${middle}, ${b.x} ${middle}, ${b.x} ${b.y - 18}`; };
  return <section class="dg-graph" aria-label="Record relation graph"><div class="dg-graph-meta"><div><strong>{props.graph.mode === 'transition' ? 'Transition graph' : 'Span hierarchy'}</strong><span>{props.graph.mode === 'transition' ? 'Edges follow explicit from references' : 'Parents follow span ID prefixes'}</span></div><label>Zoom <input type="range" min="70" max="140" value={zoom()} onInput={event => setZoom(Number(event.currentTarget.value))} /><output>{zoom()}%</output></label></div><div class="dg-graph-scroll"><svg viewBox={`0 0 1000 ${props.graph.height}`} style={{ width: `${zoom() * 10}px`, height: `${props.graph.height * zoom() / 100}px` }} role="img" aria-label="Record relations"><For each={props.graph.edges}>{edge => <path class="dg-graph-edge" classList={{ 'is-selected': edge.to === `seq:${props.selectedSeq}` }} d={edgePath(edge.from, edge.to)} />}</For><For each={props.graph.nodes}>{node => <g class="dg-graph-node" classList={{ 'is-span': node.kind === 'span', 'is-selected': node.seq === props.selectedSeq, 'is-actionable': node.seq !== undefined }} transform={`translate(${node.x} ${node.y})`} role={node.seq !== undefined ? 'button' : undefined} tabindex={node.seq !== undefined ? 0 : undefined} aria-label={node.seq !== undefined ? `Record ${node.seq}, span ${node.detail}` : `Span ${node.detail}`} onClick={() => node.seq !== undefined && props.select(node.seq)} onKeyDown={event => { if (node.seq !== undefined && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); props.select(node.seq); } }}><circle r={node.kind === 'span' ? 23 : 18} /><text text-anchor="middle" dominant-baseline="central">{node.label}</text><title>{node.detail}</title></g>}</For></svg></div><div class="dg-graph-legend"><span><i class="dg-legend-span" />span</span><span><i class="dg-legend-record" />record</span><span><i class="dg-legend-current" />selected</span></div></section>;
}

export default function LiveWorkspace() {
  const [runs, setRuns] = createSignal<Run[]>([]);
  const [runId, setRunId] = createSignal<string | null>(null);
  const [selectedSeq, setSelectedSeq] = createSignal<string | null>(null);
  const [error, setError] = createSignal('');
  const [visible, setVisible] = createSignal<string[] | null>(null);
  const [formats, setFormats] = createSignal<Record<string, string>>({});
  const [viewsByRun, setViewsByRun] = createSignal<Record<string, AlgoView[]>>({});
  const [display, setDisplay] = createSignal<'table' | 'graph'>('table');
  const [collapsed, setCollapsed] = createSignal<string[]>([]);
  const [diffOnly, setDiffOnly] = createSignal(false);
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [stage, setStage] = createSignal<'choose' | 'bind'>('choose');
  const [template, setTemplate] = createSignal<Template>('binary');
  const [editingId, setEditingId] = createSignal<number | null>(null);
  const [draft, setDraft] = createSignal<Record<string, string>>({});
  const current = createMemo(() => runs().find(run => run.id === runId()) ?? runs()[0]);
  const model = createMemo(() => materialize(current()?.frames ?? []));
  const frames = createMemo(() => model().frames);
  const columns = createMemo(() => model().columns);
  const shownColumns = createMemo(() => columns().filter(column => visible() === null || visible()!.includes(column.name)));
  const views = createMemo(() => viewsByRun()[current()?.id ?? ''] ?? []);
  const shownViews = createMemo(() => views().filter(view => view.enabled));
  const selectedIndex = createMemo(() => { const index = frames().findIndex(frame => frame.seq === selectedSeq()); return index < 0 ? frames().length - 1 : index; });
  const selected = createMemo(() => frames()[selectedIndex()]);
  const tree = createMemo(() => groupFrames(frames()));
  const graph = createMemo(() => deriveGraph(frames()));
  const columnCount = createMemo(() => 2 + shownColumns().length + shownViews().length);
  const refresh = async () => {
    try { const response = await fetch('/api/runs', { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json() as { runs: Run[] }; setRuns(data.runs); setError(''); }
    catch (cause) { setError(`Could not load runs: ${String(cause)}`); }
  };
  onMount(() => { void refresh(); const timer = setInterval(() => void refresh(), 1000); onCleanup(() => clearInterval(timer)); });
  const chooseRun = (id: string) => { setRunId(id); setSelectedSeq(null); setVisible(null); setFormats({}); setCollapsed([]); };
  const toggleColumn = (name: string) => setVisible(names => { const currentNames = names ?? columns().map(column => column.name); return currentNames.includes(name) ? currentNames.filter(item => item !== name) : columns().map(column => column.name).filter(column => currentNames.includes(column) || column === name); });
  const activeFormat = (column: Column) => formats()[column.name] ?? formatOptions(column, frames())[0].id;
  const candidates = (role: Role) => columns().filter(column => frames().some(frame => matches(frame.values[column.name]?.value, role.shape))).map(column => column.name);
  const initialBindings = (next: Template) => Object.fromEntries(templates[next].roles.map(role => [role.name, candidates(role).includes(role.name) ? role.name : candidates(role)[0] ?? '']));
  const openDialog = (view?: AlgoView) => { setEditingId(view?.id ?? null); setTemplate(view?.template ?? 'binary'); setStage(view ? 'bind' : 'choose'); setDraft(view?.bindings ?? initialBindings('binary')); setDialogOpen(true); };
  const chooseTemplate = (next: Template) => { setTemplate(next); setDraft(initialBindings(next)); setStage('bind'); };
  const saveView = () => { const id = current()?.id; if (!id) return; const old = editingId(); setViewsByRun(all => { const items = all[id] ?? []; return { ...all, [id]: old === null ? [...items, { id: Math.max(0, ...items.map(item => item.id)) + 1, template: template(), bindings: { ...draft() }, enabled: true }] : items.map(item => item.id === old ? { ...item, template: template(), bindings: { ...draft() } } : item) }; }); setDialogOpen(false); };
  const toggleView = (id: number) => { const run = current()?.id; if (!run) return; setViewsByRun(all => ({ ...all, [run]: (all[run] ?? []).map(view => view.id === id ? { ...view, enabled: !view.enabled } : view) })); };
  const count = (nodes: HistoryNode[]): number => nodes.reduce((sum, node) => sum + (node.kind === 'frame' ? 1 : count(node.children)), 0);
  const renderNode = (node: HistoryNode, depth: number): JSX.Element => node.kind === 'group' ? <><tr class="dg-group-row"><td colspan={columnCount()}><button style={{ '--depth': String(depth) }} aria-expanded={!collapsed().includes(spanKey(node.span))} onClick={() => setCollapsed(keys => keys.includes(spanKey(node.span)) ? keys.filter(key => key !== spanKey(node.span)) : [...keys, spanKey(node.span)])}><span class="dg-fold"><Show when={collapsed().includes(spanKey(node.span))} fallback={<IconChevronDown size="13" />}><IconChevronRight size="13" /></Show></span><code>{spanText(node.span)}</code><span>{count(node.children)} records</span><i /></button></td></tr><Show when={!collapsed().includes(spanKey(node.span))}><For each={node.children}>{child => renderNode(child, depth + 1)}</For></Show></> : <tr class="dg-frame-row" classList={{ 'is-selected': selected()?.seq === node.frame.seq }} onClick={() => setSelectedSeq(node.frame.seq)}><th scope="row"><button aria-label={`Select record ${node.frame.seq}`} style={{ '--depth': String(depth) }} onClick={() => setSelectedSeq(node.frame.seq)}><span class="dg-seq-dot" />{node.frame.seq}</button></th><td class="dg-source-cell"><code>{node.frame.source}</code><Show when={node.frame.from !== undefined}><span>from {node.frame.from}</span></Show></td><For each={shownColumns()}>{column => <td class="dg-value-cell"><Show when={!diffOnly() || node.frame.changed.includes(column.name)} fallback={<span class="dg-quiet">—</span>}><ValueCell field={node.frame.values[column.name]} format={activeFormat(column)} changed={node.frame.changed.includes(column.name)} /></Show></td>}</For><For each={shownViews()}>{view => <td class="dg-algo-cell"><AlgoCell view={view} frame={node.frame} /></td>}</For></tr>;

  return <div class="design-gallery dg-index lv-workspace">
    <header class="dg-app-header"><div class="dg-brand"><span class="dg-mark"><IconGitBranch size="18" stroke="2" /></span><strong>algo-vis</strong><span class="dg-brand-divider" /><span>Data history</span></div><div class="dg-header-meta"><span class="dg-live-dot" />{current()?.status === 'running' ? 'Recording' : 'Local traces'}<small>Rust SDK</small></div></header>
    <Resizable class="dg-horizontal" initialSizes={[0.15, 0.85]}><Resizable.Panel minSize={0.13} maxSize={0.3} class="dg-side-panel"><Resizable orientation="vertical" class="dg-vertical" initialSizes={[0.66, 0.34]}><Resizable.Panel minSize={0.4} class="dg-top-panel"><aside class="dg-config" aria-label="Visible columns and Algo Views"><div class="dg-section-title"><h2><IconEye size="16" stroke="1.8" />Values</h2><span>{shownColumns().length} / {columns().length}</span></div><Show when={columns().length} fallback={<p class="lv-sidebar-empty">Record values to add columns.</p>}><div class="dg-column-list"><For each={columns()}>{column => <div class="dg-column"><label><input type="checkbox" checked={visible() === null || visible()!.includes(column.name)} onChange={() => toggleColumn(column.name)} /><span class={`dg-type-mark dg-type-${column.kind}`} /><code title={column.name}>{column.name}</code><small>{column.kind}</small></label></div>}</For></div></Show><div class="dg-algo-heading"><h2><IconBinaryTree size="16" stroke="1.8" />Algo Views</h2><button class="dg-add-view" aria-label="Add Algo View" disabled={!frames().length} onClick={() => openDialog()}><IconPlus size="16" stroke="1.8" /></button></div><div class="dg-view-list"><For each={views()}>{view => <div class="dg-view-item"><label><input type="checkbox" checked={view.enabled} onChange={() => toggleView(view.id)} /><span class="dg-view-glyph"><Show when={view.template === 'binary'} fallback={<IconGridDots size="15" />}><IconGitBranch size="15" /></Show></span><span><strong>{templates[view.template].name}</strong><small>{Object.entries(view.bindings).map(([role, name]) => `${role}=${name}`).join('  ')}</small></span></label><button aria-label={`Edit ${templates[view.template].name} bindings`} onClick={() => openDialog(view)}><IconSettings size="15" /></button></div>}</For></div></aside></Resizable.Panel><Resizable.Handle class="dg-resize-handle dg-resize-vertical" aria-label="Resize sidebar sections" /><Resizable.Panel minSize={0.2} class="dg-bottom-panel"><aside class="dg-runs" aria-label="Run history"><div class="dg-section-title"><h2><IconHistory size="16" stroke="1.8" />Runs</h2><span>{runs().length}</span></div><Show when={runs().length} fallback={<p class="lv-sidebar-empty">No runs yet. Start the server, then run code with <code>record!</code>.</p>}><div class="dg-run-list"><For each={runs()}>{run => <button classList={{ active: current()?.id === run.id }} onClick={() => chooseRun(run.id)}><span class="dg-run-line"><strong title={run.source}>{run.source}</strong><time>{new Date(run.startedAt).toLocaleTimeString('en-US')}</time></span><code>{run.id}</code><span class="dg-run-sub">{run.frames.length} records<span>{run.status}</span></span></button>}</For></div></Show></aside></Resizable.Panel></Resizable></Resizable.Panel><Resizable.Handle class="dg-resize-handle dg-resize-horizontal" aria-label="Resize sidebar" /><Resizable.Panel minSize={0.5} class="dg-main-panel"><main class="dg-main"><header class="dg-main-title"><div><p>{current() ? `${current()!.source} / ${current()!.id}` : 'No run selected'}</p><h1>Value history</h1></div><div class="dg-main-summary"><strong>{frames().length} records</strong><span>{current()?.status ?? 'waiting'}</span></div></header>
      <Show when={!error()} fallback={<div class="lv-message lv-error"><strong>Could not connect to the local server.</strong><p>{error()}</p><code>npm run build && npm run serve</code></div>}><Show when={current()} fallback={<div class="lv-message"><IconHistory size="28" stroke="1.4" /><strong>No runs yet</strong><p>Add <code>record!([], value)</code> to Rust code, then run it with the server open.</p></div>}>
        <div class="dg-history-toolbar"><div><h2>{display() === 'table' ? 'Records by span' : 'Record relations'}</h2><span>{display() === 'table' ? 'Recorded values and configured Algo Views at every seq' : graph().mode === 'transition' ? 'Explicit from references' : 'Span ID prefixes'}</span></div><div class="dg-toolbar-actions"><Show when={display() === 'table'}><label class="dg-diff-control"><input type="checkbox" checked={diffOnly()} onChange={event => setDiffOnly(event.currentTarget.checked)} />Changes only</label></Show><div class="dg-view-switch" role="group" aria-label="History view"><button classList={{ active: display() === 'table' }} aria-pressed={display() === 'table'} onClick={() => setDisplay('table')}><IconTable size="16" />Table</button><button classList={{ active: display() === 'graph' }} aria-pressed={display() === 'graph'} onClick={() => setDisplay('graph')}><IconGitBranch size="16" />Graph</button></div></div></div>
        <Show when={frames().length} fallback={<div class="lv-message"><strong>Waiting for the first record.</strong></div>}><Show when={display() === 'table'} fallback={<div class="dg-graph-layout"><RelationGraph graph={graph()} selectedSeq={selected()?.seq ?? ''} select={setSelectedSeq} /><section class="dg-record-inspector"><div><strong>seq {selected()?.seq}</strong><span>{selected() ? `${spanText(selected()!.span)} · ${selected()!.source}` : ''}</span></div><div class="dg-inspector-values"><For each={shownColumns()}>{column => <div><small>{column.name}</small><ValueCell field={selected()?.values[column.name]} format={activeFormat(column)} /></div>}</For><For each={shownViews()}>{view => <div class="dg-inspector-algo"><small>{templates[view.template].name}</small><Show when={selected()}>{frame => <AlgoCell view={view} frame={frame()} />}</Show></div>}</For></div></section></div>}><div class="dg-table-scroll"><table class="dg-history-table"><thead><tr><th scope="col">seq</th><th scope="col">source / from</th><For each={shownColumns()}>{column => <th scope="col" class={`dg-heading-${column.kind}`}><div class="dg-column-head"><span><code>{column.name}</code><small>{column.kind}</small></span><FormatMenu name={column.name} options={formatOptions(column, frames())} format={activeFormat(column)} select={format => setFormats(current => ({ ...current, [column.name]: format }))} /></div></th>}</For><For each={shownViews()}>{view => <th scope="col" class="dg-heading-algo"><div class="dg-column-head"><span><code>{templates[view.template].name}</code><small>Algo View</small></span><button class="dg-algo-head-action" aria-label={`Edit ${templates[view.template].name} bindings`} onClick={() => openDialog(view)}><IconSettings size="17" /></button></div></th>}</For></tr></thead><tbody><For each={tree()}>{node => renderNode(node, 0)}</For></tbody></table></div></Show></Show>
        <footer class="dg-playback"><div class="dg-transport"><button aria-label="Previous record" disabled={selectedIndex() <= 0} onClick={() => setSelectedSeq(frames()[selectedIndex() - 1]?.seq ?? null)}><IconChevronLeft size="16" /></button><button aria-label="Next record" disabled={selectedIndex() >= frames().length - 1} onClick={() => setSelectedSeq(frames()[selectedIndex() + 1]?.seq ?? null)}><IconChevronRight size="16" /></button></div><span><strong>seq {selected()?.seq ?? '—'}</strong><code>{selected() ? spanText(selected()!.span) : '[]'}</code></span><input aria-label="Record position" type="range" min="0" max={Math.max(0, frames().length - 1)} value={Math.max(0, selectedIndex())} onInput={event => setSelectedSeq(frames()[Number(event.currentTarget.value)]?.seq ?? null)} /><button class="lv-latest" onClick={() => setSelectedSeq(null)}>Latest</button><small>{selected()?.source ?? ''}</small></footer>
      </Show></Show></main></Resizable.Panel></Resizable>
    <Dialog open={dialogOpen()} onOpenChange={setDialogOpen}><Dialog.Portal><Dialog.Overlay class="dg-dialog-overlay" /><div class="dg-dialog-positioner"><Dialog.Content class="dg-dialog dg-index"><div class="dg-dialog-header"><Dialog.Title>{editingId() !== null ? `Edit ${templates[template()].name}` : stage() === 'choose' ? 'Add an Algo View' : `Configure ${templates[template()].name}`}</Dialog.Title><Dialog.CloseButton aria-label="Close dialog"><IconX size="18" /></Dialog.CloseButton></div><Dialog.Description>{stage() === 'choose' ? 'Choose a visualizer. Then bind its inputs to recorded values.' : templates[template()].description}</Dialog.Description><Show when={stage() === 'choose'} fallback={<><div class="dg-binding-list"><For each={templates[template()].roles}>{role => <div class="dg-binding-row"><div class="dg-binding-heading"><strong>{role.name}</strong><small>{role.shape}</small></div><div class="dg-binding-current"><IconCode size="15" /><code>{draft()[role.name] || 'Not assigned'}</code></div><div class="dg-binding-choices"><For each={candidates(role)} fallback={<span class="lv-no-candidates">No compatible value</span>}>{name => <button classList={{ active: draft()[role.name] === name }} onClick={() => setDraft(current => ({ ...current, [role.name]: name }))}><code>{name}</code><Show when={draft()[role.name] === name}><IconCheck size="14" /></Show></button>}</For></div></div>}</For></div><div class="dg-dialog-actions"><Show when={editingId() === null}><button class="dg-back-action" onClick={() => setStage('choose')}><IconChevronLeft size="16" />Back</button></Show><button class="dg-primary-action" disabled={templates[template()].roles.some(role => !draft()[role.name])} onClick={saveView}><IconCheck size="16" />{editingId() === null ? 'Add column' : 'Save bindings'}</button></div></>}><div class="dg-template-grid"><button onClick={() => chooseTemplate('binary')}><IconGitBranch size="28" stroke="1.5" /><strong>Binary search</strong><span>Bounds, midpoint, predicate</span></button><button onClick={() => chooseTemplate('grid')}><IconGridDots size="28" stroke="1.5" /><strong>Grid traversal</strong><span>Grid with current position</span></button></div></Show></Dialog.Content></div></Dialog.Portal></Dialog>
  </div>;
}
