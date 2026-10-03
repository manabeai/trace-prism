import { Dynamic } from 'solid-js/web';
import type { Frame } from '../../trace/types';
import type { AlgoView as BaseAlgoView } from './contract';
import { binarySearch } from './views/binary-search';
import { gridTraversal } from './views/grid-traversal';
import { adjacencyGraph } from './views/adjacency-graph';

export const templates = {
  binary: binarySearch,
  grid: gridTraversal,
  graph: adjacencyGraph,
} as const;

export type Template = keyof typeof templates;
export type AlgoView = BaseAlgoView<Template>;
export type { Role } from './contract';
export { candidateNames, validBindings } from './contract';

export function AlgoCell(props: { view: AlgoView; frame: Frame }) {
  return (
    <Dynamic component={templates[props.view.template].component} view={props.view} frame={props.frame} />
  );
}
