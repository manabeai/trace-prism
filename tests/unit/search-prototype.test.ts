import { describe, expect, it } from 'vitest';
import {
  appendLiteral,
  applyCandidate,
  candidatesFor,
  frames,
  matchesClause,
  stageOf,
  type Query,
  variables,
} from '../../src/design/search-prototype';

const empty = (): Query => ({ clauses: [], connectors: [] });

function clauseFor(variable: string, operator: string, rhs: string) {
  const value = variables.find((item) => item.name === variable)!;
  return { variable: value, operator: operator as never, rhs };
}

describe('search prototype value grammar', () => {
  it('offers size for strings and transitions the result to int operators', () => {
    const label = applyCandidate(
      empty(),
      candidatesFor(empty(), '').find((item) => item.key === 'label')!,
    );
    expect(candidatesFor(label, '').map((item) => item.key)).toContain('size');
    const sized = applyCandidate(
      label,
      candidatesFor(label, '').find((item) => item.key === 'size')!,
    );
    expect(candidatesFor(sized, '').map((item) => item.key)).toContain('>=');
  });

  it('offers a typed collection RHS for array and set comparisons', () => {
    const array = applyCandidate(
      empty(),
      candidatesFor(empty(), '').find((item) => item.key === 'A')!,
    );
    const arrayComparison = applyCandidate(
      array,
      candidatesFor(array, '').find((item) => item.key === '<')!,
    );
    expect(
      candidatesFor(arrayComparison, '')
        .filter((item) => item.kind === 'example')
        .map((item) => item.key),
    ).toContain('[2, 5, 8]');

    const set = applyCandidate(
      empty(),
      candidatesFor(empty(), '').find((item) => item.key === 'visited')!,
    );
    const subset = applyCandidate(
      set,
      candidatesFor(set, '').find((item) => item.key === 'subsetOf')!,
    );
    expect(
      candidatesFor(subset, '')
        .filter((item) => item.kind === 'example')
        .map((item) => item.key),
    ).toContain('{0, 1, 2}');
  });

  it('evaluates string size, array lexicographic order, and set relations', () => {
    expect(
      matchesClause(
        {
          ...clauseFor('label', '>=', '7'),
          transform: 'size',
        },
        frames[8],
      ),
    ).toBe(true);
    expect(matchesClause(clauseFor('A', '<', '[2, 8, 8, 11, 18]'), frames[0])).toBe(true);
    expect(matchesClause(clauseFor('visited', 'subsetOf', '{0, 1, 2, 3, 4, 5, 6}'), frames[4])).toBe(true);
    expect(matchesClause(clauseFor('visited', 'supersetOf', '{0, 1}'), frames[4])).toBe(true);
  });

  it('requires the typed literal before a clause becomes complete', () => {
    const array = applyCandidate(
      empty(),
      candidatesFor(empty(), '').find((item) => item.key === 'A')!,
    );
    const comparison = applyCandidate(
      array,
      candidatesFor(array, '').find((item) => item.key === '>=')!,
    );
    expect(stageOf(comparison)).toBe('value');
    expect(stageOf(appendLiteral(comparison, '[2, 7, 8]'))).toBe('complete');
  });
});
