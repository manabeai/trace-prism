import { defineValuePresentation } from '../../contract';
import { textFormat } from '../../shared';
import { arrayBarsFormat } from './bars';
import { arrayCellsFormat } from './cells';
import { arrayMatrixFormat } from './matrix';

export const arrayPresentation = defineValuePresentation<'array'>({
  kind: 'array',
  formats: [arrayMatrixFormat, arrayCellsFormat, arrayBarsFormat],
  fallback: textFormat(),
});
