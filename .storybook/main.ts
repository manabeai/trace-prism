import type { StorybookConfig } from 'storybook-solidjs-vite';

export default {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: 'storybook-solidjs-vite',
  docs: { autodocs: 'tag' },
} satisfies StorybookConfig;
