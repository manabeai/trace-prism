export type ValueKind = 'int' | 'int-array' | 'bool' | 'string' | 'char' | 'int-set';
export type Value = number | number[] | boolean | string | Set<number>;
export type Variable = { name: string; kind: ValueKind; description: string };
export type Frame = { seq: number; span: string; values: Record<string, Value> };

export const variables: Variable[] = [
  { name: 'a', kind: 'int', description: 'Current value' },
  { name: 'A', kind: 'int-array', description: 'Numbers · Vec<int>' },
  { name: 'seen', kind: 'bool', description: 'Visited flag' },
  { name: 'visited', kind: 'int-set', description: 'Visited nodes · Set<int>' },
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
};

export function effectiveKind(clause: Clause): ValueKind {
  return clause.transform ? 'int' : clause.variable.kind;
}

export function stageOf(query: Query): Stage {
  if (query.connectors.length === query.clauses.length && query.clauses.length > 0) return 'variable';
  const clause = query.clauses.at(-1);
  if (!clause) return 'variable';
  if (!clause.operator)
    return !clause.transform && (clause.variable.kind === 'int-array' || clause.variable.kind === 'int-set')
      ? 'transform-or-operator'
      : 'operator';
  if (clause.operator === 'changed' || clause.operator === 'is true' || clause.operator === 'is false')
    return 'complete';
  return clause.rhs === undefined ? 'value' : 'complete';
}

function operatorsFor(kind: ValueKind): Candidate[] {
  const changed: Candidate = {
    key: 'changed',
    label: 'changed',
    detail: 'Changed since previous seq',
    kind: 'operator',
  };
  const comparisons: Candidate[] = [
    { key: '<', label: '<', detail: 'Less than', kind: 'operator' },
    { key: '<=', label: '<=', detail: 'Less than or equal', kind: 'operator' },
    { key: '>', label: '>', detail: 'Greater than', kind: 'operator' },
    { key: '>=', label: '>=', detail: 'Greater than or equal', kind: 'operator' },
    { key: '==', label: '==', detail: 'Equals', kind: 'operator' },
    { key: '!=', label: '!=', detail: 'Does not equal', kind: 'operator' },
  ];
  if (kind === 'int') return [...comparisons, changed];
  if (kind === 'bool')
    return [
      { key: 'is true', label: 'true', detail: 'Value is true', kind: 'operator' },
      { key: 'is false', label: 'false', detail: 'Value is false', kind: 'operator' },
      changed,
    ];
  if (kind === 'string')
    return [
      { key: 'contains', label: 'contains', detail: 'Contains text', kind: 'operator' },
      { key: 'startsWith', label: 'starts with', detail: 'Text prefix', kind: 'operator' },
      { key: 'endsWith', label: 'ends with', detail: 'Text suffix', kind: 'operator' },
      ...comparisons.slice(4),
      changed,
    ];
  if (kind === 'char') return [...comparisons.slice(4), changed];
  if (kind === 'int-array' || kind === 'int-set')
    return [{ key: 'contains', label: 'contains', detail: 'Contains integer', kind: 'operator' }, changed];
  return [changed];
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
    const transforms: Candidate[] = (
      clause.variable.kind === 'int-array' ? ['sum', 'size', 'max', 'min'] : ['size']
    ).map((key) => ({
      key,
      label: key,
      detail: {
        sum: 'Sum of elements',
        size: 'Number of elements',
        max: 'Largest element',
        min: 'Smallest element',
      }[key]!,
      kind: 'transform',
    }));
    options = [...transforms, ...operatorsFor(clause.variable.kind)];
  } else if (stage === 'operator' && clause) {
    options = operatorsFor(effectiveKind(clause));
  } else if (stage === 'complete') {
    options = [
      { key: 'and', label: 'AND', detail: 'Both conditions must match', kind: 'connector' },
      { key: 'or', label: 'OR', detail: 'Either condition may match', kind: 'connector' },
    ];
  } else {
    const kind = clause ? effectiveKind(clause) : 'int';
    const examples =
      kind === 'string'
        ? ['exploring', 'settled', 'queued']
        : kind === 'char'
          ? ['A', 'B', 'C']
          : ['10', '20', '30'];
    options = examples.map((key) => ({ key, label: key, detail: 'Use as value', kind: 'example' }));
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
  if (kind === 'int' || kind === 'int-array' || kind === 'int-set') return /^-?\d+$/.test(text);
  if (kind === 'char') return [...text.replace(/^['"]|['"]$/g, '')].length === 1;
  return text.trim().length > 0;
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
  if (!(Array.isArray(value) || value instanceof Set)) return undefined;
  const items = value instanceof Set ? [...value] : value;
  if (clause.transform === 'size') return items.length;
  if (clause.transform === 'sum') return items.reduce((total, item) => total + item, 0);
  if (clause.transform === 'max') return items.length ? Math.max(...items) : undefined;
  if (clause.transform === 'min') return items.length ? Math.min(...items) : undefined;
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
  const rhs: number | string = ['int', 'int-array', 'int-set'].includes(effectiveKind(clause))
    ? Number(clause.rhs)
    : clause.rhs;
  if (clause.operator === 'contains') {
    if (typeof value === 'string') return normalize(value).includes(normalize(String(rhs)));
    return (Array.isArray(value) || value instanceof Set) && [...value].includes(Number(rhs));
  }
  if (clause.operator === 'startsWith')
    return typeof value === 'string' && normalize(value).startsWith(normalize(String(rhs)));
  if (clause.operator === 'endsWith')
    return typeof value === 'string' && normalize(value).endsWith(normalize(String(rhs)));
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (clause.operator === '==') return value === rhs;
  if (clause.operator === '!=') return value !== rhs;
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
