import { defineValuePresentation } from '../../contract';
import { textFormat } from '../../shared';
import { mapCountFormat } from './count';
import { mapEntriesFormat } from './entries';

export const mapPresentation = defineValuePresentation<'map'>({
  kind: 'map',
  formats: [mapEntriesFormat, mapCountFormat],
  fallback: textFormat(),
});
