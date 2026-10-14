import { IconHash } from '@tabler/icons-solidjs';
import type { ValueFormat, ValueOf } from '../../contract';
import { collectionSizeChanged } from '../../highlights';

export const mapCountFormat = {
  id: 'count',
  label: 'Count',
  icon: IconHash,
  isChanged: (_value, changes) => collectionSizeChanged(changes, 'key'),
  render: (value) => <code>{value.entries.length} entries</code>,
} satisfies ValueFormat<ValueOf<'map'>>;
