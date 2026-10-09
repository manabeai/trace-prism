import type { Column, Value } from '../../trace/types';

const sequenceWidth = 52;
const viewWidth = 156;

const valueWidths: Record<Value['t'], number> = {
  null: 72,
  bool: 72,
  int: 72,
  float: 72,
  string: 96,
  array: 112,
  set: 100,
  map: 110,
  record: 112,
};

export function historyColumnLayout(columns: readonly Column[], viewCount: number) {
  const widths = columns.map((column) => valueWidths[column.kind]);
  const flexibleWidth = widths.reduce((total, width) => total + width, viewCount * viewWidth);
  const widthFor = (minimum: number) => {
    const share = minimum / flexibleWidth;
    return `calc(${share * 100}% - ${share * sequenceWidth}px)`;
  };

  return {
    minWidth: sequenceWidth + flexibleWidth,
    sequenceWidth: `${sequenceWidth}px`,
    valueWidths: widths.map(widthFor),
    viewWidth: flexibleWidth ? widthFor(viewWidth) : '0px',
  };
}
