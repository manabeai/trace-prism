// @vitest-environment jsdom
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { formatOptions, renderValue } from '../../src/presentations/values/registry';
import { defineValuePresentation } from '../../src/presentations/values/contract';
import { textFormat } from '../../src/presentations/values/shared';
import type { Column, Frame, Value } from '../../src/trace/types';
import { seqId } from '../../src/trace/ids';

afterEach(cleanup);

function options(value: Value): string[] {
  const column: Column = { name: 'x', kind: value.t };
  const frame: Frame = {
    seq: seqId('0'),
    span: [],
    source: 'test.rs:1',
    changed: ['x'],
    deltas: {},
    values: { x: { name: 'x', value } },
  };
  return formatOptions(column, [frame]).map((option) => option.id);
}

describe('value formats', () => {
  it('offers formats based on observed shape without inventing graph semantics for nested arrays', () => {
    expect(
      options({
        t: 'array',
        items: [
          { t: 'int', v: '1' },
          { t: 'int', v: '2' },
        ],
      }),
    ).toEqual(['cells', 'bars', 'text']);
    expect(options({ t: 'array', items: [{ t: 'array', items: [{ t: 'int', v: '1' }] }] })).toEqual([
      'matrix',
      'text',
    ]);
    expect(options({ t: 'set', items: [] })).toEqual(['cells', 'count', 'text']);
    expect(options({ t: 'map', entries: [] })).toEqual(['entries', 'count', 'text']);
  });

  it('defines available formats for every protocol value kind', () => {
    expect(options({ t: 'int', v: '3' })).toEqual(['number', 'binary', 'text']);
    expect(options({ t: 'float', v: '3.5' })).toEqual(['number', 'text']);
    expect(options({ t: 'bool', v: true })).toEqual(['badge', 'text']);
    expect(options({ t: 'string', v: 'hello' })).toEqual(['text']);
    expect(options({ t: 'null' })).toEqual(['text']);
    expect(options({ t: 'record', fields: [] })).toEqual(['fields', 'text']);
  });

  it('dispatches shared format IDs by value kind and falls back when a format no longer fits', () => {
    const array = render(() => renderValue({ t: 'array', items: [{ t: 'int', v: '2' }] }, 'cells'));
    expect(array.container.querySelector('.dg-array')?.textContent).toBe('2');
    array.unmount();

    const set = render(() => renderValue({ t: 'set', items: [{ t: 'int', v: '2' }] }, 'cells'));
    expect(set.container.querySelector('.dg-set')?.textContent).toBe('2');
    set.unmount();

    const changedKind = render(() => renderValue({ t: 'map', entries: [] }, 'bars'));
    expect(changedKind.container.querySelector('.lv-plain-value')?.textContent).toBe('{}');
    changedKind.unmount();

    const changedShape = render(() =>
      renderValue({ t: 'array', items: [{ t: 'array', items: [{ t: 'int', v: '7' }] }] }, 'bars'),
    );
    expect(changedShape.container.querySelector('.lv-plain-value')?.textContent).toBe('[[7]]');
  });

  it('keeps each format renderer attached to its own value kind', () => {
    const matrix = render(() =>
      renderValue({ t: 'array', items: [{ t: 'array', items: [{ t: 'int', v: '7' }] }] }, 'matrix'),
    );
    expect(matrix.container.querySelector('.lv-matrix span')?.textContent).toBe('7');
    matrix.unmount();

    const bars = render(() => renderValue({ t: 'array', items: [{ t: 'int', v: '7' }] }, 'bars'));
    expect(bars.container.querySelector('.dg-bar-item small')?.textContent).toBe('7');
    bars.unmount();

    const map = render(() =>
      renderValue(
        { t: 'map', entries: [{ key: { t: 'string', v: 'x' }, value: { t: 'int', v: '7' } }] },
        'entries',
      ),
    );
    expect(map.container.querySelector('.lv-entries code')?.textContent).toBe('"x": 7');
  });

  it('highlights only changed array elements in cells and bars', () => {
    const value: Value = {
      t: 'array',
      items: [
        { t: 'int', v: '2' },
        { t: 'int', v: '3' },
      ],
    };
    const changes = [
      {
        kind: 'updated' as const,
        path: [{ kind: 'index' as const, index: 1 }],
        before: { t: 'int' as const, v: '1' },
        after: { t: 'int' as const, v: '3' },
      },
    ];
    const cells = render(() => renderValue(value, 'cells', changes));
    expect(
      [...cells.container.querySelectorAll('.dg-array span')].map((cell) =>
        cell.classList.contains('is-updated'),
      ),
    ).toEqual([false, true]);
    cells.unmount();

    const bars = render(() => renderValue(value, 'bars', changes));
    expect(
      [...bars.container.querySelectorAll('.dg-bar-item i')].map((bar) =>
        bar.classList.contains('is-changed'),
      ),
    ).toEqual([false, true]);
  });

  it('renders arbitrary precision integer bits and highlights only the changed positions', () => {
    const after = { t: 'int' as const, v: '9007199254740993' };
    const output = render(() =>
      renderValue(after, 'binary', [
        {
          kind: 'updated',
          path: [],
          before: { t: 'int', v: '9007199254740992' },
          after,
        },
      ]),
    );
    const binary = output.container.querySelector('.lv-binary-value');
    expect(binary?.textContent).toBe(`${'1'.padEnd(53, '0')}1`);
    expect(binary?.getAttribute('title')).toBe('Decimal 9007199254740993');
    expect(
      [...output.container.querySelectorAll('.lv-binary-bit.is-changed')].map((bit) =>
        bit.getAttribute('data-bit-position'),
      ),
    ).toEqual(['0']);
  });

  it('compares integer magnitudes from the least significant bit and marks sign changes', () => {
    const shorter = render(() =>
      renderValue({ t: 'int', v: '1' }, 'binary', [
        {
          kind: 'updated',
          path: [],
          before: { t: 'int', v: '8' },
          after: { t: 'int', v: '1' },
        },
      ]),
    );
    expect(shorter.container.querySelector('.lv-binary-value')?.textContent).toBe('0001');
    expect(
      [...shorter.container.querySelectorAll('.lv-binary-bit.is-changed')].map((bit) =>
        bit.getAttribute('data-bit-position'),
      ),
    ).toEqual(['3', '0']);
    shorter.unmount();

    const sign = render(() =>
      renderValue({ t: 'int', v: '2' }, 'binary', [
        {
          kind: 'updated',
          path: [],
          before: { t: 'int', v: '-2' },
          after: { t: 'int', v: '2' },
        },
      ]),
    );
    expect(sign.container.querySelector('.lv-binary-sign.is-changed')?.textContent).toBe('+');
    expect(sign.container.querySelectorAll('.lv-binary-bit.is-changed')).toHaveLength(0);
  });

  it('passes typed nested paths to matrix, set, map, and record formats', () => {
    const matrix = render(() =>
      renderValue(
        {
          t: 'array',
          items: [
            {
              t: 'array',
              items: [
                { t: 'int', v: '1' },
                { t: 'int', v: '2' },
              ],
            },
          ],
        },
        'matrix',
        [
          {
            kind: 'updated',
            path: [
              { kind: 'index', index: 0 },
              { kind: 'index', index: 1 },
            ],
            before: { t: 'int', v: '1' },
            after: { t: 'int', v: '2' },
          },
        ],
      ),
    );
    expect(
      [...matrix.container.querySelectorAll('.lv-matrix span')].map((cell) =>
        cell.classList.contains('is-updated'),
      ),
    ).toEqual([false, true]);
    matrix.unmount();

    const set = render(() =>
      renderValue(
        {
          t: 'set',
          items: [
            { t: 'int', v: '1' },
            { t: 'string', v: '1' },
          ],
        },
        'cells',
        [
          {
            kind: 'added',
            path: [{ kind: 'member', value: { t: 'string', v: '1' } }],
            after: { t: 'string', v: '1' },
          },
        ],
      ),
    );
    expect(
      [...set.container.querySelectorAll('.dg-set span')].map((cell) =>
        cell.classList.contains('is-updated'),
      ),
    ).toEqual([false, true]);
    set.unmount();

    const map = render(() =>
      renderValue(
        { t: 'map', entries: [{ key: { t: 'string', v: 'k' }, value: { t: 'int', v: '2' } }] },
        'entries',
        [
          {
            kind: 'updated',
            path: [{ kind: 'key', key: { t: 'string', v: 'k' } }],
            before: { t: 'int', v: '1' },
            after: { t: 'int', v: '2' },
          },
        ],
      ),
    );
    expect(map.container.querySelector('.lv-entries code')?.classList.contains('is-updated')).toBe(true);
    map.unmount();

    const record = render(() =>
      renderValue({ t: 'record', fields: [{ name: 'n', value: { t: 'int', v: '2' } }] }, 'fields', [
        {
          kind: 'updated',
          path: [{ kind: 'field', name: 'n' }],
          before: { t: 'int', v: '1' },
          after: { t: 'int', v: '2' },
        },
      ]),
    );
    expect(record.container.querySelector('.lv-entries code')?.classList.contains('is-updated')).toBe(true);
  });

  it('rejects duplicate format IDs within one value kind', () => {
    expect(() =>
      defineValuePresentation<'null'>({
        kind: 'null',
        formats: [textFormat()],
        fallback: textFormat(),
      }),
    ).toThrow('Duplicate format ID for null');
  });
});
