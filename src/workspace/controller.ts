import { createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { Column, Run } from '../trace/types';
import type { RunId, Seq } from '../trace/ids';
import { deriveGraph } from '../trace/relation-graph';
import { groupFrames } from '../trace/span-tree';
import { materialize } from '../trace/materialize';
import { formatOptions } from '../presentations/values/registry';
import {
  candidateNames,
  templates,
  validBindings,
  type AlgoView,
  type Role,
  type Template,
} from '../presentations/algo/registry';
import { HttpRunRepository } from '../runs/HttpRunRepository';
import type { RunRepository } from '../runs/RunRepository';
import { pollRuns } from '../runs/pollRuns';

type Display = 'table' | 'graph';
type RunState = {
  selectedSeq: Seq | null;
  visible: string[] | null;
  formats: Record<string, string>;
  collapsed: string[];
  display: Display;
  diffOnly: boolean;
};

const initialState = (): RunState => ({
  selectedSeq: null,
  visible: null,
  formats: {},
  collapsed: [],
  display: 'table',
  diffOnly: false,
});

export function createWorkspaceController(repository: RunRepository = new HttpRunRepository()) {
  const [runs, setRuns] = createSignal<Run[]>([]);
  const [runId, setRunId] = createSignal<RunId | null>(null);
  const [states, setStates] = createSignal<Record<string, RunState>>({});
  const [error, setError] = createSignal('');
  const [warning, setWarning] = createSignal('');
  const [viewsByRun, setViewsByRun] = createSignal<Record<string, AlgoView[]>>({});
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [stage, setStage] = createSignal<'choose' | 'bind'>('choose');
  const [template, setTemplate] = createSignal<Template>('binary');
  const [editingId, setEditingId] = createSignal<number | null>(null);
  const [draft, setDraft] = createSignal<Record<string, string>>({});

  const current = createMemo(() => runs().find((run) => run.id === runId()) ?? runs()[0]);
  const state = createMemo(() => states()[current()?.id ?? ''] ?? initialState());
  const updateState = (update: (previous: RunState) => RunState) => {
    const id = current()?.id;
    if (id) setStates((all) => ({ ...all, [id]: update(all[id] ?? initialState()) }));
  };
  const selectedSeq = () => state().selectedSeq;
  const setSelectedSeq = (seq: Seq | null) => updateState((previous) => ({ ...previous, selectedSeq: seq }));
  const visible = () => state().visible;
  const formats = () => state().formats;
  const setFormats = (update: (formats: Record<string, string>) => Record<string, string>) =>
    updateState((previous) => ({ ...previous, formats: update(previous.formats) }));
  const collapsed = () => state().collapsed;
  const setCollapsed = (update: (keys: string[]) => string[]) =>
    updateState((previous) => ({ ...previous, collapsed: update(previous.collapsed) }));
  const display = () => state().display;
  const setDisplay = (next: Display) => updateState((previous) => ({ ...previous, display: next }));
  const diffOnly = () => state().diffOnly;
  const setDiffOnly = (next: boolean) => updateState((previous) => ({ ...previous, diffOnly: next }));

  const model = createMemo(() => materialize(current()?.frames ?? []));
  const frames = createMemo(() => model().frames);
  const columns = createMemo(() => model().columns);
  const shownColumns = createMemo(() =>
    columns().filter((column) => visible() === null || visible()!.includes(column.name)),
  );
  const views = createMemo(() => viewsByRun()[current()?.id ?? ''] ?? []);
  const shownViews = createMemo(() => views().filter((view) => view.enabled));
  const selectedIndex = createMemo(() => {
    const index = frames().findIndex((frame) => frame.seq === selectedSeq());
    return index < 0 ? frames().length - 1 : index;
  });
  const selected = createMemo(() => frames()[selectedIndex()]);
  const tree = createMemo(() => groupFrames(frames()));
  const graph = createMemo(() => deriveGraph(frames()));
  const columnCount = createMemo(() => 2 + shownColumns().length + shownViews().length);

  onMount(() => {
    const stop = pollRuns(
      repository,
      (result) => {
        setRuns(result.runs);
        setWarning(result.errors.join('; '));
        setError('');
      },
      (cause) => setError(`Could not load runs: ${String(cause)}`),
    );
    onCleanup(stop);
  });

  const chooseRun = (id: RunId) => setRunId(id);
  const toggleColumn = (name: string) => {
    const all = columns().map((column) => column.name);
    updateState((previous) => {
      const currentNames = previous.visible ?? all;
      return {
        ...previous,
        visible: currentNames.includes(name)
          ? currentNames.filter((item) => item !== name)
          : all.filter((item) => currentNames.includes(item) || item === name),
      };
    });
  };
  const activeFormat = (column: Column) => {
    const options = formatOptions(column, frames());
    const selected = formats()[column.name];
    return options.some((option) => option.id === selected) ? selected : options[0].id;
  };
  const candidates = (role: Role) => candidateNames(frames(), role);
  const initialBindings = (next: Template) =>
    Object.fromEntries(
      templates[next].roles.map((role) => {
        const names = candidates(role);
        return [role.name, names.includes(role.name) ? role.name : (names[0] ?? '')];
      }),
    );
  const openDialog = (view?: AlgoView) => {
    setEditingId(view?.id ?? null);
    setTemplate(view?.template ?? 'binary');
    setStage(view ? 'bind' : 'choose');
    setDraft(view?.bindings ?? initialBindings('binary'));
    setDialogOpen(true);
  };
  const chooseTemplate = (next: Template) => {
    setTemplate(next);
    setDraft(initialBindings(next));
    setStage('bind');
  };
  const saveView = () => {
    const id = current()?.id;
    if (!id || !validBindings(templates[template()], draft(), frames())) return;
    const old = editingId();
    setViewsByRun((all) => {
      const items = all[id] ?? [];
      const next: AlgoView[] =
        old === null
          ? [
              ...items,
              {
                id: Math.max(0, ...items.map((item) => item.id)) + 1,
                template: template(),
                bindings: { ...draft() },
                enabled: true,
              },
            ]
          : items.map((item) =>
              item.id === old ? { ...item, template: template(), bindings: { ...draft() } } : item,
            );
      return { ...all, [id]: next };
    });
    setDialogOpen(false);
  };
  const toggleView = (id: number) => {
    const run = current()?.id;
    if (run)
      setViewsByRun((all) => ({
        ...all,
        [run]: (all[run] ?? []).map((view) => (view.id === id ? { ...view, enabled: !view.enabled } : view)),
      }));
  };

  return {
    runs,
    current,
    error,
    warning,
    visible,
    formats,
    setFormats,
    views,
    shownViews,
    display,
    setDisplay,
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
  };
}
