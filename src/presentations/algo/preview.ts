import type { Field, Frame, Value } from '../../trace/types';
import { seqId } from '../../trace/ids';
import type { AlgoView, Template } from './registry';

const int = (value: number): Value => ({ t: 'int', v: String(value) });
const array = (items: Value[]): Value => ({ t: 'array', items });
const field = (name: string, value: Value): Field => ({ name, value });

export const previewFrame: Frame = {
  seq: seqId('0'),
  span: [],
  source: '',
  changed: [],
  deltas: {},
  values: {
    left: field('left', int(2)),
    right: field('right', int(8)),
    mid: field('mid', int(5)),
    predicate: field('predicate', { t: 'bool', v: true }),
    board: field(
      'board',
      array([
        array([int(0), int(0), int(1), int(0)]),
        array([int(1), int(0), int(1), int(0)]),
        array([int(0), int(0), int(0), int(0)]),
        array([int(0), int(1), int(0), int(1)]),
      ]),
    ),
    position: field('position', array([int(2), int(1)])),
    adjacency: field(
      'adjacency',
      array([array([int(1), int(2)]), array([int(2)]), array([int(3)]), array([])]),
    ),
    visited: field(
      'visited',
      array([
        { t: 'bool', v: true },
        { t: 'bool', v: true },
        { t: 'bool', v: false },
        { t: 'bool', v: false },
      ]),
    ),
    vertex: field('vertex', int(1)),
  },
};

export const previewViews: Record<Template, AlgoView> = {
  binary: {
    id: 0,
    template: 'binary',
    bindings: { left: 'left', right: 'right', mid: 'mid', predicate: 'predicate' },
    enabled: true,
  },
  grid: {
    id: 0,
    template: 'grid',
    bindings: { board: 'board', position: 'position' },
    enabled: true,
  },
  graph: {
    id: 0,
    template: 'graph',
    bindings: { adjacency: 'adjacency', visited: 'visited', v: 'vertex' },
    enabled: true,
  },
};
