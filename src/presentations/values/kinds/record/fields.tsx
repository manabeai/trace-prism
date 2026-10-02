import { For, Show } from 'solid-js';
import { IconCode } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import { changesAffectPath } from '../../../../trace/diff';
import type { ValueFormat, ValueOf } from '../../contract';

export const recordFieldsFormat = {
  id: 'fields',
  label: 'Fields',
  icon: IconCode,
  render: (value, changes) => (
    <div class="lv-entries">
      <For each={value.fields}>
        {(field) => (
          <code
            classList={{ 'is-updated': changesAffectPath(changes, [{ kind: 'field', name: field.name }]) }}
          >
            <b>{field.name}</b>: {valueText(field.value)}
          </code>
        )}
      </For>
      <Show when={!value.fields.length}>
        <code>{'{}'}</code>
      </Show>
    </div>
  ),
} satisfies ValueFormat<ValueOf<'record'>>;
