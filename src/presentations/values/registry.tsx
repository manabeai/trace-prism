import type { JSX } from 'solid-js';
import { IconList } from '@tabler/icons-solidjs';
import type { Column, Frame, Value } from '../../trace/types';
import type { ValueChange, ValuePath } from '../../trace/diff';
import type { ErasedValueFormat, ErasedValuePresentation, FormatOption, ValueKind } from './contract';
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

function formatFor(value: Value, formatId: string): ErasedValueFormat {
  const presentation = presentations[value.t];
  return (
    presentation.formats.find((item) => item.id === formatId && item.accepts(value)) ?? presentation.fallback
  );
}

export function formatOptions(column: Column, frames: Frame[]): FormatOption[] {
  const observed = frames
    .map((frame) => frame.values[column.name]?.value)
    .filter((value): value is Value => value?.t === column.kind);
  if (!observed.length) return [{ id: 'text', label: 'Text', icon: IconList }];
  const presentation = presentations[column.kind];
  return [...presentation.formats, presentation.fallback].flatMap((format) => {
    const applicable = observed.find(format.accepts);
    return applicable ? [{ id: format.id, label: format.label(applicable), icon: format.icon }] : [];
  });
}

export function renderValue(
  value: Value | undefined,
  formatId: string,
  changes: readonly ValueChange[] = [],
  matches: readonly ValuePath[] = [],
): JSX.Element {
  if (!value) return <span class="dg-quiet">—</span>;
  return formatFor(value, formatId).render(value, changes, matches);
}

export function formatHasVisibleChange(
  value: Value | undefined,
  formatId: string,
  changes: readonly ValueChange[] = [],
): boolean {
  return value !== undefined && formatFor(value, formatId).isChanged(value, changes);
}
