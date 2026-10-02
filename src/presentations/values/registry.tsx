import type { JSX } from 'solid-js';
import { IconList } from '@tabler/icons-solidjs';
import type { Column, Frame, Value } from '../../trace/types';
import type { ErasedValuePresentation, FormatOption, ValueKind } from './contract';
import { arrayPresentation } from './kinds/array';
import { boolPresentation } from './kinds/bool';
import { floatPresentation } from './kinds/float';
import { intPresentation } from './kinds/int';
import { mapPresentation } from './kinds/map';
import { nullPresentation } from './kinds/null';
import { recordPresentation } from './kinds/record';
import { setPresentation } from './kinds/set';
import { stringPresentation } from './kinds/string';

const presentations = {
  array: arrayPresentation,
  bool: boolPresentation,
  float: floatPresentation,
  int: intPresentation,
  map: mapPresentation,
  null: nullPresentation,
  record: recordPresentation,
  set: setPresentation,
  string: stringPresentation,
} satisfies { [K in ValueKind]: ErasedValuePresentation<K> };

export type { FormatOption } from './contract';

export function formatOptions(column: Column, frames: Frame[]): FormatOption[] {
  const observed = frames
    .map((frame) => frame.values[column.name]?.value)
    .find((value): value is Value => value !== undefined);
  if (!observed) return [{ id: 'text', label: 'Text', icon: IconList }];
  const presentation = presentations[observed.t];
  return [...presentation.formats, presentation.fallback]
    .filter((format) => format.accepts(observed))
    .map((format) => ({ id: format.id, label: format.label(observed), icon: format.icon }));
}

export function renderValue(value: Value | undefined, formatId: string): JSX.Element {
  if (!value) return <span class="dg-quiet">—</span>;
  const presentation = presentations[value.t];
  const format = presentation.formats.find((item) => item.id === formatId && item.accepts(value));
  return (format ?? presentation.fallback).render(value);
}
