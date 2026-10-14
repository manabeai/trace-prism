import { IconHash } from '@tabler/icons-solidjs';
import type { ValueFormat, ValueOf } from '../../contract';
import { collectionSizeChanged } from '../../highlights';

export const setCountFormat = {
  id: 'count',
  label: 'Count',
  icon: IconHash,
  isChanged: (_value, changes) => collectionSizeChanged(changes, 'member'),
  render: (value) => <code>{value.items.length} items</code>,
} satisfies ValueFormat<ValueOf<'set'>>;
