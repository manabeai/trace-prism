import { createMemo, createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  IconBraces,
  IconChevronDown,
  IconChevronUp,
  IconFunction,
  IconHash,
  IconLetterCase,
  IconLogicAnd,
  IconLogicOr,
  IconMathSymbols,
  IconSearch,
  IconTag,
  IconX,
} from '@tabler/icons-solidjs';
import type { Seq } from '../../trace/ids';
import { candidatesFor, chooseCandidate, commitText, removeLast } from '../../search/grammar';
import {
  emptyQuery,
  isComplete,
  operandShape,
  operandText,
  serializeQuery,
  shapeLabel,
  stageOf,
  type Candidate,
  type Query,
  type SearchField,
} from '../../search/model';
import type { SearchResults } from '../../search/evaluate';
import './search-editor.css';

export function SearchEditor(props: {
  fields: readonly SearchField[];
  query: Query;
  text: string;
  results: SearchResults;
  selectedSeq?: Seq;
  setQuery: (query: Query) => void;
  setText: (text: string) => void;
  selectSeq: (seq: Seq) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(0);
  let input!: HTMLInputElement;
  const stage = createMemo(() => stageOf(props.query));
  const options = createMemo(() => candidatesFor(props.fields, props.query, props.text));
  const position = createMemo(() => props.results.hits.indexOf(props.selectedSeq as Seq));
  const guidance = createMemo(() => {
    if (stage() === 'field') return 'Choose a recorded value';
    if (stage() === 'operation') return 'Choose a calculation or condition';
    if (stage() === 'predicate') return 'Choose a condition';
    if (stage() === 'operand')
      return `Enter a ${shapeLabel(operandShape(props.query.clauses.at(-1)!))} value`;
    return 'Add another condition';
  });

  const iconFor = (candidate: Candidate) => {
    if (candidate.kind === 'field' || candidate.kind === 'reference') return IconTag;
    if (candidate.kind === 'projection') return IconFunction;
    if (candidate.kind === 'predicate') return IconMathSymbols;
    if (candidate.kind === 'connector') return candidate.key === 'or' ? IconLogicOr : IconLogicAnd;
    return candidate.type?.kind === 'string' || candidate.type?.kind === 'char' ? IconLetterCase : IconHash;
  };
  const accept = (candidate: Candidate) => {
    props.setQuery(chooseCandidate(props.fields, props.query, candidate));
    props.setText('');
    setActiveIndex(0);
    setOpen(true);
    queueMicrotask(() => input.focus());
  };
  const commit = () => {
    const next = commitText(props.fields, props.query, props.text);
    if (!next) return false;
    props.setQuery(next);
    props.setText('');
    setActiveIndex(0);
    return true;
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' && open() && options().length) {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, options().length - 1));
    } else if (event.key === 'ArrowUp' && open() && options().length) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (stage() === 'operand' && props.text.trim()) commit();
      else if (open() && options()[activeIndex()]) accept(options()[activeIndex()]);
      else commit();
    } else if (event.key === ' ') {
      if (commit()) event.preventDefault();
    } else if (event.key === 'Backspace' && !props.text) {
      props.setQuery(removeLast(props.query));
      setOpen(true);
    } else if (event.key === 'Escape') {
      setOpen(false);
      input.blur();
    }
  };
  const move = (direction: -1 | 1) => {
    const hits = props.results.hits;
    if (!hits.length) return;
    const index = position();
    const next =
      index < 0 ? (direction > 0 ? 0 : hits.length - 1) : (index + direction + hits.length) % hits.length;
    props.selectSeq(hits[next]);
  };

  return (
    <div class="ws-search" role="search" aria-label="Search trace records">
      <div class="ws-search-row">
        <div class="ws-search-wrap">
          <div class="ws-search-field" classList={{ 'is-open': open() }} onClick={() => input.focus()}>
            <IconSearch size={17} stroke="1.8" aria-hidden="true" />
            <div class="ws-search-flow">
              <For each={props.query.clauses}>
                {(clause, index) => (
                  <>
                    <Show when={index() > 0}>
                      <span class="ws-search-chip connector">
                        {props.query.connectors[index() - 1]?.toUpperCase()}
                      </span>
                    </Show>
                    <span class="ws-search-chip field">{clause.field.name}</span>
                    <Show when={clause.projection}>
                      <span class="ws-search-chip projection">{clause.projection}</span>
                    </Show>
                    <Show when={clause.predicate}>
                      <span class="ws-search-chip predicate">{clause.predicate}</span>
                    </Show>
                    <Show when={clause.operand}>
                      <span class="ws-search-chip literal">{operandText(clause.operand!)}</span>
                    </Show>
                  </>
                )}
              </For>
              <Show
                when={
                  props.query.connectors.length === props.query.clauses.length && props.query.clauses.length
                }
              >
                <span class="ws-search-chip connector">{props.query.connectors.at(-1)?.toUpperCase()}</span>
              </Show>
              <input
                ref={input}
                role="combobox"
                aria-label="Search trace"
                aria-autocomplete="list"
                aria-expanded={open()}
                aria-controls="ws-search-options"
                aria-activedescendant={
                  open() && options()[activeIndex()] ? `ws-search-option-${activeIndex()}` : undefined
                }
                autocomplete="off"
                spellcheck={false}
                value={props.text}
                placeholder={
                  props.query.clauses.length
                    ? stage() === 'operand'
                      ? 'Enter value…'
                      : 'Continue query…'
                    : 'Search values or build a condition…'
                }
                onFocus={() => setOpen(true)}
                onBlur={(event) => {
                  if (!(event.relatedTarget as HTMLElement | null)?.closest('.ws-search-options'))
                    setOpen(false);
                }}
                onInput={(event) => {
                  props.setText(event.currentTarget.value);
                  setActiveIndex(0);
                  setOpen(true);
                }}
                onKeyDown={keyDown}
              />
            </div>
            <Show when={props.query.clauses.length || props.text}>
              <button
                class="ws-search-clear"
                aria-label="Clear search"
                onClick={(event) => {
                  event.stopPropagation();
                  props.setQuery(emptyQuery());
                  props.setText('');
                  setOpen(false);
                }}
              >
                <IconX size={14} />
              </button>
            </Show>
          </div>
          <Show when={open()}>
            <div class="ws-search-options" id="ws-search-options" role="listbox" aria-label={guidance()}>
              <div class="ws-search-options-head">
                <span>{guidance()}</span>
                <small>↑ ↓ navigate · Enter select</small>
              </div>
              <Show
                when={options().length}
                fallback={
                  <p class="ws-search-empty">
                    {props.query.clauses.length
                      ? 'No matching suggestion. Check this part of the query.'
                      : 'Free-text matches update as you type.'}
                  </p>
                }
              >
                <For each={options()}>
                  {(candidate, index) => (
                    <button
                      id={`ws-search-option-${index()}`}
                      role="option"
                      aria-selected={activeIndex() === index()}
                      class="ws-search-option"
                      classList={{ 'is-active': activeIndex() === index() }}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index())}
                      onClick={() => accept(candidate)}
                    >
                      <span class="ws-search-option-icon" aria-hidden="true">
                        <Dynamic component={iconFor(candidate)} size={16} stroke="1.7" />
                      </span>
                      <span class="ws-search-option-copy">
                        <span class="ws-search-option-main">
                          <code>{candidate.label}</code>
                          <Show when={candidate.type}>
                            <small>{shapeLabel(candidate.type!)}</small>
                          </Show>
                        </span>
                        <span>{candidate.detail}</span>
                      </span>
                    </button>
                  )}
                </For>
              </Show>
              <Show when={stage() === 'operand'}>
                <div class="ws-search-options-foot">
                  Type a value or @variable, then press Space or Enter.
                </div>
              </Show>
            </div>
          </Show>
        </div>
        <div class="ws-search-navigation" aria-live="polite">
          <span>{props.results.active ? `${props.results.hits.length} hits` : '— hits'}</span>
          <small>
            {position() < 0 ? '—' : position() + 1}/{props.results.hits.length || '—'}
          </small>
          <button
            aria-label="Previous search hit"
            disabled={!props.results.hits.length}
            onClick={() => move(-1)}
          >
            <IconChevronUp size={17} />
          </button>
          <button aria-label="Next search hit" disabled={!props.results.hits.length} onClick={() => move(1)}>
            <IconChevronDown size={17} />
          </button>
        </div>
      </div>
      <Show when={props.query.clauses.length && !isComplete(props.query)}>
        <small class="ws-search-hint">Complete the condition to filter records.</small>
      </Show>
      <Show when={isComplete(props.query)}>
        <span class="ws-search-serialized">
          <IconBraces size={12} />
          {serializeQuery(props.query)}
        </span>
      </Show>
    </div>
  );
}
