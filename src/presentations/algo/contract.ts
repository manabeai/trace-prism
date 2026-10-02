import type { Component } from 'solid-js';
import type { Frame, Value } from '../../trace/types';
import { isMatrix, isPosition } from '../value-shapes';

export type RoleShape = 'int' | 'bool' | 'matrix' | 'position';
export type Role = { name: string; shape: RoleShape };
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
  icon: Component<{ size?: string | number; stroke?: string }>;
  component: Component<{ view: AlgoView; frame: Frame }>;
};

export function matchesRole(value: Value | undefined, shape: RoleShape): boolean {
  if (!value) return false;
  switch (shape) {
    case 'int':
      return value.t === 'int';
    case 'bool':
      return value.t === 'bool';
    case 'matrix':
      return isMatrix(value);
    case 'position':
      return isPosition(value);
  }
}

export function candidateNames(frames: Frame[], role: Role): string[] {
  const names = new Set(frames.flatMap((frame) => Object.keys(frame.values)));
  return [...names].filter((name) =>
    frames.some((frame) => matchesRole(frame.values[name]?.value, role.shape)),
  );
}

export function validBindings(
  definition: AlgoViewDefinition,
  bindings: Record<string, string>,
  frames: Frame[],
): boolean {
  return definition.roles.every((role) => candidateNames(frames, role).includes(bindings[role.name]));
}
