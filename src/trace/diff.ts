import type { Frame, Scalar, Value } from './types';

export type ValuePathSegment =
  | { kind: 'index'; index: number }
  | { kind: 'member'; value: Value }
  | { kind: 'key'; key: Scalar }
  | { kind: 'field'; name: string };
export type ValuePath = readonly ValuePathSegment[];
export type ValueChange =
  | { kind: 'added'; path: ValuePath; after: Value }
  | { kind: 'removed'; path: ValuePath; before: Value }
  | { kind: 'updated'; path: ValuePath; before: Value; after: Value };

function scalarIdentity(value: Scalar): string {
  switch (value.t) {
    case 'int':
      return JSON.stringify(['int', BigInt(value.v).toString()]);
    case 'float': {
      const number = Number(value.v);
      return JSON.stringify(['float', Object.is(number, -0) ? 0 : number]);
    }
    default:
      return JSON.stringify([value.t, value.v]);
  }
}

function valueIdentity(value: Value): string {
  switch (value.t) {
    case 'null':
      return '["null"]';
    case 'bool':
    case 'int':
    case 'float':
    case 'string':
      return scalarIdentity(value);
    case 'array':
      return JSON.stringify(['array', value.items.map(valueIdentity)]);
    case 'set':
      return JSON.stringify(['set', value.items.map(valueIdentity).sort()]);
    case 'map':
      return JSON.stringify([
        'map',
        value.entries
          .map(({ key, value: entryValue }) => [scalarIdentity(key), valueIdentity(entryValue)])
          .sort(([left], [right]) => left.localeCompare(right)),
      ]);
    case 'record':
      return JSON.stringify([
        'record',
        value.fields
          .map(({ name, value: fieldValue }) => [name, valueIdentity(fieldValue)])
          .sort(([left], [right]) => left.localeCompare(right)),
      ]);
  }
}

export function diffValues(
  before: Value | undefined,
  after: Value | undefined,
  path: ValuePath = [],
): ValueChange[] {
  if (before === undefined) {
    return after === undefined ? [] : [{ kind: 'added', path, after }];
  }
  if (after === undefined) return [{ kind: 'removed', path, before }];
  if (before.t !== after.t) return [{ kind: 'updated', path, before, after }];

  if (before.t === 'array' && after.t === 'array') {
    const changes: ValueChange[] = [];
    for (let index = 0; index < Math.max(before.items.length, after.items.length); index++) {
      changes.push(
        ...diffValues(before.items[index], after.items[index], [...path, { kind: 'index', index }]),
      );
    }
    return changes;
  }
  if (before.t === 'set' && after.t === 'set') {
    const oldMembers = new Map(before.items.map((value) => [valueIdentity(value), value]));
    const newMembers = new Map(after.items.map((value) => [valueIdentity(value), value]));
    const changes: ValueChange[] = [];
    for (const [identity, value] of oldMembers) {
      if (!newMembers.has(identity))
        changes.push({ kind: 'removed', path: [...path, { kind: 'member', value }], before: value });
    }
    for (const [identity, value] of newMembers) {
      if (!oldMembers.has(identity))
        changes.push({ kind: 'added', path: [...path, { kind: 'member', value }], after: value });
    }
    return changes;
  }
  if (before.t === 'map' && after.t === 'map') {
    const oldEntries = new Map(before.entries.map((entry) => [scalarIdentity(entry.key), entry]));
    const newEntries = new Map(after.entries.map((entry) => [scalarIdentity(entry.key), entry]));
    const changes: ValueChange[] = [];
    for (const [identity, entry] of oldEntries) {
      const next = newEntries.get(identity);
      const entryPath: ValuePath = [...path, { kind: 'key', key: entry.key }];
      changes.push(...diffValues(entry.value, next?.value, entryPath));
    }
    for (const [identity, entry] of newEntries) {
      if (!oldEntries.has(identity))
        changes.push(...diffValues(undefined, entry.value, [...path, { kind: 'key', key: entry.key }]));
    }
    return changes;
  }
  if (before.t === 'record' && after.t === 'record') {
    const oldFields = new Map(before.fields.map((field) => [field.name, field.value]));
    const newFields = new Map(after.fields.map((field) => [field.name, field.value]));
    const changes: ValueChange[] = [];
    for (const [name, value] of oldFields) {
      changes.push(...diffValues(value, newFields.get(name), [...path, { kind: 'field', name }]));
    }
    for (const [name, value] of newFields) {
      if (!oldFields.has(name))
        changes.push(...diffValues(undefined, value, [...path, { kind: 'field', name }]));
    }
    return changes;
  }
  return valueIdentity(before) === valueIdentity(after) ? [] : [{ kind: 'updated', path, before, after }];
}

function sameSegment(left: ValuePathSegment, right: ValuePathSegment): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case 'index':
      return right.kind === 'index' && left.index === right.index;
    case 'member':
      return right.kind === 'member' && valueIdentity(left.value) === valueIdentity(right.value);
    case 'key':
      return right.kind === 'key' && scalarIdentity(left.key) === scalarIdentity(right.key);
    case 'field':
      return right.kind === 'field' && left.name === right.name;
  }
}

export function changesAffectPath(changes: readonly ValueChange[], path: ValuePath): boolean {
  return changes.some((change) =>
    change.path
      .slice(0, Math.min(change.path.length, path.length))
      .every((segment, index) => sameSegment(segment, path[index])),
  );
}

export function matchesAffectPath(matches: readonly ValuePath[], path: ValuePath): boolean {
  return matches.some((match) =>
    match
      .slice(0, Math.min(match.length, path.length))
      .every((segment, index) => sameSegment(segment, path[index])),
  );
}

export function framesWithChangeAt(
  frames: readonly Frame[],
  fieldName: string,
  path: ValuePath = [],
): Frame[] {
  return frames.filter((frame) => changesAffectPath(frame.deltas[fieldName] ?? [], path));
}
