import type { RunId, Seq, ValueName, ColumnId } from '../../src/trace/ids';

declare const run: RunId;
declare const seq: Seq;
declare const value: ValueName;
declare const column: ColumnId;

// @ts-expect-error RunId and Seq have different namespaces.
const sequenceFromRun: Seq = run;
// @ts-expect-error A recorded value name is not a table column ID.
const columnFromValue: ColumnId = value;
// @ts-expect-error A column ID cannot select a trace record.
const sequenceFromColumn: Seq = column;
// @ts-expect-error Unvalidated wire strings cannot enter selection state.
const runFromWire: RunId = 'example';

export { sequenceFromRun, columnFromValue, sequenceFromColumn, runFromWire, seq };
