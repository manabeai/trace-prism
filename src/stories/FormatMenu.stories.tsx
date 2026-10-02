import { createSignal } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { formatOptions } from '../presentations/values/registry';
import { FormatMenu } from '../workspace/history/FormatMenu';
import { ValueCell } from '../workspace/history/ValueCell';
import { arrayField, sampleFrame } from './fixtures';

const options = formatOptions({ name: 'a', kind: 'array', sourceType: 'Vec<i64>' }, [
  { ...sampleFrame, values: { ...sampleFrame.values, a: arrayField } },
]);

function InteractiveFormatMenu() {
  const [format, setFormat] = createSignal('cells');
  return (
    <div class="workspace-root workspace-theme lv-workspace sb-surface">
      <h2 class="sb-surface-title">Array display format</h2>
      <div class="sb-format-row">
        <code>a</code>
        <FormatMenu name="a" options={options} format={format()} select={setFormat} />
      </div>
      <ValueCell field={arrayField} format={format()} />
    </div>
  );
}

const meta = {
  title: 'Controls/Format menu',
  component: FormatMenu,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof FormatMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: { name: 'a', options, format: 'cells', select: () => undefined },
  render: () => <InteractiveFormatMenu />,
};
