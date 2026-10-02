import type { Component, JSX } from 'solid-js';
import type { Value } from '../../trace/types';
import type { ValueChange } from '../../trace/diff';
import { valueText } from '../../trace/value';

export type ValueKind = Value['t'];
export type ValueOf<K extends ValueKind> = Extract<Value, { t: K }>;
export type FormatIcon = Component<{ size?: string | number; stroke?: string }>;

export interface ValueFormat<T extends Value> {
  id: string;
  label: string | ((value: T) => string);
  icon: FormatIcon;
  isApplicable?: (value: T) => boolean;
  render: (value: T, changes: readonly ValueChange[]) => JSX.Element;
}

export type FallbackFormat<T extends Value> = ValueFormat<T> & { isApplicable?: never };

export interface ValuePresentation<K extends ValueKind> {
  kind: K;
  formats: readonly ValueFormat<ValueOf<K>>[];
  fallback: FallbackFormat<ValueOf<K>>;
}

export interface ErasedValueFormat {
  id: string;
  icon: FormatIcon;
  accepts: (value: Value) => boolean;
  label: (value: Value) => string;
  render: (value: Value, changes: readonly ValueChange[]) => JSX.Element;
}

export interface ErasedValuePresentation<K extends ValueKind = ValueKind> {
  kind: K;
  formats: readonly ErasedValueFormat[];
  fallback: ErasedValueFormat;
}

export type FormatOption = { id: string; label: string; icon: FormatIcon };

export function defineValuePresentation<K extends ValueKind>(
  definition: ValuePresentation<K>,
): ErasedValuePresentation<K> {
  const ids = [...definition.formats, definition.fallback].map((format) => format.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Duplicate format ID for ${definition.kind}`);
  }
  type SpecificValue = ValueOf<K>;
  const erase = (format: ValueFormat<SpecificValue>): ErasedValueFormat => {
    const accepts = (value: Value): value is SpecificValue =>
      value.t === definition.kind && (!format.isApplicable || format.isApplicable(value as SpecificValue));
    return {
      id: format.id,
      icon: format.icon,
      accepts,
      label: (value) =>
        accepts(value)
          ? typeof format.label === 'function'
            ? format.label(value)
            : format.label
          : format.id,
      render: (value, changes) =>
        accepts(value) ? (
          format.render(value, changes)
        ) : (
          <code class="lv-plain-value">{valueText(value)}</code>
        ),
    };
  };
  return {
    kind: definition.kind,
    formats: definition.formats.map(erase),
    fallback: erase(definition.fallback),
  };
}
