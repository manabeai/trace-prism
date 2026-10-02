import { render } from 'solid-js/web';
import LiveWorkspace from './LiveWorkspace';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './workspace.css';

render(() => <LiveWorkspace />, document.getElementById('root')!);
