import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CompositeCell, templates, type CompositeView } from '../presentations/composite/registry';
import { graphFrame, gridFrame, sampleFrame } from './fixtures';

const rangeView: CompositeView = {
  id: 1,
  template: 'binary',
  bindings: { left: 'left', right: 'right', mid: 'mid', predicate: 'ok' },
  enabled: true,
};
const gridView: CompositeView = {
  id: 2,
  template: 'grid',
  bindings: { board: 'board', position: 'pos' },
  enabled: true,
};
const graphView: CompositeView = {
  id: 3,
  template: 'graph',
  bindings: { adjacency: 'adjacency', visited: 'seen', v: 'u' },
  enabled: true,
};

const meta = {
  title: 'Composite Views/Recorded frame',
  component: CompositeCell,
  tags: ['autodocs'],
  render: (args) => (
    <div class="workspace-root workspace-theme lv-workspace sb-surface">
      <h2 class="sb-surface-title">{templates[args.view.template].name}</h2>
      <CompositeCell {...args} />
    </div>
  ),
} satisfies Meta<typeof CompositeCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RangeMarker: Story = { args: { view: rangeView, frame: sampleFrame } };
export const GridPosition: Story = { args: { view: gridView, frame: gridFrame } };
export const Graph: Story = { args: { view: graphView, frame: graphFrame } };
