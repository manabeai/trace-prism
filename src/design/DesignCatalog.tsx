import { createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Dialog } from '@kobalte/core/dialog';
import { Popover } from '@kobalte/core/popover';
import { Tooltip } from '@kobalte/core/tooltip';
import {
  IconArrowLeft,
  IconBinaryTree,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconExternalLink,
  IconInfoCircle,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconTable,
  IconX,
} from '@tabler/icons-solidjs';
import '@fontsource-variable/newsreader/wght.css';
import { BrandMark } from './BrandMark';
import './design-catalog.css';

const colors = [
  { name: 'Canvas', hex: '#f1f2ec', use: 'Workspace background' },
  { name: 'Sheet', hex: '#fafbf7', use: 'Data and overlay surface' },
  { name: 'Sidebar', hex: '#e9ede6', use: 'Supporting navigation' },
  { name: 'Ink', hex: '#263e39', use: 'Primary text' },
  { name: 'Rule', hex: '#cbd6cc', use: 'Dividers' },
  { name: 'Action', hex: '#3f7065', use: 'Selection and focus' },
  { name: 'Copper', hex: '#ae724e', use: 'Changed value' },
] as const;

const formats = [
  { id: 'cells', label: 'Cells', icon: IconTable },
  { id: 'bars', label: 'Bars', icon: IconChartBar },
  { id: 'text', label: 'Text', icon: IconCode },
] as const;
type Format = (typeof formats)[number]['id'];

const frames = [
  { seq: 4, span: '[0, 2]', value: 11, changed: false, source: 'main.rs:19' },
  { seq: 5, span: '[0, 2]', value: 11, changed: false, source: 'main.rs:22' },
  { seq: 6, span: '[0, 3]', value: 15, changed: true, source: 'main.rs:19' },
  { seq: 7, span: '[0, 3]', value: 15, changed: false, source: 'main.rs:22' },
] as const;

const recordedValues = [
  { name: 'a', kind: 'Array' },
  { name: 'left', kind: 'Int' },
  { name: 'mid', kind: 'Int' },
  { name: 'right', kind: 'Int' },
  { name: 'visited', kind: 'Set' },
] as const;

const runs = ['binary-search.rs', 'grid-search.rs'] as const;

function Specimen(props: { title: string; note: string; children: import('solid-js').JSX.Element }) {
  return (
    <section class="ct-specimen">
      <div class="ct-specimen-head">
        <h3>{props.title}</h3>
        <p>{props.note}</p>
      </div>
      {props.children}
    </section>
  );
}

function ArrayPreview(props: { format: Format }) {
  const values = [3, 7, 11, 15, 19, 23];
  return (
    <div class="ct-array-preview">
      <Show when={props.format === 'cells'}>
        <div class="ct-array-cells" aria-label="Array values 3, 7, 11, 15, 19, 23">
          <For each={values}>
            {(value, index) => (
              <div classList={{ 'is-changed': index() === 3 }}>
                <small>{index()}</small>
                <strong>{value}</strong>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.format === 'bars'}>
        <div class="ct-array-bars" role="img" aria-label="Bar chart of values 3, 7, 11, 15, 19, 23">
          <For each={values}>
            {(value, index) => (
              <div classList={{ 'is-changed': index() === 3 }}>
                <strong>{value}</strong>
                <i style={{ height: `${(value / 23) * 76}px` }} />
                <small>{index()}</small>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.format === 'text'}>
        <code class="ct-array-text">
          [3, 7, 11, <mark>15</mark>, 19, 23]
        </code>
      </Show>
    </div>
  );
}

export default function DesignCatalog() {
  const [format, setFormat] = createSignal<Format>('cells');
  const [formatOpen, setFormatOpen] = createSignal(false);
  const [selectedSeq, setSelectedSeq] = createSignal(6);
  const [onlyChanges, setOnlyChanges] = createSignal(false);
  const [search, setSearch] = createSignal('');
  const [visibleNames, setVisibleNames] = createSignal<string[]>(recordedValues.map((value) => value.name));
  const [selectedRun, setSelectedRun] = createSignal<string>(runs[0]);
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const selected = () => frames.find((frame) => frame.seq === selectedSeq())!;
  const visibleFrames = () => frames.filter((frame) => !onlyChanges() || frame.changed);
  const activeFormat = () => formats.find((option) => option.id === format())!;
  const matchingValues = () =>
    recordedValues.filter((value) => value.name.toLowerCase().includes(search().trim().toLowerCase()));
  const toggleValue = (name: string) =>
    setVisibleNames((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  const cycleFormat = () => {
    const index = formats.findIndex((option) => option.id === format());
    setFormat(formats[(index + 1) % formats.length].id);
  };
  const chooseSeq = (seq: number) => {
    if (onlyChanges() && !frames.find((frame) => frame.seq === seq)?.changed) setOnlyChanges(false);
    setSelectedSeq(seq);
  };

  return (
    <div class="ct-root">
      <header class="ct-topbar">
        <a href="/" class="ct-brand" aria-label="TracePrism workspace">
          <BrandMark />
          <strong>TracePrism</strong>
        </a>
        <span>Field Notes · component catalog</span>
        <a href="/flavors?theme=field-notes" class="ct-top-link">
          Compare flavors <IconExternalLink size="15" stroke="1.8" />
        </a>
      </header>

      <div class="ct-layout">
        <nav class="ct-nav" aria-label="Catalog sections">
          <p>Catalog</p>
          <a href="#foundation">Foundation</a>
          <a href="#controls">Controls</a>
          <a href="#values">Values</a>
          <a href="#history">History</a>
          <a href="#overlays">Overlays</a>
          <a href="/catalog/search">Search prototype ↗</a>
          <div class="ct-nav-foot">
            <span class="ct-status-dot" /> Active design system
            <br />
            <small>Used in the live workspace</small>
          </div>
        </nav>

        <main class="ct-main">
          <div class="ct-intro">
            <a href="/flavors?theme=field-notes">
              <IconArrowLeft size="15" stroke="1.8" /> Back to comparison
            </a>
            <h1>Field Notes</h1>
            <p>
              A quieter surface for reading a trace over time. The data keeps its precision; the frame gives
              it room.
            </p>
            <span>Interactive component reference</span>
          </div>

          <section id="foundation" class="ct-section">
            <div class="ct-section-title">
              <h2>Foundation</h2>
              <p>Material, typography, and the rules that hold the workspace together.</p>
            </div>
            <Specimen
              title="Material palette"
              note="Thin rules separate regions; color carries meaning only where state changes."
            >
              <div class="ct-swatches">
                <For each={colors}>
                  {(color) => (
                    <div class="ct-swatch">
                      <div style={{ 'background-color': color.hex }} />
                      <strong>{color.name}</strong>
                      <code>{color.hex}</code>
                      <small>{color.use}</small>
                    </div>
                  )}
                </For>
              </div>
            </Specimen>
            <Specimen
              title="Type roles"
              note="A serif voice for orientation, a workhorse sans for controls, mono for recorded data."
            >
              <div class="ct-type-grid">
                <div>
                  <small>Display · Newsreader</small>
                  <p class="ct-type-display">A record of each step.</p>
                </div>
                <div>
                  <small>Interface · IBM Plex Sans</small>
                  <p class="ct-type-interface">Choose what to inspect, then follow the change.</p>
                </div>
                <div>
                  <small>Data · IBM Plex Mono</small>
                  <p class="ct-type-data">seq 06 · a[3] 11 → 15</p>
                </div>
              </div>
            </Specimen>
          </section>

          <section id="controls" class="ct-section">
            <div class="ct-section-title">
              <h2>Controls</h2>
              <p>Compact enough for a dense workspace, legible enough to stand alone.</p>
            </div>
            <Specimen
              title="Actions and inputs"
              note="Focus, selected, empty, and disabled states belong to the same system."
            >
              <div class="ct-control-row">
                <button class="ct-button ct-button-primary" type="button" onClick={() => setDialogOpen(true)}>
                  <IconPlus size="16" stroke="1.8" /> Add View
                </button>
                <button class="ct-button" type="button" onClick={() => chooseSeq(7)}>
                  Jump to latest
                </button>
                <button class="ct-button ct-button-quiet" type="button" disabled>
                  Export trace
                </button>
              </div>
              <div class="ct-control-row ct-input-row">
                <label class="ct-search">
                  <IconSearch size="16" stroke="1.8" />
                  <input
                    aria-label="Filter recorded values"
                    placeholder="Filter recorded values"
                    value={search()}
                    onInput={(event) => setSearch(event.currentTarget.value)}
                  />
                </label>
                <span class="ct-search-feedback" aria-live="polite">
                  {matchingValues().length} of {recordedValues.length} values
                </span>
              </div>
              <div class="ct-filter-results" aria-label="Matching recorded values">
                <For each={matchingValues()} fallback={<span>No values match “{search()}”.</span>}>
                  {(value) => (
                    <span>
                      <code>{value.name}</code>
                      <small>{value.kind}</small>
                    </span>
                  )}
                </For>
              </div>
            </Specimen>
          </section>

          <section id="values" class="ct-section">
            <div class="ct-section-title">
              <h2>Values</h2>
              <p>A recorded value may have several presentations. The choice lives in its column header.</p>
            </div>
            <Specimen
              title="Array presentation"
              note="Change the format from the title control. Copper marks the changed element at this sequence."
            >
              <div class="ct-value-head">
                <div>
                  <code>a</code>
                  <span>Array&lt;Int&gt; · seq 06</span>
                </div>
                <Popover open={formatOpen()} onOpenChange={setFormatOpen}>
                  <Popover.Trigger class="ct-format-trigger" aria-label="Change a display format">
                    <Dynamic component={activeFormat().icon} size="17" stroke="1.8" /> {activeFormat().label}{' '}
                    <IconChevronDown size="13" stroke="1.8" />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content class="ct-popover">
                      <Popover.Title>Display a</Popover.Title>
                      <div class="ct-format-options">
                        <For each={formats}>
                          {(option) => (
                            <button
                              type="button"
                              classList={{ 'is-active': format() === option.id }}
                              onClick={() => {
                                setFormat(option.id);
                                setFormatOpen(false);
                              }}
                            >
                              <Dynamic component={option.icon} size="18" stroke="1.8" />
                              <span>{option.label}</span>
                              <Show when={format() === option.id}>
                                <IconCheck size="16" stroke="1.8" />
                              </Show>
                            </button>
                          )}
                        </For>
                      </div>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover>
              </div>
              <ArrayPreview format={format()} />
              <div class="ct-value-foot">
                <span>
                  <i /> Changed at index 3
                </span>
                <code>11 → 15</code>
              </div>
            </Specimen>
            <Specimen
              title="Other recorded values"
              note="Distinct structures, shared row rhythm and change treatment."
            >
              <div class="ct-compact-values">
                <div>
                  <code>visited</code>
                  <span>Set&lt;Int&gt;</span>
                  <strong>{'{ 2, 5, 8 }'}</strong>
                </div>
                <div>
                  <code>distance</code>
                  <span>Map&lt;Int, Int&gt;</span>
                  <strong>{'{ 2: 0, 5: 1 }'}</strong>
                </div>
                <div>
                  <code>found</code>
                  <span>Bool</span>
                  <strong>true</strong>
                </div>
              </div>
            </Specimen>
          </section>

          <section id="history" class="ct-section">
            <div class="ct-section-title">
              <h2>History</h2>
              <p>Chronology stays primary. Span grouping adds context without hiding sequence order.</p>
            </div>
            <Specimen
              title="Workspace rail"
              note="Value visibility and independent runs share the same narrow sidebar."
            >
              <div class="ct-workspace-rail">
                <div class="ct-rail-group">
                  <div class="ct-rail-heading">
                    <strong>Values</strong>
                    <small>
                      {visibleNames().length} / {recordedValues.length}
                    </small>
                  </div>
                  <For each={recordedValues}>
                    {(value) => (
                      <label>
                        <input
                          type="checkbox"
                          checked={visibleNames().includes(value.name)}
                          onChange={() => toggleValue(value.name)}
                        />
                        <code>{value.name}</code>
                        <small>{value.kind}</small>
                      </label>
                    )}
                  </For>
                </div>
                <div class="ct-rail-group ct-rail-runs">
                  <div class="ct-rail-heading">
                    <strong>Runs</strong>
                    <small>{runs.length}</small>
                  </div>
                  <For each={runs}>
                    {(run) => (
                      <button
                        type="button"
                        classList={{ 'is-selected': selectedRun() === run }}
                        aria-pressed={selectedRun() === run}
                        onClick={() => setSelectedRun(run)}
                      >
                        <IconPlayerPlay size="14" stroke="1.8" />
                        <span>{run}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Specimen>
            <Specimen
              title="Sequence and inspection"
              note="Select a row, or isolate only the steps that changed the current value."
            >
              <div class="ct-history-toolbar">
                <span>
                  Sample run <code>binary-search.rs</code>
                </span>
                <label>
                  <input
                    type="checkbox"
                    checked={onlyChanges()}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setOnlyChanges(checked);
                      if (checked && !selected().changed)
                        setSelectedSeq(frames.find((frame) => frame.changed)!.seq);
                    }}
                  />{' '}
                  Changes only
                </label>
              </div>
              <div class="ct-history-layout">
                <div class="ct-sequences" role="group" aria-label="Recorded sequences">
                  <For each={visibleFrames()}>
                    {(frame) => (
                      <button
                        type="button"
                        classList={{ 'is-selected': selectedSeq() === frame.seq }}
                        aria-pressed={selectedSeq() === frame.seq}
                        onClick={() => chooseSeq(frame.seq)}
                      >
                        <span class="ct-seq-num">{String(frame.seq).padStart(2, '0')}</span>
                        <span>
                          <strong>span {frame.span}</strong>
                          <small>{frame.source}</small>
                        </span>
                        <Show when={frame.changed}>
                          <i class="ct-change-dot" title="Value changed" />
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
                <div class="ct-inspection">
                  <small>Selected sequence</small>
                  <strong>#{String(selected().seq).padStart(2, '0')}</strong>
                  <p>span {selected().span}</p>
                  <div>
                    <code>a[3]</code>
                    <span>{selected().value}</span>
                  </div>
                  <small>{selected().changed ? 'Changed from 11' : 'No change to a[3]'}</small>
                </div>
              </div>
            </Specimen>
            <Specimen
              title="Span table and timeline"
              note="Group headers expose nesting; columns stay comparable as the selected sequence moves."
            >
              <div class="ct-table-scroll">
                <table class="ct-trace-table">
                  <thead>
                    <tr>
                      <th scope="col">seq</th>
                      <th scope="col">source</th>
                      <th scope="col">
                        <span>
                          a{' '}
                          <button
                            type="button"
                            aria-label="Cycle a column format"
                            title={`a: ${activeFormat().label}`}
                            onClick={cycleFormat}
                          >
                            <Dynamic component={activeFormat().icon} size="15" stroke="1.8" />
                          </button>
                        </span>
                      </th>
                      <th scope="col">mid</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="ct-trace-root">
                      <th scope="rowgroup" colspan="4">
                        <IconBinaryTree size="14" stroke="1.8" /> span [0]
                      </th>
                    </tr>
                  </tbody>
                  <For each={['[0, 2]', '[0, 3]']}>
                    {(span) => (
                      <tbody>
                        <tr class="ct-trace-group">
                          <th scope="rowgroup" colspan="4">
                            <span class="ct-group-level">span {span}</span>
                          </th>
                        </tr>
                        <For each={frames.filter((frame) => frame.span === span)}>
                          {(frame) => (
                            <tr classList={{ 'is-selected': selectedSeq() === frame.seq }}>
                              <th scope="row">
                                <button
                                  type="button"
                                  aria-label={`Select sequence ${frame.seq}`}
                                  onClick={() => chooseSeq(frame.seq)}
                                >
                                  {String(frame.seq).padStart(2, '0')}
                                </button>
                              </th>
                              <td>
                                <code>{frame.source}</code>
                              </td>
                              <td>
                                <Show
                                  when={format() === 'bars'}
                                  fallback={
                                    <code classList={{ 'is-changed': frame.changed }}>
                                      [3, 7, 11, {frame.value}, 19, 23]
                                    </code>
                                  }
                                >
                                  <span
                                    class="ct-mini-bars"
                                    role="img"
                                    aria-label={`Array with fourth value ${frame.value}`}
                                  >
                                    <For each={[3, 7, 11, frame.value, 19, 23]}>
                                      {(value) => <i style={{ height: `${(value / 23) * 19}px` }} />}
                                    </For>
                                  </span>
                                </Show>
                              </td>
                              <td>
                                <code>{frame.seq < 6 ? '2' : '3'}</code>
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    )}
                  </For>
                </table>
              </div>
              <div class="ct-timeline">
                <span>04</span>
                <input
                  type="range"
                  min="4"
                  max="7"
                  value={selectedSeq()}
                  aria-label="Selected sequence"
                  onInput={(event) => chooseSeq(Number(event.currentTarget.value))}
                />
                <span>07</span>
                <strong>#{String(selectedSeq()).padStart(2, '0')}</strong>
              </div>
            </Specimen>
          </section>

          <section id="overlays" class="ct-section">
            <div class="ct-section-title">
              <h2>Overlays</h2>
              <p>Context stays close to the action. Only configuration asks for a modal.</p>
            </div>
            <Specimen
              title="Tooltip and dialog"
              note="Hover or focus the info icon; open the configuration dialog from the button."
            >
              <div class="ct-control-row">
                <span class="ct-inline-label">Value difference</span>
                <Tooltip>
                  <Tooltip.Trigger class="ct-icon-button" aria-label="Explain value difference">
                    <IconInfoCircle size="18" stroke="1.8" />
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content class="ct-tooltip">
                      At seq 06, <code>a[3]</code> changed from <code>11</code> to <code>15</code>.
                      <Tooltip.Arrow />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip>
                <button type="button" class="ct-button" onClick={() => setDialogOpen(true)}>
                  Open configuration
                </button>
              </div>
            </Specimen>
          </section>
          <footer class="ct-footer">
            Field Notes is the visual language of the TracePrism workspace. Sample values on this page are
            fixed.
          </footer>
        </main>
      </div>

      <Dialog open={dialogOpen()} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="ct-dialog-overlay" />
          <div class="ct-dialog-positioner">
            <Dialog.Content class="ct-dialog">
              <div class="ct-dialog-head">
                <Dialog.Title>Add View</Dialog.Title>
                <Dialog.CloseButton class="ct-icon-button" aria-label="Close dialog">
                  <IconX size="18" stroke="1.8" />
                </Dialog.CloseButton>
              </div>
              <Dialog.Description>
                Bind recorded values to a visualization. This catalog shows the configuration surface only.
              </Dialog.Description>
              <div class="ct-binding">
                <strong>Range &amp; marker</strong>
                <span>
                  Map <code>left</code>, <code>mid</code>, and <code>right</code> to recorded values.
                </span>
                <div>
                  <code>left</code>
                  <code>mid</code>
                  <code>right</code>
                </div>
              </div>
              <div class="ct-dialog-actions">
                <button class="ct-button" type="button" onClick={() => setDialogOpen(false)}>
                  Cancel
                </button>
                <button
                  class="ct-button ct-button-primary"
                  type="button"
                  onClick={() => setDialogOpen(false)}
                >
                  Use this view
                </button>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
    </div>
  );
}
