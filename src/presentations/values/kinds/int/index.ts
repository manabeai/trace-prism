import { defineValuePresentation } from '../../contract';
import { textFormat } from '../../shared';
import { intNumberFormat } from './number';
import { intBinaryFormat } from './binary';

export const intPresentation = defineValuePresentation<'int'>({
  kind: 'int',
  formats: [intNumberFormat, intBinaryFormat],
  fallback: textFormat(),
});
