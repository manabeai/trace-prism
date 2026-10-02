import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ValueCell } from '../workspace/history/ValueCell';
import { arrayChange, arrayField, mapField, matrixField, setField } from './fixtures';

const meta = {
  title: 'Values/Value cell',
  component: ValueCell,
  tags: ['autodocs'],
  render: (args) => (
    <div class="workspace-root workspace-theme lv-workspace sb-surface">
      <h2 class="sb-surface-title">{args.field?.name ?? 'Value'}</h2>
      <ValueCell {...args} />
    </div>
  ),
} satisfies Meta<typeof ValueCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ArrayCells: Story = { args: { field: arrayField, format: 'cells' } };
export const ArrayBars: Story = { args: { field: arrayField, format: 'bars' } };
export const ArrayText: Story = { args: { field: arrayField, format: 'text' } };
export const ChangedElement: Story = {
  args: { field: arrayField, format: 'cells', changes: arrayChange },
};
export const Matrix: Story = { args: { field: matrixField, format: 'matrix' } };
export const SetMembers: Story = { args: { field: setField, format: 'cells' } };
export const SetCount: Story = { args: { field: setField, format: 'count' } };
export const MapEntries: Story = { args: { field: mapField, format: 'entries' } };
export const MapCount: Story = { args: { field: mapField, format: 'count' } };
export const Boolean: Story = {
  args: { field: { name: 'found', value: { t: 'bool', v: true } }, format: 'badge' },
};
export const MissingValue: Story = { args: { format: 'text' } };
