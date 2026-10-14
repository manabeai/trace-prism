import { valueText } from '../trace/value';
import { predicateCandidatesFor } from './predicates';
import { projectionCandidatesFor } from './projections';
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
      ...projectionCandidatesFor(clause.field.shape),
      ...predicateCandidatesFor(clause.field.shape, clause.field.nullable),
    ];
  else if (stage === 'predicate' && clause) candidates = predicateCandidatesFor(projectedShape(clause));
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
