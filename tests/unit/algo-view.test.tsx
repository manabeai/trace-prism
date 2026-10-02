// @vitest-environment jsdom
import { cleanup, render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { AlgoCell, type AlgoView } from '../../src/presentations/algo/registry';
import { seqId } from '../../src/trace/ids';
import type { Frame } from '../../src/trace/types';

afterEach(cleanup);

const view: AlgoView = {
  id: 1,
  template: 'binary',
  bindings: { left: 'left', right: 'right', mid: 'mid', predicate: 'ok' },
  enabled: true,
};

function frame(mid: string): Frame {
  return {
    seq: seqId(mid),
    span: [],
    source: 'search.rs:1',
    changed: ['mid'],
    values: {
      left: { name: 'left', value: { t: 'int', v: '0' } },
      right: { name: 'right', value: { t: 'int', v: '4' } },
      mid: { name: 'mid', value: { t: 'int', v: mid } },
      ok: { name: 'ok', value: { t: 'bool', v: mid === '2' } },
    },
  };
}

describe('Algo View renderer', () => {
  it('follows the selected frame reactively', () => {
    const [selected, setSelected] = createSignal(frame('1'));
    const { container } = render(() => <AlgoCell view={view} frame={selected()} />);
    expect(container.textContent).toContain('M 1');
    expect(container.querySelector('.dg-bool')?.textContent).toBe('false');
    setSelected(frame('2'));
    expect(container.textContent).toContain('M 2');
    expect(container.querySelector('.dg-bool')?.textContent).toBe('true');
  });
});
