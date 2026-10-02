import { Icon123 } from '@tabler/icons-solidjs';
import { valueText } from '../../../trace/value';
import { defineValuePresentation } from '../contract';
import { textFormat } from '../shared';

export const floatPresentation = defineValuePresentation<'float'>({
  kind: 'float',
  formats: [
    {
      id: 'number',
      label: 'Number',
      icon: Icon123,
      render: (value) => (
        <code class="lv-plain-value" title={valueText(value)}>
          {valueText(value)}
        </code>
      ),
    },
  ],
  fallback: textFormat(),
});
