import { createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Popover } from '@kobalte/core/popover';
import { IconCheck, IconChevronDown } from '@tabler/icons-solidjs';
import { formatIcon, type FormatOption } from '../../presentations/values/registry';
import styles from './FormatMenu.module.css';

export function FormatMenu(props: {
  name: string;
  options: FormatOption[];
  format: string;
  select: (format: string) => void;
}) {
  const [open, setOpen] = createSignal(false);
  return (
    <Popover open={open()} onOpenChange={setOpen}>
      <Popover.Trigger
        class={styles.trigger}
        aria-label={`Change ${props.name} display format`}
        title={`${props.name}: ${props.options.find((item) => item.id === props.format)?.label}`}
      >
        <Dynamic component={formatIcon(props.format)} size="17" stroke="1.8" />
        <IconChevronDown size="12" stroke="1.8" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class={styles.popover}>
          <Popover.Title>Display {props.name}</Popover.Title>
          <div class={styles.options}>
            <For each={props.options}>
              {(option) => (
                <button
                  classList={{ [styles.active]: props.format === option.id }}
                  onClick={() => {
                    props.select(option.id);
                    setOpen(false);
                  }}
                >
                  <Dynamic component={option.icon} size="19" stroke="1.7" />
                  <span>{option.label}</span>
                  <Show when={props.format === option.id}>
                    <IconCheck size="15" stroke="2" />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}
