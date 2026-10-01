import { render } from 'solid-js/web';
import App from './App';
import LiveWorkspace from './LiveWorkspace';
import DesignGallery from './DesignGalleryV2';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles.css';
import './design-gallery-v2.css';
import './live-workspace.css';

render(() => new URLSearchParams(location.search).has('mock') ? <DesignGallery/> : new URLSearchParams(location.search).has('legacy') ? <App/> : <LiveWorkspace/>, document.getElementById('root')!);
