import { For } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

const colors = [
  ['Canvas', '#f1f2ec'],
  ['Sheet', '#fafbf7'],
  ['Sidebar', '#e9ede6'],
  ['Ink', '#263e39'],
  ['Rule', '#cbd6cc'],
  ['Action', '#3f7065'],
  ['Copper', '#ae724e'],
] as const;

const meta = {
  title: 'Foundation/Field Notes',
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Palette: Story = {
  render: () => (
    <div class="sb-foundation">
      <h1>Material palette</h1>
      <div class="sb-swatches">
        <For each={colors}>
          {([name, hex]) => (
            <div class="sb-swatch">
              <i style={{ 'background-color': hex }} />
              <strong>{name}</strong>
              <code>{hex}</code>
            </div>
          )}
        </For>
      </div>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div class="sb-foundation">
      <h1>Type roles</h1>
      <div class="sb-type-samples">
        <div>
          <small>Newsreader · display</small>
          <p class="display">A record of each step.</p>
        </div>
        <div>
          <small>IBM Plex Sans · interface</small>
          <p class="interface">Choose what to inspect, then follow the change.</p>
        </div>
        <div>
          <small>IBM Plex Mono · data</small>
          <p class="data">seq 06 · a[3] 11 → 15</p>
        </div>
      </div>
    </div>
  ),
};
