import { Dynamic } from 'solid-js/web';
import type { Frame } from '../../trace/types';
import type { CompositeView as BaseCompositeView } from './contract';
import { rangeMarker } from './views/range-marker';
import { gridPosition } from './views/grid-position';
import { adjacencyGraph } from './views/adjacency-graph';

export const templates = {
  binary: rangeMarker,
  grid: gridPosition,
  graph: adjacencyGraph,
} as const;

export type Template = keyof typeof templates;
export const templateKeys = Object.keys(templates) as Template[];
export const defaultTemplate: Template = templateKeys[0];
export type CompositeView = BaseCompositeView<Template>;
export type { Role } from './contract';
export { candidateNames, initialBindings, validBindings } from './contract';

export function CompositeCell(props: { view: CompositeView; frame: Frame; inTable?: boolean }) {
  return (
    <Dynamic
      component={templates[props.view.template].component}
      view={props.view}
      frame={props.frame}
      inTable={props.inTable}
    />
  );
}
