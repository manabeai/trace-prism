import { describe, expect, it } from 'vitest';
import { diffValues } from '../../src/trace/diff';
import { seqId } from '../../src/trace/ids';
import type { Frame, Value } from '../../src/trace/types';
import { evaluateSearch } from '../../src/search/evaluate';
import { candidatesFor, commitText } from '../../src/search/grammar';
import {
  emptyQuery,
  parseLiteral,
  sameShape,
  searchFields,
  serializeQuery,
  stageOf,
} from '../../src/search/model';

const int = (value: string): Value => ({ t: 'int', v: value });
const array = (...values: string[]): Value => ({ t: 'array', items: values.map(int) });
const set = (...values: string[]): Value => ({ t: 'set', items: values.map(int) });
const frames: Frame[] = [
  {
    seq: seqId('0'),
    span: [],
    source: 'test.rs:1',
    values: {
      a: { name: 'a', value: int('9007199254740993') },
      A: { name: 'A', value: array('2', '5', '8') },
      visited: { name: 'visited', value: set('1', '2') },
      label: { name: 'label', value: { t: 'string', v: 'running' } },
    },
    changed: [],
    deltas: {},
  },
  {
    seq: seqId('1'),
    span: [],
    source: 'test.rs:2',
    values: {
      a: { name: 'a', value: int('9007199254740994') },
      A: { name: 'A', value: array('2', '7', '8') },
      visited: { name: 'visited', value: set('2', '1') },
      label: { name: 'label', value: { t: 'string', v: 'settled' } },
    },
    changed: ['a', 'A', 'label'],
    deltas: {
      a: diffValues(int('9007199254740993'), int('9007199254740994')),
      A: diffValues(array('2', '5', '8'), array('2', '7', '8')),
      label: diffValues({ t: 'string', v: 'running' }, { t: 'string', v: 'settled' }),
    },
  },
];
const columns = [
  { name: 'a', kind: 'int' as const },
  { name: 'A', kind: 'array' as const },
  { name: 'visited', kind: 'set' as const },
  { name: 'label', kind: 'string' as const },
];
const fields = searchFields(columns, frames);

function query(...words: string[]) {
  return words.reduce((current, word) => {
    const next = commitText(fields, current, word);
    if (!next) throw new Error(`Cannot add ${word} to ${serializeQuery(current)}`);
    return next;
  }, emptyQuery());
}

describe('typed trace search', () => {
  it('offers operations from observed value shapes and typed right-hand values', () => {
    const selected = query('A');
    expect(candidatesFor(fields, selected, '').map((item) => item.key)).toContain('<');
    const comparison = query('A', '<');
    expect(candidatesFor(fields, comparison, '').map((item) => item.key)).toContain('@A');
    expect(candidatesFor(fields, comparison, '').map((item) => item.key)).toContain('[1, 2, 3]');
    expect(stageOf(query('label', 'size'))).toBe('predicate');
  });

  it('compares exact large integers and arrays lexicographically', () => {
    expect(evaluateSearch(frames, query('a', '>=', '9007199254740994'), '').hits).toEqual([seqId('1')]);
    expect(evaluateSearch(frames, query('A', '<', '[2, 6, 8]'), '').hits).toEqual([seqId('0')]);
    expect(evaluateSearch(frames, query('A', '==', '@A'), '').hits).toEqual([seqId('0'), seqId('1')]);
  });

  it('treats sets as unordered and returns exact paths for changed elements', () => {
    expect(evaluateSearch(frames, query('visited', '==', '{2, 1}'), '').hits).toEqual([
      seqId('0'),
      seqId('1'),
    ]);
    const changed = evaluateSearch(frames, query('A', 'changed'), '');
    expect(changed.hits).toEqual([seqId('1')]);
    expect(changed.bySeq.get(seqId('1'))?.fields.get('A')).toEqual([[{ kind: 'index', index: 1 }]]);
    const contains = evaluateSearch(frames, query('A', 'contains', '7'), '');
    expect(contains.bySeq.get(seqId('1'))?.fields.get('A')).toEqual([[{ kind: 'index', index: 1 }]]);
  });

  it('searches scalar leaves and field names without matching serialized punctuation', () => {
    expect(evaluateSearch(frames, emptyQuery(), 'SETTLED').hits).toEqual([seqId('1')]);
    expect(evaluateSearch(frames, emptyQuery(), 'visited').hits).toEqual([seqId('0'), seqId('1')]);
    expect(evaluateSearch(frames, emptyQuery(), '[2,').hits).toEqual([]);
  });

  it('infers a useful type after an initial null and still offers is null', () => {
    const nullable = frames.map((frame, index): Frame => ({
      ...frame,
      values: { flag: { name: 'flag', value: index ? { t: 'bool', v: true } : { t: 'null' } } },
    }));
    const candidates = searchFields([{ name: 'flag', kind: 'null' }], nullable);
    expect(candidates[0].shape.kind).toBe('bool');
    expect(
      candidatesFor(candidates, commitText(candidates, emptyQuery(), 'flag')!, '').map((item) => item.key),
    ).toEqual(expect.arrayContaining(['is true', 'is null']));
  });

  it('infers map entry types after an empty snapshot and matches record shapes by field name', () => {
    const mapFrames = frames.map((frame, index): Frame => ({
      ...frame,
      values: {
        counts: {
          name: 'counts',
          value: {
            t: 'map',
            entries: index ? [{ key: { t: 'int', v: '1' }, value: int('3') }] : [],
          },
        },
      },
    }));
    const mapField = searchFields([{ name: 'counts', kind: 'map' }], mapFrames)[0];
    expect(mapField.shape).toEqual({ kind: 'map', key: { kind: 'int' }, value: { kind: 'int' } });
    expect(
      sameShape(
        {
          kind: 'record',
          fields: [
            { name: 'left', shape: { kind: 'int' } },
            { name: 'right', shape: { kind: 'bool' } },
          ],
        },
        {
          kind: 'record',
          fields: [
            { name: 'right', shape: { kind: 'bool' } },
            { name: 'left', shape: { kind: 'int' } },
          ],
        },
      ),
    ).toBe(true);
  });

  it('does not call an initial snapshot a change, and requires balanced string quotes', () => {
    const initial = { ...frames[0], deltas: { a: diffValues(undefined, int('9007199254740993')) } };
    expect(evaluateSearch([initial, frames[1]], query('a', 'changed'), '').hits).toEqual([seqId('1')]);
    expect(parseLiteral({ kind: 'string' }, '"two words')).toBeUndefined();
    expect(parseLiteral({ kind: 'string' }, '"two words"')).toEqual({ t: 'string', v: 'two words' });
  });
});
