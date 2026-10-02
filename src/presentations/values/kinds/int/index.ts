import { defineValuePresentation } from '../../contract';
import { textFormat } from '../../shared';
import { intNumberFormat } from './number';

export const intPresentation = defineValuePresentation<'int'>({
  kind: 'int',
  formats: [intNumberFormat],
  fallback: textFormat(),
});
