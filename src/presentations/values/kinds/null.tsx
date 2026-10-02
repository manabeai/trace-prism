import { defineValuePresentation } from '../contract';
import { textFormat } from '../shared';

export const nullPresentation = defineValuePresentation<'null'>({
  kind: 'null',
  formats: [],
  fallback: textFormat(),
});
