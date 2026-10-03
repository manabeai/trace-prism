export type ValueKind = 'int' | 'int-array' | 'bool' | 'string' | 'char' | 'int-set';
export type Value = number | number[] | boolean | string | Set<number>;
export type Variable = { name: string; kind: ValueKind; description: string };
export type Frame = { seq: number; span: string; values: Record<string, Value> };

export const variables: Variable[] = [
  { name: 'a', kind: 'int', description: 'Current value' },
  { name: 'A', kind: 'int-array', description: 'Numbers' },
  { name: 'seen', kind: 'bool', description: 'Visited flag' },
  { name: 'visited', kind: 'int-set', description: 'Visited nodes' },
  { name: 'label', kind: 'string', description: 'State name' },
  { name: 'phase', kind: 'char', description: 'Phase marker' },
];

const numbers = [2, 5, 8, 11, 15, 18, 21, 24, 28, 31, 34, 37];
export const frames: Frame[] = numbers.map((a, index) => ({
  seq: index,
  span: `[0, ${Math.floor(index / 3)}]`,
  values: {
    a,
    A: [2, 5 + Math.floor(index / 3), 8, index < 5 ? 11 : 15, index < 9 ? 18 : 21],
    seen: index >= 4 && index <= 8,
    visited: new Set(Array.from({ length: Math.min(index + 1, 7) }, (_, i) => i)),
    label: index >= 8 ? 'settled' : index >= 4 ? 'exploring' : 'queued',
    phase: index >= 8 ? 'C' : index >= 4 ? 'B' : 'A',
  },
}));

export type Transform = 'sum' | 'size' | 'max' | 'min';
export type Operator =
  | '<'
  | '<='
  | '>'
  | '>='
  | '=='
  | '!='
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'subsetOf'
  | 'supersetOf'
  | 'changed'
  | 'is true'
  | 'is false';
export type Connector = 'and' | 'or';
export type Clause = { variable: Variable; transform?: Transform; operator?: Operator; rhs?: string };
export type Query = { clauses: Clause[]; connectors: Connector[] };
export type Stage = 'variable' | 'transform-or-operator' | 'operator' | 'value' | 'complete';
export type Candidate = {
  key: string;
  label: string;
  detail: string;
  kind: 'variable' | 'transform' | 'operator' | 'connector' | 'example';
  rhsKind?: ValueKind;
  resultKind?: ValueKind;
};

export function effectiveKind(clause: Clause): ValueKind {
  return clause.transform ? 'int' : clause.variable.kind;
}

export function stageOf(query: Query): Stage {
  if (query.connectors.length === query.clauses.length && query.clauses.length > 0) return 'variable';
  const clause = query.clauses.at(-1);
  if (!clause) return 'variable';
  if (!clause.operator)
    return !clause.transform && transformsFor(clause.variable.kind).length > 0
      ? 'transform-or-operator'
      : 'operator';
  if (clause.operator === 'changed' || clause.operator === 'is true' || clause.operator === 'is false')
    return 'complete';
  return clause.rhs === undefined ? 'value' : 'complete';
}

export function expectedRhsKind(clause: Clause): ValueKind {
  if (clause.operator === 'contains') return clause.variable.kind === 'string' ? 'string' : 'int';
  if (clause.operator === 'subsetOf' || clause.operator === 'supersetOf') return 'int-set';
  return effectiveKind(clause);
}

function operator(key: Operator, label: string, detail: string, rhsKind?: ValueKind): Candidate {
  return { key, label, detail, kind: 'operator', rhsKind };
}

function operatorsFor(kind: ValueKind): Candidate[] {
  const changed: Candidate = {
    key: 'changed',
    label: 'changed',
    detail: 'Changed since previous seq',
    kind: 'operator',
  };
  const comparisons: Candidate[] = [
    operator('<', '<', 'Less than', 'int'),
    operator('<=', '<=', 'Less than or equal', 'int'),
    operator('>', '>', 'Greater than', 'int'),
    operator('>=', '>=', 'Greater than or equal', 'int'),
    operator('==', '==', 'Equals', 'int'),
    operator('!=', '!=', 'Does not equal', 'int'),
  ];
  if (kind === 'int') return [...comparisons, changed];
  if (kind === 'bool')
    return [
      operator('is true', 'true', 'Value is true'),
      operator('is false', 'false', 'Value is false'),
      operator('==', '==', 'Equals', 'bool'),
      operator('!=', '!=', 'Does not equal', 'bool'),
      changed,
    ];
  if (kind === 'string')
    return [
      operator('contains', 'contains', 'Contains text', 'string'),
      operator('startsWith', 'starts with', 'Text prefix', 'string'),
      operator('endsWith', 'ends with', 'Text suffix', 'string'),
      operator('==', '==', 'Equals', 'string'),
      operator('!=', '!=', 'Does not equal', 'string'),
      changed,
    ];
  if (kind === 'char')
    return [operator('==', '==', 'Equals', 'char'), operator('!=', '!=', 'Does not equal', 'char'), changed];
  if (kind === 'int-array')
    return [
      operator('contains', 'contains', 'Contains integer', 'int'),
      operator('<', '<', 'Lexicographically less than', 'int-array'),
      operator('<=', '<=', 'Lexicographically less than or equal', 'int-array'),
      operator('>', '>', 'Lexicographically greater than', 'int-array'),
      operator('>=', '>=', 'Lexicographically greater than or equal', 'int-array'),
      operator('==', '==', 'Same sequence', 'int-array'),
      operator('!=', '!=', 'Different sequence', 'int-array'),
      changed,
    ];
  if (kind === 'int-set')
    return [
      operator('contains', 'contains', 'Contains integer', 'int'),
      operator('subsetOf', 'subset of', 'Every element is in the right set', 'int-set'),
      operator('supersetOf', 'superset of', 'Contains every element in the right set', 'int-set'),
      operator('==', '==', 'Same members', 'int-set'),
      operator('!=', '!=', 'Different members', 'int-set'),
      changed,
    ];
  return [changed];
}

function transformsFor(kind: ValueKind): Candidate[] {
  const transform = (key: Transform, detail: string): Candidate => ({
    key,
    label: key,
    detail,
    kind: 'transform',
    resultKind: 'int',
  });
  if (kind === 'int-array')
    return [
      transform('sum', 'Sum of elements'),
      transform('size', 'Number of elements'),
      transform('max', 'Largest element'),
      transform('min', 'Smallest element'),
    ];
  if (kind === 'int-set') return [transform('size', 'Number of members')];
  if (kind === 'string') return [transform('size', 'Number of characters')];
  return [];
}

export function candidatesFor(query: Query, draft: string): Candidate[] {
  const stage = stageOf(query);
  const clause = query.clauses.at(-1);
  let options: Candidate[];
  if (stage === 'variable') {
    options = variables.map((variable) => ({
      key: variable.name,
      label: variable.name,
      detail: variable.description,
      kind: 'variable',
    }));
  } else if (stage === 'transform-or-operator' && clause) {
    options = [...transformsFor(clause.variable.kind), ...operatorsFor(clause.variable.kind)];
  } else if (stage === 'operator' && clause) {
    options = operatorsFor(effectiveKind(clause));
  } else if (stage === 'complete') {
    options = [
      { key: 'and', label: 'AND', detail: 'Both conditions must match', kind: 'connector' },
      { key: 'or', label: 'OR', detail: 'Either condition may match', kind: 'connector' },
    ];
  } else {
    const kind = clause ? expectedRhsKind(clause) : 'int';
    const examples =
      kind === 'string'
        ? ['exploring', 'settled', 'queued']
        : kind === 'char'
          ? ['A', 'B', 'C']
          : kind === 'bool'
            ? ['true', 'false']
            : kind === 'int-array'
              ? ['[2, 5, 8]', '[2, 7, 8]', '[2, 8, 11]']
              : kind === 'int-set'
                ? ['{0, 1, 2}', '{0, 1, 2, 3}', '{1, 2, 4}']
                : ['10', '20', '30'];
    options = examples.map((key) => ({
      key,
      label: key,
      detail: 'Use as value',
      kind: 'example',
      rhsKind: kind,
    }));
  }
  const needle = normalize(draft.trim());
  return needle
    ? options.filter(
        (option) => normalize(option.key).includes(needle) || normalize(option.label).includes(needle),
      )
    : options;
}

export function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase();
}

export function validLiteral(kind: ValueKind, text: string): boolean {
  if (kind === 'int') return /^-?\d+$/.test(text);
  if (kind === 'bool') return /^(true|false)$/i.test(text);
  if (kind === 'int-array') return /^\[\s*-?\d+(?:\s*,\s*-?\d+)*\s*\]$/.test(text);
  if (kind === 'int-set') return /^\{\s*-?\d+(?:\s*,\s*-?\d+)*\s*\}$/.test(text);
  if (kind === 'char') return [...text.replace(/^['"]|['"]$/g, '')].length === 1;
  return text.trim().length > 0;
}

export function parseLiteral(kind: ValueKind, text: string): Value | undefined {
  const value = text.trim().replace(/^['"]|['"]$/g, '');
  if (!validLiteral(kind, text)) return undefined;
  if (kind === 'int') return Number(value);
  if (kind === 'bool') return value.toLocaleLowerCase() === 'true';
  if (kind === 'string' || kind === 'char') return value;
  const values = value
    .slice(1, -1)
    .split(',')
    .map((item) => Number(item.trim()));
  return kind === 'int-array' ? values : new Set(values);
}

export function applyCandidate(query: Query, candidate: Candidate, draft = ''): Query {
  const clauses = query.clauses.map((clause) => ({ ...clause }));
  const connectors = [...query.connectors];
  const clause = clauses.at(-1);
  if (candidate.kind === 'variable') {
    const variable = variables.find((item) => item.name === candidate.key);
    if (variable) clauses.push({ variable });
  } else if (candidate.kind === 'connector') {
    connectors.push(candidate.key as Connector);
  } else if (clause && candidate.kind === 'transform') {
    clause.transform = candidate.key as Transform;
  } else if (clause && candidate.kind === 'operator') {
    clause.operator = candidate.key as Operator;
  } else if (clause && candidate.kind === 'example') {
    clause.rhs = draft || candidate.key;
  }
  return { clauses, connectors };
}

export function appendLiteral(query: Query, text: string): Query {
  const clauses = query.clauses.map((clause) => ({ ...clause }));
  const last = clauses.at(-1);
  if (last) last.rhs = text.replace(/^['"]|['"]$/g, '');
  return { clauses, connectors: [...query.connectors] };
}

export function isComplete(query: Query): boolean {
  return (
    query.clauses.length > 0 &&
    query.connectors.length === query.clauses.length - 1 &&
    stageOf(query) === 'complete'
  );
}

export function serializeQuery(query: Query): string {
  return query.clauses
    .map((clause, index) =>
      [
        index > 0 ? query.connectors[index - 1] : '',
        clause.variable.name,
        clause.transform ?? '',
        clause.operator ?? '',
        clause.rhs === undefined
          ? ''
          : effectiveKind(clause) === 'string' || effectiveKind(clause) === 'char'
            ? JSON.stringify(clause.rhs)
            : clause.rhs,
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ');
}

function project(clause: Clause, frame: Frame): Value | undefined {
  const value = frame.values[clause.variable.name];
  if (!clause.transform) return value;
  if (clause.transform === 'size' && typeof value === 'string') return [...value].length;
  if (!(Array.isArray(value) || value instanceof Set)) return undefined;
  const items = value instanceof Set ? [...value] : value;
  if (clause.transform === 'size') return items.length;
  if (clause.transform === 'sum') return items.reduce((total, item) => total + item, 0);
  if (clause.transform === 'max') return items.length ? Math.max(...items) : undefined;
  if (clause.transform === 'min') return items.length ? Math.min(...items) : undefined;
}

function sameValue(left: Value, right: Value): boolean {
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, index) => value === right[index]);
  if (left instanceof Set && right instanceof Set)
    return left.size === right.size && [...left].every((value) => right.has(value));
  return left === right;
}

function compareArrays(left: number[], right: number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
}

export function matchesClause(clause: Clause, frame: Frame, previous?: Frame): boolean {
  const value = project(clause, frame);
  if (clause.operator === 'changed')
    return (
      previous !== undefined &&
      JSON.stringify([...unwrap(frame.values[clause.variable.name])]) !==
        JSON.stringify([...unwrap(previous.values[clause.variable.name])])
    );
  if (clause.operator === 'is true') return value === true;
  if (clause.operator === 'is false') return value === false;
  if (clause.rhs === undefined || value === undefined) return false;
  const expectedKind = expectedRhsKind(clause);
  const rhs = parseLiteral(expectedKind, clause.rhs);
  if (rhs === undefined) return false;
  if (clause.operator === 'contains') {
    if (typeof value === 'string') return normalize(value).includes(normalize(String(rhs)));
    return (
      (Array.isArray(value) || value instanceof Set) && typeof rhs === 'number' && [...value].includes(rhs)
    );
  }
  if (clause.operator === 'startsWith')
    return typeof value === 'string' && normalize(value).startsWith(normalize(String(rhs)));
  if (clause.operator === 'endsWith')
    return typeof value === 'string' && normalize(value).endsWith(normalize(String(rhs)));
  if (clause.operator === '==') return sameValue(value, rhs);
  if (clause.operator === '!=') return !sameValue(value, rhs);
  if (clause.operator === 'subsetOf' && value instanceof Set && rhs instanceof Set)
    return [...value].every((item) => rhs.has(item)) && value.size < rhs.size;
  if (clause.operator === 'supersetOf' && value instanceof Set && rhs instanceof Set)
    return [...rhs].every((item) => value.has(item)) && value.size > rhs.size;
  if (Array.isArray(value) && Array.isArray(rhs)) {
    const comparison = compareArrays(value, rhs);
    if (clause.operator === '<') return comparison < 0;
    if (clause.operator === '<=') return comparison <= 0;
    if (clause.operator === '>') return comparison > 0;
    if (clause.operator === '>=') return comparison >= 0;
  }
  if (typeof value !== 'number' || typeof rhs !== 'number') return false;
  if (clause.operator === '<') return value < rhs;
  if (clause.operator === '<=') return value <= rhs;
  if (clause.operator === '>') return value > rhs;
  if (clause.operator === '>=') return value >= rhs;
  return false;
}

function unwrap(value: Value): (string | number | boolean)[] {
  if (Array.isArray(value) || value instanceof Set) return [...value];
  return [value];
}

export function matchingFields(query: Query, frame: Frame, previous?: Frame): string[] {
  const results = query.clauses.map((clause) => matchesClause(clause, frame, previous));
  if (!results.length) return [];
  let match = results[0];
  for (let index = 1; index < results.length; index++) {
    match = query.connectors[index - 1] === 'or' ? match || results[index] : match && results[index];
  }
  return match
    ? query.clauses.filter((clause, index) => results[index]).map((clause) => clause.variable.name)
    : [];
}

export function textFields(text: string, frame: Frame): string[] {
  const needle = normalize(text.trim());
  if (!needle) return [];
  return variables
    .filter((variable) => {
      const value = frame.values[variable.name];
      const haystack = [variable.name, ...unwrap(value).map(String)];
      return haystack.some((part) => normalize(part).includes(needle));
    })
    .map((variable) => variable.name);
}
