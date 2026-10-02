import { defineValuePresentation } from '../contract';
import { textFormat } from '../shared';

export const stringPresentation = defineValuePresentation<'string'>({
  kind: 'string',
  formats: [],
  fallback: textFormat(),
});
