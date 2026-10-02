import { IconHash } from '@tabler/icons-solidjs';
import type { ValueFormat, ValueOf } from '../../contract';

export const mapCountFormat = {
  id: 'count',
  label: 'Count',
  icon: IconHash,
  render: (value) => <code>{value.entries.length} entries</code>,
} satisfies ValueFormat<ValueOf<'map'>>;
