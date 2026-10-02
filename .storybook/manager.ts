import { addons } from 'storybook/manager-api';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import { fieldNotesTheme } from './theme';

addons.setConfig({ theme: fieldNotesTheme });
