import { createSignal, For } from 'solid-js';
import { Tooltip } from '@kobalte/core/tooltip';
import {
  IconAdjustmentsHorizontal,
  IconBinaryTree,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCirclePlus,
  IconClockHour4,
  IconCode,
  IconColumns3,
  IconEye,
  IconGitBranch,
  IconInfoCircle,
  IconLayoutGrid,
  IconPlayerPlay,
  IconTable,
} from '@tabler/icons-solidjs';
import '@fontsource-variable/spline-sans/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/newsreader/wght.css';
import { BrandMark } from './BrandMark';
import './flavors.css';

const flavors = [
  {
    id: 'prism',
    name: 'Prism',
    description: 'Clear light, crisp hierarchy',
    type: 'Spline Sans / IBM Plex Mono',
    colors: ['#f5f7fb', '#ffffff', '#405ad4', '#213047'],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Low-glare, focused analysis',
    type: 'Manrope / IBM Plex Mono',
    colors: ['#121d24', '#1b2a33', '#81ccb3', '#f0b474'],
  },
  {
    id: 'field-notes',
    name: 'Field Notes',
    description: 'Calm, tactile, considered',
    type: 'Newsreader / IBM Plex Sans',
    colors: ['#f1f2ec', '#fafbf7', '#3f7065', '#ae724e'],
  },
] as const;

type FlavorId = (typeof flavors)[number]['id'];

const rows = [
  {
    seq: '04',
    source: 'main.rs:19',
    array: [3, 7, 11, 11, 19, 23],
    left: '0',
    mid: '2',
    right: '6',
    ok: 'false',
  },
  {
    seq: '05',
    source: 'main.rs:22',
    array: [3, 7, 11, 11, 19, 23],
    left: '3',
    mid: '4',
    right: '6',
    ok: 'true',
  },
  {
    seq: '06',
    source: 'main.rs:19',
    array: [3, 7, 11, 15, 19, 23],
    left: '3',
    mid: '3',
    right: '4',
    ok: 'false',
  },
  {
    seq: '07',
    source: 'main.rs:22',
    array: [3, 7, 11, 15, 19, 23],
    left: '4',
    mid: '4',
    right: '4',
    ok: 'true',
  },
] as const;

function isFlavor(value: string | null): value is FlavorId {
  return flavors.some((flavor) => flavor.id === value);
}

function BarArray(props: { values: readonly number[]; selected?: number }) {
  return (
    <div class="fl-bars" role="img" aria-label={`Array values: ${props.values.join(', ')}`}>
      <For each={props.values}>
        {(value, index) => (
          <span class="fl-bar" classList={{ 'is-active': index() === props.selected }}>
            <i style={{ height: `${Math.round((value / 23) * 77)}%` }} />
          </span>
        )}
      </For>
    </div>
  );
}

export default function FlavorGallery() {
  const requested = new URLSearchParams(window.location.search).get('theme');
  const [active, setActive] = createSignal<FlavorId>(isFlavor(requested) ? requested : 'field-notes');
  const choose = (id: FlavorId) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set('theme', id);
    window.history.replaceState(null, '', url);
  };
  const selected = () => flavors.find((flavor) => flavor.id === active())!;

  return (
    <main class="fl-gallery">
      <header class="fl-gallery-head">
        <div>
          <a class="fl-back" href="/">
            <IconChevronRight size="15" stroke="1.8" />
            Back to workspace
          </a>
          <h1>Visual language for TracePrism</h1>
          <p>One workspace, three material directions. Compare the same run before choosing a system.</p>
        </div>
        <span class="fl-gallery-badge">Design study</span>
      </header>

      <nav class="fl-switcher" aria-label="Choose a design flavor">
        <For each={flavors}>
          {(flavor) => (
            <button
              type="button"
              class="fl-choice"
              classList={{ 'is-active': active() === flavor.id }}
              aria-pressed={active() === flavor.id}
              onClick={() => choose(flavor.id)}
            >
              <span class="fl-choice-top">
                <strong>{flavor.name}</strong>
                <span class="fl-swatches" aria-hidden="true">
                  <For each={flavor.colors}>{(color) => <i style={{ 'background-color': color }} />}</For>
                </span>
              </span>
              <span class="fl-choice-description">{flavor.description}</span>
              <small>{flavor.type}</small>
            </button>
          )}
        </For>
      </nav>

      <div class="fl-preview-label">
        <div>
          <strong>{selected().name}</strong>
          <span>Identical content and layout across all three previews</span>
        </div>
        {active() === 'field-notes' ? (
          <a href="/catalog">
            Explore the Field Notes catalog <IconChevronRight size="14" stroke="1.8" />
          </a>
        ) : (
          <span>Interactive tooltip: hover or focus the info icon</span>
        )}
      </div>

      <div class="fl-preview-scroll">
        <div class="fl-preview" data-flavor={active()}>
          <div class="fl-app-header">
            <div class="fl-brand">
              <BrandMark />
              <strong>TracePrism</strong>
            </div>
          </div>

          <div class="fl-workspace">
            <aside class="fl-sidebar">
              <section class="fl-sidebar-top">
                <div class="fl-section-heading">
                  <h2>
                    <IconEye size="16" stroke="1.8" /> Values
                  </h2>
                  <small>5 / 5</small>
                </div>
                <div class="fl-variable-list">
                  <div>
                    <span class="fl-check">
                      <IconCheck size="11" stroke="2.5" />
                    </span>
                    <code>a</code>
                    <span class="fl-variable-type">Array</span>
                  </div>
                  <div>
                    <span class="fl-check">
                      <IconCheck size="11" stroke="2.5" />
                    </span>
                    <code>left</code>
                    <span class="fl-variable-type">Int</span>
                  </div>
                  <div>
                    <span class="fl-check">
                      <IconCheck size="11" stroke="2.5" />
                    </span>
                    <code>mid</code>
                    <span class="fl-variable-type">Int</span>
                  </div>
                  <div>
                    <span class="fl-check">
                      <IconCheck size="11" stroke="2.5" />
                    </span>
                    <code>right</code>
                    <span class="fl-variable-type">Int</span>
                  </div>
                  <div>
                    <span class="fl-check">
                      <IconCheck size="11" stroke="2.5" />
                    </span>
                    <code>ok</code>
                    <span class="fl-variable-type">Bool</span>
                  </div>
                </div>
                <div class="fl-side-divider" />
                <div class="fl-section-heading">
                  <h2>
                    <IconBinaryTree size="16" stroke="1.8" /> Algo Views
                  </h2>
                </div>
                <div class="fl-algo-view">
                  <IconColumns3 size="16" stroke="1.7" />
                  <span>Binary search</span>
                  <IconChevronRight size="15" stroke="1.5" />
                </div>
                <span class="fl-add-view">
                  <IconCirclePlus size="16" stroke="1.7" /> Add Algo View
                </span>
              </section>
              <section class="fl-sidebar-bottom">
                <div class="fl-section-heading">
                  <h2>
                    <IconClockHour4 size="16" stroke="1.8" /> Runs
                  </h2>
                  <small>3</small>
                </div>
                <div class="fl-run is-current">
                  <IconPlayerPlay size="15" stroke="1.8" />
                  <span>
                    <strong>binary-search.rs</strong>
                    <small>Just now · 9 records</small>
                  </span>
                </div>
                <div class="fl-run">
                  <IconLayoutGrid size="15" stroke="1.8" />
                  <span>
                    <strong>grid-bfs.rs</strong>
                    <small>Earlier · 38 records</small>
                  </span>
                </div>
                <div class="fl-run">
                  <IconCode size="15" stroke="1.8" />
                  <span>
                    <strong>abc001-a.rs</strong>
                    <small>Yesterday · 2 records</small>
                  </span>
                </div>
              </section>
            </aside>

            <div class="fl-main">
              <div class="fl-main-head">
                <div>
                  <span class="fl-context">binary-search.rs / run 03</span>
                  <h2>Value history</h2>
                  <p>Follow each recorded state across the search.</p>
                </div>
                <div class="fl-view-toggle">
                  <span class="is-active">
                    <IconTable size="15" stroke="1.8" /> Table
                  </span>
                  <span>
                    <IconGitBranch size="15" stroke="1.8" /> Graph
                  </span>
                </div>
              </div>
              <div class="fl-toolbar">
                <span>
                  <IconAdjustmentsHorizontal size="16" stroke="1.8" /> Changes only
                </span>
                <span class="fl-record-count">
                  9 records <IconChevronDown size="13" stroke="1.8" />
                </span>
              </div>
              <div class="fl-table-scroll">
                <table class="fl-table">
                  <thead>
                    <tr>
                      <th>Seq</th>
                      <th>Source</th>
                      <th>
                        <span class="fl-col-title">
                          a <IconChartBar size="15" stroke="1.8" />
                        </span>
                      </th>
                      <th>left</th>
                      <th>mid</th>
                      <th>right</th>
                      <th>ok</th>
                      <th>
                        <span class="fl-col-title">
                          Binary search <IconColumns3 size="15" stroke="1.8" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="fl-group">
                      <td colspan="8">
                        <IconChevronDown size="14" stroke="1.8" />
                        <code>span [0]</code>
                        <span>4 records</span>
                      </td>
                    </tr>
                    <For each={rows}>
                      {(row, index) => (
                        <tr classList={{ 'is-selected': index() === 2 }}>
                          <td>
                            <span class="fl-seq-dot" />
                            {row.seq}
                          </td>
                          <td>
                            <code>{row.source}</code>
                          </td>
                          <td>
                            <BarArray values={row.array} selected={index() === 2 ? 3 : undefined} />
                          </td>
                          <td>
                            <code>{row.left}</code>
                          </td>
                          <td>
                            <code classList={{ 'is-changed': index() === 1 }}>{row.mid}</code>
                          </td>
                          <td>
                            <code>{row.right}</code>
                          </td>
                          <td>
                            <span class="fl-bool" classList={{ 'is-true': row.ok === 'true' }}>
                              {row.ok}
                            </span>
                          </td>
                          <td>
                            <div class="fl-algo-mini">
                              <span>
                                L <b>{row.left}</b>
                              </span>
                              <span class="is-mid">
                                M <b>{row.mid}</b>
                              </span>
                              <span>
                                R <b>{row.right}</b>
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <div class="fl-inspection">
                <div class="fl-inspection-heading">
                  <strong>Element detail</strong>
                  <span>seq 06 · a[3]</span>
                </div>
                <div class="fl-inspection-body">
                  <div>
                    <small>Previous value</small>
                    <code>11</code>
                  </div>
                  <IconChevronRight size="16" stroke="1.7" />
                  <div>
                    <small>Current value</small>
                    <code>15</code>
                  </div>
                  <span class="fl-change-label">Updated</span>
                </div>
                <div class="fl-tip-sample">
                  <Tooltip openDelay={150}>
                    <Tooltip.Trigger class="fl-tip-trigger" aria-label="Show value tooltip">
                      <IconInfoCircle size="17" stroke="1.8" /> Inspect change
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content class={`fl-floating-tip fl-floating-${active()}`}>
                        <strong>a[3]</strong>
                        <span>Changed at seq 06</span>
                        <code>11 → 15</code>
                        <Tooltip.Arrow />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip>
                  <div class="fl-tip-static">
                    <span class="fl-tip-dot" />
                    <div>
                      <strong>a[3] changed</strong>
                      <span>Previous 11 → Current 15</span>
                    </div>
                    <code>seq 06</code>
                  </div>
                </div>
              </div>
              <div class="fl-timeline">
                <span>Timeline</span>
                <div class="fl-track">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i class="is-current" />
                  <i />
                  <i />
                  <i />
                </div>
                <code>06 / 09</code>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p class="fl-gallery-note">
        These are visual studies. The live workspace at <a href="/">/</a> keeps its current styling until a
        direction is selected.
      </p>
    </main>
  );
}
