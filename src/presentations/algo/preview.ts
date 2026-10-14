import type { Frame } from '../../trace/types';
import { seqId } from '../../trace/ids';
import { templates, type AlgoView, type Template } from './registry';

export function previewFor(template: Template): { frame: Frame; view: AlgoView } {
  const definition = templates[template];
  return {
    frame: {
      seq: seqId('0'),
      span: [],
      source: '',
      changed: [],
      deltas: {},
      values: Object.fromEntries(
        Object.entries(definition.preview).map(([name, value]) => [name, { name, value }]),
      ),
    },
    view: {
      id: 0,
      template,
      bindings: Object.fromEntries(definition.roles.map((role) => [role.name, role.name])),
      enabled: true,
    },
  };
}
