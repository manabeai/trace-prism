import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { AlgoCell, type AlgoView } from '../presentations/algo/registry';
import { gridFrame, sampleFrame } from './fixtures';

const binaryView: AlgoView = {
  id: 1,
  template: 'binary',
  bindings: { left: 'left', right: 'right', mid: 'mid', predicate: 'ok' },
  enabled: true,
};
const gridView: AlgoView = {
  id: 2,
  template: 'grid',
  bindings: { board: 'board', position: 'pos' },
  enabled: true,
};

const meta = {
  title: 'Algo Views/Recorded frame',
  component: AlgoCell,
  tags: ['autodocs'],
  render: (args) => (
    <div class="workspace-root workspace-theme lv-workspace sb-surface">
      <h2 class="sb-surface-title">{args.view.template === 'binary' ? 'Binary search' : 'Grid traversal'}</h2>
      <AlgoCell {...args} />
    </div>
  ),
} satisfies Meta<typeof AlgoCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BinarySearch: Story = { args: { view: binaryView, frame: sampleFrame } };
export const GridTraversal: Story = { args: { view: gridView, frame: gridFrame } };
