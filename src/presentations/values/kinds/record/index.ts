import { defineValuePresentation } from '../../contract';
import { textFormat } from '../../shared';
import { recordFieldsFormat } from './fields';

export const recordPresentation = defineValuePresentation<'record'>({
  kind: 'record',
  formats: [recordFieldsFormat],
  fallback: textFormat(),
});
