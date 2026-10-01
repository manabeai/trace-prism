import { createMemo, createSignal, For, Show, Switch, Match } from 'solid-js';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import Resizable from '@corvu/resizable';
import { Dialog } from '@kobalte/core/dialog';
import { Popover } from '@kobalte/core/popover';
import { Icon123, IconBinaryTree, IconBrackets, IconChartBar, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconCircleCheck, IconCode, IconEye, IconGitBranch, IconGridDots, IconHash, IconHistory, IconLayoutGrid, IconList, IconPlus, IconSettings, IconTable, IconX } from '@tabler/icons-solidjs';
import { deriveGraph, framesForRun, pathKey, pathText, sampleRuns, valueColumns } from './design-data';
import type { Frame, GraphNode, Snapshot, TraceGraph, ValueKey, ValueKind } from './design-data';

type Template = 'binary' | 'grid';
type AlgoView = { id: number; template: Template; name: string; bindings: Record<string, ValueKey> };
type SpanGroup = { kind: 'group'; path: number[]; children: HistoryNode[] };
type HistoryNode = SpanGroup | { kind: 'frame'; frame: Frame };

const templateSpecs: Record<Template, { name: string; description: string; roles: { key: string; kind: ValueKind; initial: ValueKey }[] }> = {
  binary: { name: 'Binary search', description: 'Inspect the bounds, midpoint, and predicate at every record.', roles: [
    { key: 'left', kind: 'integer', initial: 'left' }, { key: 'right', kind: 'integer', initial: 'right' },
    { key: 'mid', kind: 'integer', initial: 'mid' }, { key: 'predicate', kind: 'boolean', initial: 'ok' },
  ] },
  grid: { name: 'Grid traversal', description: 'Overlay the current position on the recorded grid.', roles: [
    { key: 'board', kind: 'grid', initial: 'grid' }, { key: 'position', kind: 'position', initial: 'pos' },
  ] },
};

const formatIcon = (format: string) => {
  switch (format) {
    case 'bars': return IconChartBar;
    case 'cells': return IconBrackets;
    case 'scale': return IconGitBranch;
    case 'number': return Icon123;
    case 'badge': return IconCircleCheck;
    case 'mini': return IconGridDots;
    case 'summary': return IconLayoutGrid;
    case 'count': return IconHash;
    case 'coords': return IconGitBranch;
    case 'pairs': return IconCode;
    default: return IconList;
  }
};

function FormatMenu(props: { column: (typeof valueColumns)[number]; format: string; onSelect: (format: string) => void }) {
  const [open, setOpen] = createSignal(false);
  return <Popover open={open()} onOpenChange={setOpen}>
    <Popover.Trigger class="dg-format-trigger" aria-label={`Change ${props.column.label} display format`} title={`${props.column.label}: ${props.column.formats.find(item => item.id === props.format)?.label}`}>
      <Dynamic component={formatIcon(props.format)} size="17" stroke="1.8" /><IconChevronDown size="12" stroke="1.8" />
    </Popover.Trigger>
    <Popover.Portal><Popover.Content class="dg-format-popover"><Popover.Title>Display {props.column.label}</Popover.Title><div class="dg-format-options"><For each={props.column.formats}>{format => <button classList={{ active: props.format === format.id }} onClick={() => { props.onSelect(format.id); setOpen(false); }}><Dynamic component={formatIcon(format.id)} size="19" stroke="1.7" /><span>{format.label}</span><Show when={props.format === format.id}><IconCheck size="15" stroke="2" /></Show></button>}</For></div></Popover.Content></Popover.Portal>
  </Popover>;
}

function groupFrames(frames: Frame[]): HistoryNode[] {
  const root: HistoryNode[] = [];
  const groups = new Map<string, SpanGroup>();
  for (const frame of frames) {
    let parent = root;
    for (let length = 1; length <= frame.span.length; length++) {
      const path = frame.span.slice(0, length);
      const key = pathKey(path);
      let group = groups.get(key);
      if (!group) { group = { kind: 'group', path, children: [] }; parent.push(group); groups.set(key, group); }
      parent = group.children;
    }
    parent.push({ kind: 'frame', frame });
  }
  return root;
}

function countFrames(nodes: HistoryNode[]): number {
  return nodes.reduce((sum, node) => sum + (node.kind === 'frame' ? 1 : countFrames(node.children)), 0);
}

function MiniGrid(props: { board: number[][]; position?: [number, number] }) {
  return <div class="dg-mini-grid" style={{ '--grid-columns': String(props.board[0]?.length ?? 1) }} aria-label={props.position ? `Current position ${props.position.join(', ')}` : 'Grid'}>
    <For each={props.board}>{(row, y) => <For each={row}>{(cell, x) => <span classList={{ wall: cell === 1, current: props.position?.[0] === y() && props.position?.[1] === x() }} />}</For>}</For>
  </div>;
}

function RawValue(props: { frame: Frame; column: ValueKey; format: string }) {
  const value = () => props.frame.values[props.column];
  const updated = () => props.frame.changed.includes(props.column);
  return <div class="dg-value-body" classList={{ 'is-updated': updated() }}><Switch>
    <Match when={props.column === 'a' && props.format === 'bars'}><div class="dg-bars" aria-label={(value() as number[]).join(', ')}><For each={value() as number[]}>{(number, index) => <span class="dg-bar-item"><i style={{ height: `${Math.max(5, Math.abs(number) / 16 * 35)}px` }} classList={{ 'is-changed': updated() && index() === 2 }} /><small>{number}</small></span>}</For></div></Match>
    <Match when={props.column === 'a'}><div class="dg-array"><For each={value() as number[]}>{(number, index) => <span classList={{ 'is-updated': updated() && index() === 2 }}>{number}</span>}</For></div></Match>
    <Match when={['left', 'right', 'mid'].includes(props.column) && props.format === 'scale'}><div class="dg-scale"><span style={{ left: `${Math.max(0, Math.min(100, Number(value()) / 6 * 100))}%` }} /><code>{String(value())}</code></div></Match>
    <Match when={['left', 'right', 'mid'].includes(props.column)}><code class="dg-number">{String(value())}</code></Match>
    <Match when={props.column === 'ok' && props.format === 'badge'}><span class="dg-bool" classList={{ 'is-true': value() === true, 'is-false': value() === false }}>{value() === null ? 'pending' : value() ? 'true' : 'false'}</span></Match>
    <Match when={props.column === 'ok'}><code>{value() === null ? 'null' : String(value())}</code></Match>
    <Match when={props.column === 'seen' && props.format === 'count'}><code>{(value() as number[]).length} items</code></Match>
    <Match when={props.column === 'seen'}><div class="dg-set"><Show when={(value() as number[]).length} fallback={<span>∅</span>}><For each={value() as number[]}>{number => <span>{number}</span>}</For></Show></div></Match>
    <Match when={props.column === 'score' && props.format === 'count'}><code>{Object.keys(value() as Record<string, number>).length} entries</code></Match>
    <Match when={props.column === 'score'}><code>{Object.entries(value() as Record<string, number>).map(([key, number]) => `${key}:${number}`).join('  ')}</code></Match>
    <Match when={props.column === 'grid' && props.format === 'summary'}><code>{(value() as number[][]).length} × {(value() as number[][])[0]?.length ?? 0}</code></Match>
    <Match when={props.column === 'grid'}><MiniGrid board={value() as number[][]} /></Match>
    <Match when={props.column === 'pos'}><code>{`(${(value() as [number, number]).join(', ')})`}</code></Match>
  </Switch></div>;
}

function AlgoCell(props: { view: AlgoView; snapshot: Snapshot }) {
  const binding = (role: string) => props.snapshot[props.view.bindings[role]];
  return <Switch>
    <Match when={props.view.template === 'binary'}>{(() => {
      const left = Number(binding('left')), right = Number(binding('right')), mid = Number(binding('mid'));
      const result = binding('predicate') as boolean | null;
      return <div class="dg-binary-view" aria-label={`left ${left}, right ${right}, mid ${mid}, predicate ${result === null ? 'pending' : result}`}>
        <div class="dg-binary-track"><For each={Array.from({ length: Math.max(6, right + 1) }, (_, index) => index)}>{index => <span classList={{ 'in-range': index >= left && index < right, 'is-mid': index === mid }}><small>{index}</small></span>}</For></div>
        <div class="dg-binary-readout"><code>L {left} · M {mid} · R {right}</code><span class="dg-bool" classList={{ 'is-true': result === true, 'is-false': result === false }}>{result === null ? 'pending' : result ? 'true' : 'false'}</span></div>
      </div>;
    })()}</Match>
    <Match when={props.view.template === 'grid'}><div class="dg-grid-view"><MiniGrid board={binding('board') as number[][]} position={binding('position') as [number, number]} /><code>{`(${(binding('position') as [number, number]).join(', ')})`}</code></div></Match>
  </Switch>;
}

function RelationGraph(props: { graph: TraceGraph; selectedSeq: number; onSelect: (seq: number) => void }) {
  const [zoom, setZoom] = createSignal(100);
  const nodes = createMemo(() => new Map(props.graph.nodes.map(node => [node.id, node])));
  const endpoint = (id: string): GraphNode => nodes().get(id)!;
  const edgePath = (from: string, to: string) => {
    const a = endpoint(from), b = endpoint(to), middle = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y + 18} C ${a.x} ${middle}, ${b.x} ${middle}, ${b.x} ${b.y - 18}`;
  };
  return <section class="dg-graph" aria-label="Record relation graph">
    <div class="dg-graph-meta"><div><strong>{props.graph.mode === 'transition' ? 'Transition graph' : 'Span hierarchy'}</strong><span>{props.graph.mode === 'transition' ? 'Edges follow explicit from references' : 'Parents follow span ID prefixes'}</span></div><label>Zoom <input type="range" min="70" max="140" value={zoom()} onInput={event => setZoom(Number(event.currentTarget.value))} /><output>{zoom()}%</output></label></div>
    <div class="dg-graph-scroll"><svg viewBox={`0 0 1000 ${props.graph.height}`} style={{ width: `${zoom() * 10}px`, height: `${props.graph.height * zoom() / 100}px` }} role="img" aria-label={props.graph.mode === 'transition' ? 'Graph of explicit from references' : 'Graph of span prefixes and records'}>
      <For each={props.graph.edges}>{edge => <path class="dg-graph-edge" classList={{ 'is-selected': edge.to === `seq:${props.selectedSeq}` }} d={edgePath(edge.from, edge.to)} />}</For>
      <For each={props.graph.nodes}>{node => <g class="dg-graph-node" classList={{ 'is-span': node.kind === 'span', 'is-selected': node.seq === props.selectedSeq, 'is-actionable': node.seq !== undefined }} transform={`translate(${node.x} ${node.y})`} role={node.seq !== undefined ? 'button' : undefined} tabindex={node.seq !== undefined ? 0 : undefined} aria-label={node.seq !== undefined ? `Record ${node.seq}, span ${node.detail}` : `Span ${node.label}`} onClick={() => node.seq !== undefined && props.onSelect(node.seq)} onKeyDown={event => { if (node.seq !== undefined && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); props.onSelect(node.seq); } }}>
        <circle r={node.kind === 'span' ? 23 : 18} /><text text-anchor="middle" dominant-baseline="central">{node.label}</text><title>{node.kind === 'span' ? `Span ${node.label}` : `seq ${node.label} / span ${node.detail}`}</title>
      </g>}</For>
    </svg></div>
    <div class="dg-graph-legend"><span><i class="dg-legend-span" />span</span><span><i class="dg-legend-record" />record</span><span><i class="dg-legend-current" />selected</span></div>
  </section>;
}

export default function DesignGalleryV2() {
  const [runId, setRunId] = createSignal('024');
  const [visible, setVisible] = createSignal<ValueKey[]>(['a', 'left', 'right', 'mid', 'ok']);
  const [formats, setFormats] = createSignal<Record<ValueKey, string>>({ a: 'bars', left: 'number', right: 'number', mid: 'number', ok: 'badge', seen: 'members', score: 'pairs', grid: 'mini', pos: 'coords' });
  const [views, setViews] = createSignal<AlgoView[]>([{ id: 1, template: 'binary', name: 'Binary search', bindings: { left: 'left', right: 'right', mid: 'mid', predicate: 'ok' } }]);
  const [visibleViews, setVisibleViews] = createSignal<number[]>([1]);
  const [seq, setSeq] = createSignal(4);
  const [display, setDisplay] = createSignal<'table' | 'graph'>('table');
  const [collapsed, setCollapsed] = createSignal<string[]>([]);
  const [diffOnly, setDiffOnly] = createSignal(false);
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [dialogStage, setDialogStage] = createSignal<'choose' | 'bind'>('choose');
  const [editingView, setEditingView] = createSignal<number | null>(null);
  const [template, setTemplate] = createSignal<Template>('binary');
  const [draft, setDraft] = createSignal<Record<string, ValueKey>>({ left: 'left', right: 'right', mid: 'mid', predicate: 'ok' });
  const run = createMemo(() => sampleRuns.find(item => item.id === runId())!);
  const frames = createMemo(() => framesForRun(runId()));
  const selected = createMemo(() => frames()[seq()] ?? frames()[0]);
  const tree = createMemo(() => groupFrames(frames()));
  const graph = createMemo(() => deriveGraph(frames()));
  const activeViews = createMemo(() => views().filter(view => visibleViews().includes(view.id)));
  const columnCount = createMemo(() => 2 + visible().length + activeViews().length);
  const toggleValue = (key: ValueKey) => setVisible(current => current.includes(key) ? current.filter(item => item !== key) : valueColumns.map(column => column.key).filter(item => current.includes(item) || item === key));
  const toggleView = (id: number) => setVisibleViews(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleGroup = (path: number[]) => setCollapsed(current => current.includes(pathKey(path)) ? current.filter(item => item !== pathKey(path)) : [...current, pathKey(path)]);
  const prepareDialog = (view?: AlgoView) => {
    setEditingView(view?.id ?? null);
    setDialogStage(view ? 'bind' : 'choose');
    setTemplate(view?.template ?? 'binary');
    setDraft(view?.bindings ?? Object.fromEntries(templateSpecs.binary.roles.map(role => [role.key, role.initial])) as Record<string, ValueKey>);
    setDialogOpen(true);
  };
  const chooseTemplate = (next: Template) => {
    setTemplate(next);
    setDraft(Object.fromEntries(templateSpecs[next].roles.map(role => [role.key, role.initial])) as Record<string, ValueKey>);
    setDialogStage('bind');
  };
  const saveView = () => {
    const oldId = editingView();
    if (oldId !== null) setViews(current => current.map(view => view.id === oldId ? { ...view, template: template(), name: templateSpecs[template()].name, bindings: { ...draft() } } : view));
    else { const id = Math.max(0, ...views().map(view => view.id)) + 1; setViews(current => [...current, { id, template: template(), name: templateSpecs[template()].name, bindings: { ...draft() } }]); setVisibleViews(current => [...current, id]); }
    setDialogOpen(false);
  };
  const renderNode = (node: HistoryNode, depth: number): JSX.Element => {
    if (node.kind === 'group') return <>
      <tr class="dg-group-row"><td colspan={columnCount()}><button style={{ '--depth': String(depth) }} aria-expanded={!collapsed().includes(pathKey(node.path))} onClick={() => toggleGroup(node.path)}><span class="dg-fold"><Show when={collapsed().includes(pathKey(node.path))} fallback={<IconChevronDown size="13" />}><IconChevronRight size="13" /></Show></span><code>{pathText(node.path)}</code><span>{countFrames(node.children)} records</span><i /></button></td></tr>
      <Show when={!collapsed().includes(pathKey(node.path))}><For each={node.children}>{child => renderNode(child, depth + 1)}</For></Show>
    </>;
    const frame = node.frame;
    return <tr class="dg-frame-row" classList={{ 'is-selected': seq() === frame.seq }} onClick={() => setSeq(frame.seq)}>
      <th scope="row"><button aria-label={`Select record ${frame.seq}`} style={{ '--depth': String(depth) }} onClick={() => setSeq(frame.seq)}><span class="dg-seq-dot" />{String(frame.seq).padStart(2, '0')}</button></th>
      <td class="dg-source-cell"><code>{frame.source}</code><Show when={frame.from !== undefined}><span>from {frame.from}</span></Show></td>
      <For each={visible()}>{key => <td class={`dg-value-cell dg-value-${key}`}><Show when={!diffOnly() || frame.changed.includes(key)} fallback={<span class="dg-quiet">—</span>}><RawValue frame={frame} column={key} format={formats()[key]} /></Show></td>}</For>
      <For each={activeViews()}>{view => <td class="dg-algo-cell"><AlgoCell view={view} snapshot={frame.values} /></td>}</For>
    </tr>;
  };

  return <div class="design-gallery dg-index">
    <header class="dg-app-header"><div class="dg-brand"><span class="dg-mark"><IconGitBranch size="18" stroke="2" /></span><strong>algo-vis</strong><span class="dg-brand-divider" /><span>Data history</span></div><div class="dg-header-meta"><span class="dg-live-dot" />run {runId()}<span class="dg-header-divider" />main.rs<small>Interactive design mock</small></div></header>
    <Resizable class="dg-horizontal" initialSizes={[0.15, 0.85]}>
      <Resizable.Panel minSize={0.13} maxSize={0.3} class="dg-side-panel">
        <Resizable orientation="vertical" class="dg-vertical" initialSizes={[0.66, 0.34]}>
          <Resizable.Panel minSize={0.4} class="dg-top-panel"><aside class="dg-config" aria-label="Visible columns and Algo Views">
            <div class="dg-section-title"><h2><IconEye size="16" stroke="1.8" />Values</h2><span>{visible().length} / {valueColumns.length}</span></div>
            <div class="dg-column-list"><For each={valueColumns}>{column => <div class="dg-column"><label><input type="checkbox" checked={visible().includes(column.key)} onChange={() => toggleValue(column.key)} /><span class={`dg-type-mark dg-type-${column.kind}`} /><code>{column.label}</code><small>{column.kind}</small></label></div>}</For></div>
            <div class="dg-algo-heading"><h2><IconBinaryTree size="16" stroke="1.8" />Algo Views</h2><button class="dg-add-view" aria-label="Add Algo View" onClick={() => prepareDialog()}><IconPlus size="16" stroke="1.8" /></button></div>
            <div class="dg-view-list"><For each={views()}>{view => <div class="dg-view-item"><label><input type="checkbox" checked={visibleViews().includes(view.id)} onChange={() => toggleView(view.id)} /><span class="dg-view-glyph"><Show when={view.template === 'binary'} fallback={<IconGridDots size="15" stroke="1.8" />}><IconGitBranch size="15" stroke="1.8" /></Show></span><span><strong>{view.name}</strong><small>{Object.entries(view.bindings).map(([role, key]) => `${role}=${key}`).join('  ')}</small></span></label><button aria-label={`Edit ${view.name} bindings`} onClick={() => prepareDialog(view)}><IconSettings size="15" stroke="1.8" /></button></div>}</For></div>
          </aside></Resizable.Panel>
          <Resizable.Handle class="dg-resize-handle dg-resize-vertical" aria-label="Resize sidebar sections" />
          <Resizable.Panel minSize={0.2} class="dg-bottom-panel"><aside class="dg-runs" aria-label="Run history"><div class="dg-section-title"><h2><IconHistory size="16" stroke="1.8" />Runs</h2><span>{sampleRuns.length}</span></div><div class="dg-run-list"><For each={sampleRuns}>{item => <button classList={{ active: runId() === item.id }} onClick={() => { setRunId(item.id); setSeq(4); setCollapsed([]); }}><span class="dg-run-line"><strong>run {item.id}</strong><time>{item.time}</time></span><code>main.rs</code><span class="dg-run-sub">{item.input}<span>{item.status}</span></span><small>{item.hasFrom ? 'Transition links' : 'Span hierarchy'}</small></button>}</For></div></aside></Resizable.Panel>
        </Resizable>
      </Resizable.Panel>
      <Resizable.Handle class="dg-resize-handle dg-resize-horizontal" aria-label="Resize sidebar" />
      <Resizable.Panel minSize={0.5} class="dg-main-panel"><main class="dg-main">
        <header class="dg-main-title"><div><p>run {runId()} / {run().input}</p><h1>Value history</h1></div><div class="dg-main-summary"><strong>{frames().length} records</strong><span>{graph().mode === 'transition' ? 'Linked by from' : 'Grouped by span prefix'}</span></div></header>
        <div class="dg-history-toolbar"><div><h2>{display() === 'table' ? 'Records by span' : 'Record relations'}</h2><span>{display() === 'table' ? 'Each row shows recorded values and configured Algo Views' : graph().mode === 'transition' ? 'Edges follow explicit from references' : 'Parents follow span ID prefixes'}</span></div><div class="dg-toolbar-actions"><Show when={display() === 'table'}><label class="dg-diff-control"><input type="checkbox" checked={diffOnly()} onChange={event => setDiffOnly(event.currentTarget.checked)} />Changes only</label></Show><div class="dg-view-switch" role="group" aria-label="History view"><button classList={{ active: display() === 'table' }} aria-pressed={display() === 'table'} onClick={() => setDisplay('table')}><IconTable size="16" stroke="1.8" />Table</button><button classList={{ active: display() === 'graph' }} aria-pressed={display() === 'graph'} onClick={() => setDisplay('graph')}><IconGitBranch size="16" stroke="1.8" />Graph</button></div></div></div>
        <Show when={display() === 'table'} fallback={<div class="dg-graph-layout"><RelationGraph graph={graph()} selectedSeq={seq()} onSelect={setSeq} /><section class="dg-record-inspector"><div><strong>seq {String(seq()).padStart(2, '0')}</strong><span>{pathText(selected().span)} · {selected().source}</span></div><div class="dg-inspector-values"><For each={visible()}>{key => <div><small>{key}</small><RawValue frame={selected()} column={key} format={formats()[key]} /></div>}</For><For each={activeViews()}>{view => <div class="dg-inspector-algo"><small>{view.name}</small><AlgoCell view={view} snapshot={selected().values} /></div>}</For></div></section></div>}>
          <div class="dg-table-scroll"><table class="dg-history-table"><thead><tr><th scope="col">seq</th><th scope="col">source / from</th><For each={visible()}>{key => { const column = valueColumns.find(item => item.key === key)!; return <th scope="col" class={`dg-heading-${column.kind}`}><div class="dg-column-head"><span><code>{column.label}</code><small>{column.kind}</small></span><FormatMenu column={column} format={formats()[key]} onSelect={format => setFormats(current => ({ ...current, [key]: format }))} /></div></th>; }}</For><For each={activeViews()}>{view => <th scope="col" class="dg-heading-algo"><div class="dg-column-head"><span><code>{view.name}</code><small>Algo View</small></span><button class="dg-algo-head-action" aria-label={`Edit ${view.name} bindings`} onClick={() => prepareDialog(view)}><IconSettings size="17" stroke="1.8" /></button></div></th>}</For></tr></thead><tbody><For each={tree()}>{node => renderNode(node, 0)}</For></tbody></table></div>
        </Show>
        <footer class="dg-playback"><div class="dg-transport"><button aria-label="Previous record" disabled={seq() === 0} onClick={() => setSeq(value => Math.max(0, value - 1))}><IconChevronLeft size="16" stroke="1.8" /></button><button aria-label="Next record" disabled={seq() === frames().length - 1} onClick={() => setSeq(value => Math.min(frames().length - 1, value + 1))}><IconChevronRight size="16" stroke="1.8" /></button></div><span><strong>seq {String(seq()).padStart(2, '0')}</strong><code>{pathText(selected().span)}</code></span><input aria-label="Record position" type="range" min="0" max={frames().length - 1} value={seq()} onInput={event => setSeq(Number(event.currentTarget.value))} /><small>{selected().source}</small></footer>
      </main></Resizable.Panel>
    </Resizable>
    <Dialog open={dialogOpen()} onOpenChange={setDialogOpen}><Dialog.Portal><Dialog.Overlay class="dg-dialog-overlay" /><div class="dg-dialog-positioner"><Dialog.Content class="dg-dialog dg-index"><div class="dg-dialog-header"><Dialog.Title>{editingView() === null ? dialogStage() === 'choose' ? 'Add an Algo View' : `Configure ${templateSpecs[template()].name}` : `Edit ${templateSpecs[template()].name}`}</Dialog.Title><Dialog.CloseButton aria-label="Close dialog"><IconX size="18" stroke="1.8" /></Dialog.CloseButton></div><Dialog.Description>{dialogStage() === 'choose' ? 'Choose a visualizer. Then bind its inputs to recorded values.' : templateSpecs[template()].description}</Dialog.Description>
      <Show when={dialogStage() === 'choose'} fallback={<><div class="dg-binding-list"><For each={templateSpecs[template()].roles}>{role => <div class="dg-binding-row"><div class="dg-binding-heading"><strong>{role.key}</strong><small>{role.kind}</small></div><div class="dg-binding-current"><IconCode size="15" stroke="1.8" /><code>{draft()[role.key]}</code></div><div class="dg-binding-choices"><For each={valueColumns.filter(column => column.kind === role.kind)}>{column => <button classList={{ active: draft()[role.key] === column.key }} onClick={() => setDraft(current => ({ ...current, [role.key]: column.key }))}><code>{column.label}</code><Show when={draft()[role.key] === column.key}><IconCheck size="14" stroke="2" /></Show></button>}</For></div></div>}</For></div><div class="dg-dialog-actions"><Show when={editingView() === null}><button class="dg-back-action" onClick={() => setDialogStage('choose')}><IconChevronLeft size="16" stroke="1.8" />Back</button></Show><button class="dg-primary-action" onClick={saveView}><IconCheck size="16" stroke="1.8" />{editingView() === null ? 'Add column' : 'Save bindings'}</button></div></>}>
        <div class="dg-template-grid"><button onClick={() => chooseTemplate('binary')}><IconGitBranch size="28" stroke="1.5" /><strong>Binary search</strong><span>Bounds, midpoint, predicate</span></button><button onClick={() => chooseTemplate('grid')}><IconGridDots size="28" stroke="1.5" /><strong>Grid traversal</strong><span>Grid with current position</span></button></div>
      </Show>
    </Dialog.Content></div></Dialog.Portal></Dialog>
  </div>;
}
