import { render } from 'solid-js/web';
import LiveWorkspace from './LiveWorkspace';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource-variable/newsreader/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './design/field-notes-tokens.css';
import './workspace.css';

const root = document.getElementById('root')!;
if (window.location.pathname === '/flavors') {
  void import('./design/FlavorGallery').then(({ default: FlavorGallery }) =>
    render(() => <FlavorGallery />, root),
  );
} else if (window.location.pathname === '/catalog') {
  void import('./design/DesignCatalog').then(({ default: DesignCatalog }) =>
    render(() => <DesignCatalog />, root),
  );
} else {
  render(() => <LiveWorkspace />, root);
}
