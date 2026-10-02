import { IconCircleCheck } from '@tabler/icons-solidjs';
import type { ValueFormat, ValueOf } from '../../contract';

export const boolBadgeFormat = {
  id: 'badge',
  label: 'Badge',
  icon: IconCircleCheck,
  render: (value) => (
    <span class="dg-bool" classList={{ 'is-true': value.v, 'is-false': !value.v }}>
      {String(value.v)}
    </span>
  ),
} satisfies ValueFormat<ValueOf<'bool'>>;
