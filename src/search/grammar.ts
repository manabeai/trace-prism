import { valueText } from '../trace/value';
import {
  normalize,
  operandShape,
  parseLiteral,
  projectedShape,
  sameShape,
  shapeLabel,
  stageOf,
  type Candidate,
  type Clause,
  type Predicate,
  type Projection,
  type Query,
  type SearchField,
  type Shape,
} from './model';

const predicate = (key: Predicate, detail: string, type?: Shape): Candidate => ({
  kind: 'predicate',
  key,
  label: key,
  detail,
  type,
});
const projection = (key: Projection, detail: string, type: Shape): Candidate => ({
  kind: 'projection',
  key,
  label: key,
  detail,
  type,
});
const int: Shape = { kind: 'int' };

function projectionsFor(shape: Shape): Candidate[] {
  if (shape.kind === 'array') {
    const items = shape.item.kind === 'int' || shape.item.kind === 'float';
    return [
      projection('size', 'Number of elements', int),
      ...(items
        ? [
            projection('sum', 'Sum of elements', shape.item),
            projection('min', 'Smallest element', shape.item),
            projection('max', 'Largest element', shape.item),
          ]
        : []),
    ];
  }
  if (shape.kind === 'set' || shape.kind === 'map') return [projection('size', 'Number of entries', int)];
  if (shape.kind === 'string') return [projection('size', 'Number of characters', int)];
  return [];
}

function orderable(shape: Shape): boolean {
  return ['int', 'float', 'string', 'char', 'bool'].includes(shape.kind);
}

function predicatesFor(shape: Shape): Candidate[] {
  const changed = predicate('changed', 'Changed at this seq');
  const equality = [predicate('==', 'Equals', shape), predicate('!=', 'Does not equal', shape)];
  const order = [
    predicate('<', 'Less than', shape),
    predicate('<=', 'Less than or equal', shape),
    predicate('>', 'Greater than', shape),
    predicate('>=', 'Greater than or equal', shape),
  ];
  if (shape.kind === 'int' || shape.kind === 'float') return [...order, ...equality, changed];
  if (shape.kind === 'bool')
    return [
      predicate('is true', 'Value is true'),
      predicate('is false', 'Value is false'),
      ...equality,
      changed,
    ];
  if (shape.kind === 'null') return [predicate('is null', 'Value is null'), changed];
  if (shape.kind === 'string')
    return [
      predicate('contains', 'Contains text', shape),
      predicate('startsWith', 'Starts with text', shape),
      predicate('endsWith', 'Ends with text', shape),
      ...equality,
      changed,
    ];
  if (shape.kind === 'char') return [...equality, changed];
  if (shape.kind === 'array')
    return [
      predicate('contains', 'Contains an element', shape.item),
      ...(orderable(shape.item)
        ? order.map((item) => ({ ...item, detail: `Lexicographically ${item.detail.toLowerCase()}` }))
        : []),
      ...equality,
      changed,
    ];
  if (shape.kind === 'set')
    return [
      predicate('contains', 'Contains a member', shape.item),
      predicate('subsetOf', 'Proper subset of', shape),
      predicate('supersetOf', 'Proper superset of', shape),
      ...equality,
      changed,
    ];
  if (shape.kind === 'map') return [predicate('hasKey', 'Contains a key', shape.key), ...equality, changed];
  return [...equality, changed];
}

function literalSamples(shape: Shape, fields: readonly SearchField[]): Candidate[] {
  const recorded = fields
    .filter((field) => field.sample && sameShape(shape, field.shape))
    .map((field) => valueText(field.sample!));
  const suggested =
    shape.kind === 'int'
      ? ['0', '1', '10', '20']
      : shape.kind === 'float'
        ? ['0.0', '1.0']
        : shape.kind === 'bool'
          ? ['true', 'false']
          : shape.kind === 'string'
            ? ['"text"']
            : shape.kind === 'char'
              ? ["'a'"]
              : shape.kind === 'array' && shape.item.kind === 'int'
                ? ['[1, 2, 3]']
                : shape.kind === 'set' && shape.item.kind === 'int'
                  ? ['{1, 2, 3}']
                  : [];
  return [...new Set([...recorded, ...suggested])]
    .filter((source) => parseLiteral(shape, source))
    .slice(0, 6)
    .map((source) => ({
      kind: 'literal',
      key: source,
      label: source,
      detail: 'Use this value',
      type: shape,
    }));
}

export function candidatesFor(fields: readonly SearchField[], query: Query, draft: string): Candidate[] {
  const stage = stageOf(query);
  const clause = query.clauses.at(-1);
  let candidates: Candidate[];
  if (stage === 'field')
    candidates = fields.map((field) => ({
      kind: 'field',
      key: field.name,
      label: field.name,
      detail: `${shapeLabel(field.shape)} value`,
      type: field.shape,
    }));
  else if (stage === 'operation' && clause)
    candidates = [
      ...projectionsFor(clause.field.shape),
      ...predicatesFor(clause.field.shape),
      ...(clause.field.nullable && clause.field.shape.kind !== 'null'
        ? [predicate('is null', 'Value is null')]
        : []),
    ];
  else if (stage === 'predicate' && clause) candidates = predicatesFor(projectedShape(clause));
  else if (stage === 'operand' && clause) {
    const expected = operandShape(clause);
    candidates = [
      ...fields
        .filter((field) => sameShape(expected, field.shape))
        .map((field) => ({
          kind: 'reference' as const,
          key: `@${field.name}`,
          label: `@${field.name}`,
          detail: `Recorded value · ${shapeLabel(field.shape)}`,
          type: field.shape,
        })),
      ...literalSamples(expected, fields),
    ];
  } else
    candidates = [
      { kind: 'connector', key: 'and', label: 'AND', detail: 'Both conditions match' },
      { kind: 'connector', key: 'or', label: 'OR', detail: 'Either condition matches' },
    ];
  const needle = normalize(draft.trim());
  return needle
    ? candidates.filter(
        (item) => normalize(item.key).includes(needle) || normalize(item.label).includes(needle),
      )
    : candidates;
}

export function chooseCandidate(fields: readonly SearchField[], query: Query, candidate: Candidate): Query {
  const clauses = query.clauses.map((clause) => ({ ...clause }));
  const connectors = [...query.connectors];
  const clause = clauses.at(-1);
  if (candidate.kind === 'field') {
    const field = fields.find((item) => item.name === candidate.key);
    if (field) clauses.push({ field });
  } else if (candidate.kind === 'connector') connectors.push(candidate.key as 'and' | 'or');
  else if (clause && candidate.kind === 'projection') clause.projection = candidate.key as Projection;
  else if (clause && candidate.kind === 'predicate') clause.predicate = candidate.key as Predicate;
  else if (clause && candidate.kind === 'reference')
    clause.operand = { kind: 'field', name: candidate.key.slice(1) };
  else if (clause && candidate.kind === 'literal') {
    const value = parseLiteral(operandShape(clause), candidate.key);
    if (value) clause.operand = { kind: 'literal', source: candidate.key, value };
  }
  return { clauses, connectors };
}

export function commitText(fields: readonly SearchField[], query: Query, raw: string): Query | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  if (stageOf(query) === 'operand') {
    const clause = query.clauses.at(-1)!;
    const candidate = candidatesFor(fields, query, '').find(
      (item) => item.kind === 'reference' && item.key === text,
    );
    if (candidate) return chooseCandidate(fields, query, candidate);
    const value = parseLiteral(operandShape(clause), text);
    if (!value) return undefined;
    return {
      clauses: [
        ...query.clauses.slice(0, -1),
        { ...clause, operand: { kind: 'literal', source: text, value } },
      ],
      connectors: [...query.connectors],
    };
  }
  const options = candidatesFor(fields, query, '');
  const exact =
    options.find((item) => item.key === text || item.label === text) ??
    options.find(
      (item) => normalize(item.key) === normalize(text) || normalize(item.label) === normalize(text),
    );
  return exact ? chooseCandidate(fields, query, exact) : undefined;
}

export function removeLast(query: Query): Query {
  const clauses = query.clauses.map((clause) => ({ ...clause }));
  const connectors = [...query.connectors];
  if (connectors.length === clauses.length && clauses.length) connectors.pop();
  else {
    const clause: Clause | undefined = clauses.at(-1);
    if (clause?.operand) delete clause.operand;
    else if (clause?.predicate) delete clause.predicate;
    else if (clause?.projection) delete clause.projection;
    else {
      clauses.pop();
      connectors.pop();
    }
  }
  return { clauses, connectors };
}
