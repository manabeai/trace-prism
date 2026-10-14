import type { ValueChange } from '../../trace/diff';

// Count はコレクション内部の更新や、同数の追加・削除では変わらない。
export function collectionSizeChanged(
  changes: readonly ValueChange[],
  memberKind: 'member' | 'key',
): boolean {
  if (changes.some((change) => change.path.length === 0)) return true;
  const difference = changes.reduce((size, change) => {
    if (change.path.length !== 1 || change.path[0].kind !== memberKind) return size;
    return size + (change.kind === 'added' ? 1 : change.kind === 'removed' ? -1 : 0);
  }, 0);
  return difference !== 0;
}
