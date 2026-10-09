import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import LiveWorkspace from '../LiveWorkspace';
import { emptyRepository, failingRepository, recordedRepository } from './fixtures';

const meta = {
  title: 'Workspace/Trace workspace',
  component: LiveWorkspace,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', controls: { disable: true } },
} satisfies Meta<typeof LiveWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recorded: Story = {
  render: () => <LiveWorkspace repository={recordedRepository} />,
};

export const NoRuns: Story = {
  render: () => <LiveWorkspace repository={emptyRepository} />,
};

export const StorageUnavailable: Story = {
  render: () => <LiveWorkspace repository={failingRepository} />,
};
