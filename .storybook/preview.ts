import type { Preview } from 'storybook-solidjs-vite';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource-variable/newsreader/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '../src/design/field-notes-tokens.css';
import '../src/workspace.css';
import './storybook.css';
import { fieldNotesTheme } from './theme';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'Field Notes' },
    docs: { theme: fieldNotesTheme },
  },
};

export default preview;
