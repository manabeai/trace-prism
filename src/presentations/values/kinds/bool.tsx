import { IconCircleCheck } from '@tabler/icons-solidjs';
import { defineValuePresentation } from '../contract';
import { textFormat } from '../shared';

export const boolPresentation = defineValuePresentation<'bool'>({
  kind: 'bool',
  formats: [
    {
      id: 'badge',
      label: 'Badge',
      icon: IconCircleCheck,
      render: (value) => (
        <span class="dg-bool" classList={{ 'is-true': value.v, 'is-false': !value.v }}>
          {String(value.v)}
        </span>
      ),
    },
  ],
  fallback: textFormat(),
});
