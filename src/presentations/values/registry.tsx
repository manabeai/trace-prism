import { For, Show, type JSX } from 'solid-js';
import {
  Icon123,
  IconBrackets,
  IconChartBar,
  IconCircleCheck,
  IconCode,
  IconGridDots,
  IconHash,
  IconLayoutGrid,
  IconList,
} from '@tabler/icons-solidjs';
import type { Column, Frame, Value } from '../../trace/types';
import { valueText } from '../../trace/value';
import { isMatrix, isNumericArray, numberOf } from '../value-shapes';

export type ValueFormat<T extends Value = Value, Settings = void> = {
  id: string;
  label: string | ((value: T) => string);
  icon: typeof IconList;
  accepts: (value: Value) => value is T;
  render: (value: T, settings: Settings) => JSX.Element;
};

type RegisteredFormat = {
  id: string;
  label: (value: Value) => string;
  icon: typeof IconList;
  accepts: (value: Value) => boolean;
  render: (value: Value) => JSX.Element;
};

function register<T extends Value>(format: ValueFormat<T>): RegisteredFormat {
  return {
    id: format.id,
    icon: format.icon,
    accepts: format.accepts,
    label: (value) =>
      format.accepts(value)
        ? typeof format.label === 'function'
          ? format.label(value)
          : format.label
        : format.id,
    render: (value) =>
      format.accepts(value) ? format.render(value, undefined) : <code>{valueText(value)}</code>,
  };
}

const formats: RegisteredFormat[] = [
  register({
    id: 'matrix',
    label: 'Matrix',
    icon: IconGridDots,
    accepts: isMatrix,
    render: (value) => (
      <div class="lv-matrix">
        <For each={value.items}>
          {(row) => (
            <div>
              <For each={row.t === 'array' ? row.items : []}>{(item) => <span>{valueText(item)}</span>}</For>
            </div>
          )}
        </For>
      </div>
    ),
  }),
  register<Value & { t: 'array' | 'set' }>({
    id: 'cells',
    label: (value) => (value.t === 'array' ? (isNumericArray(value) ? 'Numbers' : 'Cells') : 'Members'),
    icon: IconBrackets,
    accepts: (value): value is Value & { t: 'array' | 'set' } =>
      (value.t === 'array' && !isMatrix(value)) || value.t === 'set',
    render: (value) =>
      value.t === 'array' ? (
        <div class="dg-array">
          <For each={value.items}>{(item) => <span title={valueText(item)}>{valueText(item)}</span>}</For>
          <Show when={!value.items.length}>
            <code>[]</code>
          </Show>
        </div>
      ) : (
        <div class="dg-set">
          <For each={value.items}>{(item) => <span title={valueText(item)}>{valueText(item)}</span>}</For>
          <Show when={!value.items.length}>
            <code>∅</code>
          </Show>
        </div>
      ),
  }),
  register({
    id: 'bars',
    label: 'Bars',
    icon: IconChartBar,
    accepts: isNumericArray,
    render: (value) => {
      const max = Math.max(1, ...value.items.map((item) => Math.abs(numberOf(item))));
      return (
        <div class="dg-bars" aria-label={valueText(value)}>
          <For each={value.items}>
            {(item) => (
              <span class="dg-bar-item">
                <i style={{ height: `${Math.max(5, (Math.abs(numberOf(item)) / max) * 34)}px` }} />
                <small>{valueText(item)}</small>
              </span>
            )}
          </For>
        </div>
      );
    },
  }),
  register({
    id: 'badge',
    label: 'Badge',
    icon: IconCircleCheck,
    accepts: (value): value is Extract<Value, { t: 'bool' }> => value.t === 'bool',
    render: (value) => (
      <span class="dg-bool" classList={{ 'is-true': value.v, 'is-false': !value.v }}>
        {String(value.v)}
      </span>
    ),
  }),
  register({
    id: 'entries',
    label: 'Entries',
    icon: IconLayoutGrid,
    accepts: (value): value is Extract<Value, { t: 'map' }> => value.t === 'map',
    render: (value) => (
      <div class="lv-entries">
        <For each={value.entries}>
          {(entry) => (
            <code>
              <b>{valueText(entry.key)}</b>: {valueText(entry.value)}
            </code>
          )}
        </For>
        <Show when={!value.entries.length}>
          <code>{'{}'}</code>
        </Show>
      </div>
    ),
  }),
  register({
    id: 'fields',
    label: 'Fields',
    icon: IconCode,
    accepts: (value): value is Extract<Value, { t: 'record' }> => value.t === 'record',
    render: (value) => (
      <div class="lv-entries">
        <For each={value.fields}>
          {(field) => (
            <code>
              <b>{field.name}</b>: {valueText(field.value)}
            </code>
          )}
        </For>
        <Show when={!value.fields.length}>
          <code>{'{}'}</code>
        </Show>
      </div>
    ),
  }),
  register({
    id: 'count',
    label: 'Count',
    icon: IconHash,
    accepts: (value): value is Value & { t: 'set' | 'map' } => value.t === 'set' || value.t === 'map',
    render: (value) => (
      <code>
        {value.t === 'map' ? value.entries.length : value.items.length}{' '}
        {value.t === 'map' ? 'entries' : 'items'}
      </code>
    ),
  }),
  register({
    id: 'number',
    label: 'Number',
    icon: Icon123,
    accepts: (value): value is Extract<Value, { t: 'int' | 'float' }> =>
      value.t === 'int' || value.t === 'float',
    render: (value) => (
      <code class="lv-plain-value" title={valueText(value)}>
        {valueText(value)}
      </code>
    ),
  }),
  register({
    id: 'text',
    label: 'Text',
    icon: IconList,
    accepts: (_value): _value is Value => true,
    render: (value) => (
      <code class="lv-plain-value" title={valueText(value)}>
        {valueText(value)}
      </code>
    ),
  }),
];

export type FormatOption = Pick<RegisteredFormat, 'id' | 'icon'> & { label: string };

export function formatOptions(column: Column, frames: Frame[]): FormatOption[] {
  const observed = frames
    .map((frame) => frame.values[column.name]?.value)
    .find((value): value is Value => value !== undefined);
  if (!observed) return [{ id: 'text', label: 'Text', icon: IconList }];
  return formats
    .filter((format) => format.accepts(observed))
    .map((format) => ({
      id: format.id,
      label: format.label(observed),
      icon: format.icon,
    }));
}

export function formatIcon(id: string): typeof IconList {
  return formats.find((format) => format.id === id)?.icon ?? IconList;
}

export function renderValue(value: Value | undefined, formatId: string): JSX.Element {
  if (!value) return <span class="dg-quiet">—</span>;
  const format = formats.find((item) => item.id === formatId && item.accepts(value)) ?? formats.at(-1)!;
  return format.render(value);
}
