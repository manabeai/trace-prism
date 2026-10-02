import { IconHash } from '@tabler/icons-solidjs';
import type { ValueFormat, ValueOf } from '../../contract';

export const setCountFormat = {
  id: 'count',
  label: 'Count',
  icon: IconHash,
  render: (value) => <code>{value.items.length} items</code>,
} satisfies ValueFormat<ValueOf<'set'>>;
