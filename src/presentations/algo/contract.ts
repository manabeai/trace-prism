import type { Component } from 'solid-js';
import type { Frame, Value } from '../../trace/types';
import { isBooleanArray, isIntegerSet, isMatrix, isPosition } from '../value-shapes';

export const roleAccepts = {
  int: (value: Value) => value.t === 'int',
  bool: (value: Value) => value.t === 'bool',
  visited: (value: Value) => isBooleanArray(value) || isIntegerSet(value),
  matrix: isMatrix,
  position: isPosition,
};

export type Role = {
  name: string;
  shape: string;
  accepts: (value: Value) => boolean;
  previewHint: string;
  optional?: boolean;
  preferredNames?: readonly string[];
};
export type AlgoView<TemplateId extends string = string> = {
  id: number;
  template: TemplateId;
  bindings: Record<string, string>;
  enabled: boolean;
};
export type AlgoViewDefinition = {
  id: string;
  name: string;
  description: string;
  summary: string;
  roles: readonly Role[];
  preview: Readonly<Record<string, Value>>;
  icon: Component<{ size?: string | number; stroke?: string }>;
  component: Component<{ view: AlgoView; frame: Frame; inTable?: boolean }>;
};

export function candidateNames(frames: Frame[], role: Role): string[] {
  const names = new Map<string, boolean>();
  for (const frame of frames) {
    for (const [name, field] of Object.entries(frame.values)) {
      if (!names.has(name)) names.set(name, false);
      if (!names.get(name) && role.accepts(field.value)) names.set(name, true);
    }
  }
  return [...names].flatMap(([name, accepted]) => (accepted ? [name] : []));
}

export function initialBindings(definition: AlgoViewDefinition, frames: Frame[]): Record<string, string> {
  return Object.fromEntries(
    definition.roles.map((role) => {
      const names = candidateNames(frames, role);
      const preferred = [role.name, ...(role.preferredNames ?? [])].find((name) => names.includes(name));
      return [role.name, preferred ?? (role.optional ? '' : (names[0] ?? ''))];
    }),
  );
}

export function validBindings(
  definition: AlgoViewDefinition,
  bindings: Record<string, string>,
  frames: Frame[],
): boolean {
  return definition.roles.every((role) => {
    const name = bindings[role.name];
    return (!name && role.optional) || candidateNames(frames, role).includes(name);
  });
}
