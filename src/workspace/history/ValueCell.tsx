import { createMemo } from 'solid-js';
import type { Field } from '../../trace/types';
import type { ValueChange } from '../../trace/diff';
import { renderValue } from '../../presentations/values/registry';

export function ValueCell(props: { field?: Field; format: string; changes?: readonly ValueChange[] }) {
  const output = createMemo(() => renderValue(props.field?.value, props.format, props.changes));
  return (
    <div class="dg-value-body" classList={{ 'is-updated': Boolean(props.changes?.length) }}>
      {output()}
    </div>
  );
}
