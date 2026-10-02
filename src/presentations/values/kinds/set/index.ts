import { defineValuePresentation } from '../../contract';
import { textFormat } from '../../shared';
import { setCellsFormat } from './cells';
import { setCountFormat } from './count';

export const setPresentation = defineValuePresentation<'set'>({
  kind: 'set',
  formats: [setCellsFormat, setCountFormat],
  fallback: textFormat(),
});
