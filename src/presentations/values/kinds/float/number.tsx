import { Icon123 } from '@tabler/icons-solidjs';
import { valueText } from '../../../../trace/value';
import type { ValueFormat, ValueOf } from '../../contract';

export const floatNumberFormat = {
  id: 'number',
  label: 'Number',
  icon: Icon123,
  render: (value) => (
    <code class="lv-plain-value" title={valueText(value)}>
      {valueText(value)}
    </code>
  ),
} satisfies ValueFormat<ValueOf<'float'>>;
