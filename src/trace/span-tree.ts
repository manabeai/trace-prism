import type { Frame, HistoryNode } from './types';
import { spanKey } from './value';

export function groupFrames(frames: Frame[]): HistoryNode[] {
  const root: HistoryNode[] = [];
  const groups = new Map<string, Extract<HistoryNode, { kind: 'group' }>>();
  for (const frame of frames) {
    let children = root;
    for (let length = 1; length <= frame.span.length; length++) {
      const span = frame.span.slice(0, length);
      const key = spanKey(span);
      let group = groups.get(key);
      if (!group) {
        group = { kind: 'group', span, children: [] };
        groups.set(key, group);
        children.push(group);
      }
      children = group.children;
    }
    children.push({ kind: 'frame', frame });
  }
  return root;
}
