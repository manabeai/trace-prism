import { createMemo, createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  IconArrowLeft,
  IconArrowNarrowRight,
  IconBraces,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconCommand,
  IconFunction,
  IconHash,
  IconLetterCase,
  IconLogicAnd,
  IconLogicOr,
  IconMathSymbols,
  IconSearch,
  IconSparkles,
  IconTag,
  IconX,
} from '@tabler/icons-solidjs';
import { BrandMark } from './BrandMark';
import {
  appendLiteral,
  applyCandidate,
  candidatesFor,
  effectiveKind,
  expectedRhsKind,
  frames,
  isComplete,
  matchingFields,
  normalize,
  serializeQuery,
  stageOf,
  textFields,
  validLiteral,
  variables,
  type Candidate,
  type Clause,
  type Query,
  type Value,
  type ValueKind,
} from './search-prototype';
import './search-catalog.css';

const emptyQuery = (): Query => ({ clauses: [], connectors: [] });
const typeLabels: Record<ValueKind, string> = {
  int: 'int',
  'int-array': 'Vec<int>',
  bool: 'bool',
  string: 'String',
  char: 'char',
  'int-set': 'Set<int>',
};

function candidateIcon(candidate: Candidate, query: Query) {
  if (candidate.kind === 'variable') return IconTag;
  if (candidate.kind === 'transform') return IconFunction;
  if (candidate.kind === 'operator') return IconMathSymbols;
  if (candidate.kind === 'connector') return candidate.key === 'or' ? IconLogicOr : IconLogicAnd;
  const clause = query.clauses.at(-1);
  return clause && ['string', 'char'].includes(effectiveKind(clause)) ? IconLetterCase : IconHash;
}

function candidateType(candidate: Candidate, query: Query): string | undefined {
  if (candidate.kind === 'variable') {
    const variable = variables.find((item) => item.name === candidate.key);
    return variable ? typeLabels[variable.kind] : undefined;
  }
  if (candidate.kind === 'transform') return 'int';
  if (candidate.kind === 'example') {
    const clause = query.clauses.at(-1);
    return candidate.rhsKind
      ? typeLabels[candidate.rhsKind]
      : clause
        ? typeLabels[expectedRhsKind(clause)]
        : undefined;
  }
}

function valueText(value: Value): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (value instanceof Set) return `{${[...value].join(', ')}}`;
  return String(value);
}

function ValueDisplay(props: {
  name: string;
  value: Value;
  hit: boolean;
  query: Query;
  draft: string;
  freeText: boolean;
}) {
  const items = () =>
    Array.isArray(props.value) || props.value instanceof Set ? [...props.value] : undefined;
  const matchingItems = () => {
    if (!props.hit) return [];
    if (props.freeText)
      return items()?.filter((item) => normalize(String(item)).includes(normalize(props.draft.trim()))) ?? [];
    return props.query.clauses
      .filter((clause) => clause.variable.name === props.name && clause.operator === 'contains')
      .map((clause) => Number(clause.rhs));
  };
  return (
    <Show when={items()} fallback={<span>{valueText(props.value)}</span>}>
      {(values) => (
        <span class="sp-collection">
          {props.value instanceof Set ? '{' : '['}
          <For each={values()}>
            {(item, index) => (
              <>
                <span classList={{ 'sp-element-hit': matchingItems().includes(item) }}>{item}</span>
                <Show when={index() < values().length - 1}>, </Show>
              </>
            )}
          </For>
          {props.value instanceof Set ? '}' : ']'}
        </span>
      )}
    </Show>
  );
}

function clauseChips(clause: Clause): { text: string; role: string }[] {
  return [
    { text: clause.variable.name, role: 'variable' },
    ...(clause.transform ? [{ text: clause.transform, role: 'transform' }] : []),
    ...(clause.operator ? [{ text: clause.operator, role: 'operator' }] : []),
    ...(clause.rhs !== undefined ? [{ text: clause.rhs, role: 'literal' }] : []),
  ];
}

function removeLast(query: Query): Query {
  const clauses = query.clauses.map((clause) => ({ ...clause }));
  const connectors = [...query.connectors];
  if (connectors.length === clauses.length && clauses.length > 0) {
    connectors.pop();
    return { clauses, connectors };
  }
  const clause = clauses.at(-1);
  if (!clause) return query;
  if (clause.rhs !== undefined) delete clause.rhs;
  else if (clause.operator) delete clause.operator;
  else if (clause.transform) delete clause.transform;
  else {
    clauses.pop();
    connectors.pop();
  }
  return { clauses, connectors };
}

export default function SearchCatalog() {
  const [query, setQuery] = createSignal<Query>(emptyQuery());
  const [draft, setDraft] = createSignal('');
  const [open, setOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [selectedSeq, setSelectedSeq] = createSignal(6);
  let input!: HTMLInputElement;
  const stage = createMemo(() => stageOf(query()));
  const options = createMemo(() => candidatesFor(query(), draft()));
  const freeText = createMemo(() => query().clauses.length === 0 && draft().trim().length > 0);
  const searching = createMemo(() => isComplete(query()) || freeText());
  const result = createMemo(() =>
    frames.map((frame, index) => ({
      seq: frame.seq,
      fields: isComplete(query())
        ? matchingFields(query(), frame, frames[index - 1])
        : freeText()
          ? textFields(draft(), frame)
          : [],
    })),
  );
  const hits = createMemo(() =>
    searching()
      ? result()
          .filter((item) => item.fields.length)
          .map((item) => item.seq)
      : [],
  );
  const selectedFrame = createMemo(() => frames.find((frame) => frame.seq === selectedSeq())!);
  const selectedHitPosition = createMemo(() => hits().indexOf(selectedSeq()));
  const guidance = createMemo(() => {
    if (stage() === 'variable') return 'Choose a recorded value';
    if (stage() === 'transform-or-operator') return 'Choose a calculation or condition';
    if (stage() === 'operator') return 'Choose a condition';
    if (stage() === 'value') return `Enter a ${expectedRhsKind(query().clauses.at(-1)!)} value`;
    return 'Add another condition';
  });

  function choose(candidate: Candidate) {
    setQuery((current) => applyCandidate(current, candidate));
    setDraft('');
    setActiveIndex(0);
    setOpen(true);
    queueMicrotask(() => input.focus());
  }

  function commitDraft(): boolean {
    const text = draft().trim();
    if (!text) return false;
    if (stage() === 'value') {
      const kind = expectedRhsKind(query().clauses.at(-1)!);
      if (!validLiteral(kind, text)) return false;
      setQuery((current) => appendLiteral(current, text));
      setDraft('');
      return true;
    }
    const exact =
      options().find((item) => item.key === text || item.label === text) ??
      options().find(
        (item) => normalize(item.key) === normalize(text) || normalize(item.label) === normalize(text),
      );
    if (!exact) return false;
    choose(exact);
    return true;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' && open()) {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, options().length - 1));
    } else if (event.key === 'ArrowUp' && open()) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (stage() === 'value' && draft().trim()) commitDraft();
      else if (open() && options()[activeIndex()]) choose(options()[activeIndex()]);
      else commitDraft();
    } else if (event.key === ' ') {
      if (commitDraft()) event.preventDefault();
    } else if (event.key === 'Backspace' && !draft()) {
      setQuery((current) => removeLast(current));
      setOpen(true);
    } else if (event.key === 'Escape') {
      setOpen(false);
      input.blur();
    }
  }

  function moveHit(direction: -1 | 1) {
    const list = hits();
    if (!list.length) return;
    const position = list.indexOf(selectedSeq());
    const next =
      direction === 1
        ? list[position < 0 ? 0 : (position + 1) % list.length]
        : list[position < 0 ? list.length - 1 : (position - 1 + list.length) % list.length];
    setSelectedSeq(next);
    document.getElementById(`sp-row-${next}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function useExample(text: string) {
    setQuery(emptyQuery());
    setDraft(text);
    setOpen(false);
    if (text === 'A sum >= 50') {
      const A = candidatesFor(emptyQuery(), '').find((item) => item.key === 'A')!;
      const q1 = applyCandidate(emptyQuery(), A);
      const sum = candidatesFor(q1, '').find((item) => item.key === 'sum')!;
      const q2 = applyCandidate(q1, sum);
      const greater = candidatesFor(q2, '').find((item) => item.key === '>=')!;
      setQuery(appendLiteral(applyCandidate(q2, greater), '50'));
      setDraft('');
    } else if (text === 'a changed') {
      const a = candidatesFor(emptyQuery(), '').find((item) => item.key === 'a')!;
      const q1 = applyCandidate(emptyQuery(), a);
      const changed = candidatesFor(q1, '').find((item) => item.key === 'changed')!;
      setQuery(applyCandidate(q1, changed));
      setDraft('');
    }
  }

  return (
    <div class="sp-root">
      <header class="sp-topbar">
        <a class="sp-brand" href="/catalog">
          <BrandMark />
          <strong>TracePrism</strong>
        </a>
        <span>Design catalog / Search</span>
        <a class="sp-back" href="/catalog">
          <IconArrowLeft size={16} /> Component catalog
        </a>
      </header>
      <main class="sp-page">
        <div class="sp-intro">
          <div>
            <h1>Search the trace</h1>
            <p>
              Build a condition from recorded values. The result follows each seq, down to the matching cell.
            </p>
          </div>
          <span class="sp-prototype">
            <IconSparkles size={15} /> Interactive prototype
          </span>
        </div>

        <section class="sp-query-section" aria-label="Search prototype">
          <div class="sp-query-caption">
            <IconCommand size={16} />
            <span>Query builder</span>
            <code>demo run · 12 records</code>
          </div>
          <div class="sp-search-line">
            <div class="sp-combobox-wrap">
              <div classList={{ 'sp-input-shell': true, 'is-open': open() }} onClick={() => input.focus()}>
                <IconSearch class="sp-search-icon" size={18} stroke="1.8" />
                <div class="sp-chip-flow">
                  <For each={query().clauses}>
                    {(clause, index) => (
                      <>
                        <Show when={index() > 0}>
                          <span class="sp-chip connector">
                            {query().connectors[index() - 1]?.toUpperCase()}
                          </span>
                        </Show>
                        <For each={clauseChips(clause)}>
                          {(chip) => <span class={`sp-chip ${chip.role}`}>{chip.text}</span>}
                        </For>
                      </>
                    )}
                  </For>
                  <input
                    ref={input}
                    role="combobox"
                    aria-label="Search trace"
                    aria-autocomplete="list"
                    aria-expanded={open()}
                    aria-controls="sp-suggestions"
                    aria-activedescendant={
                      open() && options()[activeIndex()] ? `sp-option-${activeIndex()}` : undefined
                    }
                    autocomplete="off"
                    spellcheck={false}
                    value={draft()}
                    placeholder={
                      query().clauses.length
                        ? stage() === 'value'
                          ? 'Enter value…'
                          : 'Continue query…'
                        : 'Search values or build a condition…'
                    }
                    onFocus={() => setOpen(true)}
                    onBlur={(event) => {
                      if (!(event.relatedTarget as HTMLElement | null)?.closest('.sp-suggest'))
                        setOpen(false);
                    }}
                    onInput={(event) => {
                      setDraft(event.currentTarget.value);
                      setActiveIndex(0);
                      setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                  />
                </div>
                <Show when={query().clauses.length || draft()}>
                  <button
                    class="sp-clear"
                    aria-label="Clear search"
                    onClick={(event) => {
                      event.stopPropagation();
                      setQuery(emptyQuery());
                      setDraft('');
                      setOpen(false);
                    }}
                  >
                    <IconX size={15} />
                  </button>
                </Show>
              </div>
              <Show when={open()}>
                <div class="sp-suggest" id="sp-suggestions" role="listbox" aria-label={guidance()}>
                  <div class="sp-suggest-heading">
                    <span>{guidance()}</span>
                    <small>↑ ↓ to navigate · Enter to select</small>
                  </div>
                  <Show
                    when={options().length}
                    fallback={
                      <div class="sp-no-option">
                        {freeText()
                          ? 'Free-text matches update as you type.'
                          : 'No matching suggestion. Check this part of the query.'}
                      </div>
                    }
                  >
                    <For each={options()}>
                      {(option, index) => (
                        <button
                          id={`sp-option-${index()}`}
                          role="option"
                          aria-selected={activeIndex() === index()}
                          classList={{ 'sp-option': true, 'is-active': activeIndex() === index() }}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveIndex(index())}
                          onClick={() => choose(option)}
                        >
                          <span class="sp-option-icon" aria-hidden="true">
                            <Dynamic component={candidateIcon(option, query())} size={16} stroke="1.7" />
                          </span>
                          <span class="sp-option-copy">
                            <span class="sp-option-main">
                              <span class={`sp-option-key ${option.kind}`}>{option.label}</span>
                              <Show when={candidateType(option, query())}>
                                {(type) => <span class="sp-option-type">{type()}</span>}
                              </Show>
                            </span>
                            <span class="sp-option-detail">{option.detail}</span>
                          </span>
                        </button>
                      )}
                    </For>
                  </Show>
                  <Show when={stage() === 'value'}>
                    <div class="sp-suggest-foot">
                      Type a value and press Space or Enter to turn it into a chip.
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
            <div class="sp-results-nav" aria-live="polite">
              <span class="sp-hit-count">{searching() ? `${hits().length} hits` : '— hits'}</span>
              <span class="sp-hit-position">
                {selectedHitPosition() < 0 ? '—' : selectedHitPosition() + 1}/{hits().length || '—'}
              </span>
              <button aria-label="Previous hit" disabled={!hits().length} onClick={() => moveHit(-1)}>
                <IconChevronUp size={18} />
              </button>
              <button aria-label="Next hit" disabled={!hits().length} onClick={() => moveHit(1)}>
                <IconChevronDown size={18} />
              </button>
            </div>
          </div>
          <div class="sp-query-meta">
            <div class="sp-examples">
              <span>Try</span>
              <button onClick={() => useExample('A sum >= 50')}>A sum ≥ 50</button>
              <button onClick={() => useExample('a changed')}>a changed</button>
              <button onClick={() => useExample('exploring')}>exploring</button>
            </div>
            <span class="sp-query-string">
              <IconBraces size={14} />{' '}
              {query().clauses.length ? serializeQuery(query()) : draft() || 'No query'}
            </span>
          </div>
          <Show when={query().clauses.length && !isComplete(query())}>
            <p class="sp-partial">
              Complete the condition to filter records. Suggestions follow the selected value’s type.
            </p>
          </Show>
        </section>

        <div class="sp-preview-head">
          <h2>Value history</h2>
          <span>Selection stays synchronized across table, graph, and timeline</span>
        </div>
        <div class="sp-preview-grid">
          <section class="sp-table-panel" aria-label="Value history table">
            <div class="sp-panel-head">
              <span>Table</span>
              <small>Chronological order</small>
            </div>
            <div class="sp-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>seq</th>
                    <th>
                      a <small>int</small>
                    </th>
                    <th>
                      A <small>Vec&lt;int&gt;</small>
                    </th>
                    <th>
                      seen <small>bool</small>
                    </th>
                    <th>
                      visited <small>Set&lt;int&gt;</small>
                    </th>
                    <th>
                      label <small>String</small>
                    </th>
                    <th>
                      phase <small>char</small>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={frames}>
                    {(frame) => {
                      const fields = () => result().find((item) => item.seq === frame.seq)?.fields ?? [];
                      return (
                        <tr
                          id={`sp-row-${frame.seq}`}
                          classList={{
                            'is-selected': selectedSeq() === frame.seq,
                            'is-dim': searching() && !hits().includes(frame.seq),
                          }}
                          onClick={() => setSelectedSeq(frame.seq)}
                        >
                          <th scope="row">
                            <button aria-label={`Select seq ${frame.seq}`}>
                              {String(frame.seq).padStart(2, '0')}
                            </button>
                          </th>
                          <For each={['a', 'A', 'seen', 'visited', 'label', 'phase']}>
                            {(name) => (
                              <td classList={{ 'is-match': fields().includes(name) }}>
                                <ValueDisplay
                                  name={name}
                                  value={frame.values[name]}
                                  hit={fields().includes(name)}
                                  query={query()}
                                  draft={draft()}
                                  freeText={freeText()}
                                />
                              </td>
                            )}
                          </For>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </section>
          <section class="sp-graph-panel" aria-label="Sequence graph">
            <div class="sp-panel-head">
              <span>Graph</span>
              <small>Same active seq</small>
            </div>
            <div class="sp-graph-grid">
              <For each={frames}>
                {(frame, index) => (
                  <button
                    classList={{
                      'sp-node': true,
                      'is-selected': selectedSeq() === frame.seq,
                      'is-hit': searching() && hits().includes(frame.seq),
                      'is-dim': searching() && !hits().includes(frame.seq),
                    }}
                    onClick={() => setSelectedSeq(frame.seq)}
                    aria-label={`Graph node seq ${frame.seq}${hits().includes(frame.seq) ? ', search hit' : ''}`}
                  >
                    <span class="sp-node-index">{String(frame.seq).padStart(2, '0')}</span>
                    <span class="sp-node-line" />
                    <small>{frame.span}</small>
                    <Show when={index() < frames.length - 1}>
                      <IconArrowNarrowRight class="sp-node-arrow" size={16} />
                    </Show>
                  </button>
                )}
              </For>
            </div>
            <div class="sp-graph-inspect">
              <span>
                <IconCircleCheck size={15} /> Focused record
              </span>
              <strong>seq {selectedSeq()}</strong>
              <small>
                {selectedFrame().span} · a = {String(selectedFrame().values.a)}
              </small>
            </div>
          </section>
        </div>
        <section class="sp-timeline" aria-label="Sequence timeline">
          <div class="sp-timeline-head">
            <span>Timeline</span>
            <small>Yellow marks match the query</small>
          </div>
          <div class="sp-ticks">
            <For each={frames}>
              {(frame) => (
                <button
                  aria-label={`Go to seq ${frame.seq}`}
                  classList={{
                    'sp-tick': true,
                    'is-hit': searching() && hits().includes(frame.seq),
                    'is-dim': searching() && !hits().includes(frame.seq),
                    'is-selected': selectedSeq() === frame.seq,
                  }}
                  onClick={() => setSelectedSeq(frame.seq)}
                >
                  <span />
                  <small>{frame.seq}</small>
                </button>
              )}
            </For>
          </div>
        </section>
      </main>
    </div>
  );
}
