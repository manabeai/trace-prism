import { defineValuePresentation } from '../../contract';
import { textFormat } from '../../shared';
import { floatNumberFormat } from './number';

export const floatPresentation = defineValuePresentation<'float'>({
  kind: 'float',
  formats: [floatNumberFormat],
  fallback: textFormat(),
});
