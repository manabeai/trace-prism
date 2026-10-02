import { defineValuePresentation } from '../../contract';
import { textFormat } from '../../shared';
import { boolBadgeFormat } from './badge';

export const boolPresentation = defineValuePresentation<'bool'>({
  kind: 'bool',
  formats: [boolBadgeFormat],
  fallback: textFormat(),
});
