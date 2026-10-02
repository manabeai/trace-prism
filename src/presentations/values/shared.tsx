import { IconList } from '@tabler/icons-solidjs';
import type { Value } from '../../trace/types';
import { valueText } from '../../trace/value';
import type { ValueFormat } from './contract';

export function textFormat<T extends Value>(): ValueFormat<T> {
  return {
    id: 'text',
    label: 'Text',
    icon: IconList,
    render: (value) => (
      <code class="lv-plain-value" title={valueText(value)}>
        {valueText(value)}
      </code>
    ),
  };
}
