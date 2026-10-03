// @vitest-environment jsdom
import { cleanup, render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AlgoCell,
  candidateNames,
  templates,
  validBindings,
  type AlgoView,
} from '../../src/presentations/algo/registry';
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
    deltas: {},
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

  it('renders an adjacency graph with visited and current vertex overlays', () => {
    const graphFrame: Frame = {
      ...frame('1'),
      values: {
        adjacency: {
          name: 'adjacency',
          value: {
            t: 'array',
            items: [
              {
                t: 'array',
                items: [
                  { t: 'int', v: '1' },
                  { t: 'int', v: '2' },
                ],
              },
              { t: 'array', items: [{ t: 'int', v: '2' }] },
              { t: 'array', items: [] },
            ],
          },
        },
        seen: {
          name: 'seen',
          value: { t: 'array', items: [true, true, false].map((v) => ({ t: 'bool' as const, v })) },
        },
        u: { name: 'u', value: { t: 'int', v: '1' } },
      },
    };
    const graphView: AlgoView = {
      id: 2,
      template: 'graph',
      bindings: { adjacency: 'adjacency', visited: 'seen', v: 'u' },
      enabled: true,
    };
    const { container } = render(() => <AlgoCell view={graphView} frame={graphFrame} />);
    expect(container.querySelectorAll('svg[role="img"] g')).toHaveLength(3);
    expect(container.querySelectorAll('svg[role="img"] line')).toHaveLength(3);
    expect(container.querySelector('[aria-label="Vertex 1, visited, current"]')).not.toBeNull();
    expect(container.textContent).toContain('3 vertices · 3 edges');

    expect(candidateNames([graphFrame], templates.graph.roles[1])).toEqual(['seen']);
    expect(validBindings(templates.graph, { adjacency: 'adjacency' }, [graphFrame])).toBe(true);
    expect(validBindings(templates.graph, { adjacency: 'adjacency', visited: 'u' }, [graphFrame])).toBe(
      false,
    );

    const setFrame: Frame = {
      ...graphFrame,
      values: {
        ...graphFrame.values,
        seen: {
          name: 'seen',
          value: {
            t: 'set',
            items: [
              { t: 'int', v: '0' },
              { t: 'int', v: '2' },
            ],
          },
        },
      },
    };
    const { container: setContainer } = render(() => <AlgoCell view={graphView} frame={setFrame} />);
    expect(candidateNames([setFrame], templates.graph.roles[1])).toEqual(['seen']);
    expect(setContainer.querySelector('[aria-label="Vertex 2, visited"]')).not.toBeNull();
  });
});
