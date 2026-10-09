import { IconBinary } from '@tabler/icons-solidjs';
import { For } from 'solid-js';
import type { ValueChange } from '../../../../trace/diff';
import type { ValueFormat, ValueOf } from '../../contract';

type Bit = { digit: string; changed: boolean; startsGroup: boolean; position: number };

function binaryParts(value: ValueOf<'int'>, changes: readonly ValueChange[]) {
  const current = BigInt(value.v);
  const change = changes.find((item) => item.path.length === 0);
  const previous = change?.kind === 'updated' && change.before.t === 'int' ? BigInt(change.before.v) : null;
  const currentSign = current < 0n ? '-' : '+';
  const previousSign = previous !== null && previous < 0n ? '-' : '+';
  const magnitude = (number: bigint) => (number < 0n ? -number : number).toString(2);
  const currentBits = magnitude(current);
  const previousBits = previous === null ? '' : magnitude(previous);
  const width = Math.max(currentBits.length, previousBits.length);
  const paddedCurrent = currentBits.padStart(width, '0');
  const paddedPrevious = previousBits.padStart(width, '0');
  const changedAll = change?.kind === 'added' || (change?.kind === 'updated' && previous === null);
  const bits: Bit[] = [...paddedCurrent].map((digit, index) => ({
    digit,
    changed: Boolean(changedAll || (previous !== null && digit !== paddedPrevious[index])),
    startsGroup: index > 0 && (width - index) % 4 === 0,
    position: width - index - 1,
  }));

  return {
    sign: currentSign === '-' || (previous !== null && currentSign !== previousSign) ? currentSign : '',
    signChanged: previous !== null && currentSign !== previousSign,
    bits,
    isAdded: change?.kind === 'added',
  };
}

export const intBinaryFormat = {
  id: 'binary',
  label: 'Binary',
  icon: IconBinary,
  render: (value, changes) => {
    const { sign, signChanged, bits, isAdded } = binaryParts(value, changes);
    const changedPositions = bits.filter((bit) => bit.changed).map((bit) => bit.position);
    const changeDescription = isAdded
      ? 'New value.'
      : [
          signChanged ? 'Sign changed.' : '',
          changedPositions.length ? `Changed bit positions: ${changedPositions.join(', ')}.` : '',
        ]
          .filter(Boolean)
          .join(' ');
    return (
      <div
        class="lv-binary-value"
        role="group"
        tabIndex={0}
        aria-label={`Binary ${sign}${bits.map((bit) => bit.digit).join('')}. ${changeDescription}`.trim()}
        title={`Decimal ${value.v}`}
      >
        <code aria-hidden="true">
          <span class="lv-binary-sign" classList={{ 'is-changed': signChanged }}>
            {sign}
          </span>
          <For each={bits}>
            {(bit) => (
              <span
                class="lv-binary-bit"
                classList={{ 'is-changed': bit.changed, 'starts-group': bit.startsGroup }}
                data-bit-position={bit.position}
                title={`Bit ${bit.position}${bit.changed ? ' changed' : ''}`}
              >
                {bit.digit}
              </span>
            )}
          </For>
        </code>
      </div>
    );
  },
} satisfies ValueFormat<ValueOf<'int'>>;
