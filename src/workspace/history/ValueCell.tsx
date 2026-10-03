import { createMemo } from 'solid-js';
import type { Field } from '../../trace/types';
import type { ValueChange, ValuePath } from '../../trace/diff';
import { renderValue } from '../../presentations/values/registry';

export function ValueCell(props: {
  field?: Field;
  format: string;
  changes?: readonly ValueChange[];
  matches?: readonly ValuePath[];
}) {
  const output = createMemo(() =>
    renderValue(props.field?.value, props.format, props.changes, props.matches),
  );
  return (
    <div
      class="dg-value-body"
      classList={{
        'is-updated': Boolean(props.changes?.length),
        'is-search-match': Boolean(props.matches?.length),
      }}
    >
      {output()}
    </div>
  );
}
