import { createEffect, createMemo, createSignal, For, Show, untrack } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Dialog } from '@kobalte/core/dialog';
import { IconCheck, IconChevronLeft, IconChevronRight, IconCode, IconX } from '@tabler/icons-solidjs';
import {
  CompositeCell,
  defaultTemplate,
  templates,
  templateKeys,
  validBindings,
  type Template,
} from '../../presentations/composite/registry';
import { previewFor } from '../../presentations/composite/preview';
import type { createWorkspaceController } from '../controller';

type ViewEditorModel = Pick<
  ReturnType<typeof createWorkspaceController>,
  | 'dialogOpen'
  | 'setDialogOpen'
  | 'stage'
  | 'setStage'
  | 'template'
  | 'editingId'
  | 'draft'
  | 'setDraft'
  | 'frames'
  | 'candidates'
  | 'chooseTemplate'
  | 'saveView'
>;

function ViewPreview(props: { template: Template; activeRole?: string }) {
  const preview = createMemo(() => previewFor(props.template));
  const hint = () =>
    templates[props.template].roles.find((role) => role.name === props.activeRole)?.previewHint ??
    templates[props.template].description;
  return (
    <div class="dg-template-preview dg-bind-preview" data-active-role={props.activeRole || undefined}>
      <div class="dg-preview-heading">
        <span>Example preview</span>
        <strong>{templates[props.template].name}</strong>
      </div>
      <div class="dg-preview-canvas">
        <CompositeCell view={preview().view} frame={preview().frame} />
      </div>
      <p>{hint()}</p>
    </div>
  );
}

export function ViewDialog(props: { model: ViewEditorModel }) {
  const {
    dialogOpen,
    setDialogOpen,
    stage,
    setStage,
    template,
    editingId,
    draft,
    setDraft,
    frames,
    candidates,
    chooseTemplate,
    saveView,
  } = untrack(() => props.model);
  const [previewTemplate, setPreviewTemplate] = createSignal<Template>(defaultTemplate);
  const [highlightedRole, setHighlightedRole] = createSignal<string | null>(null);
  let choosePanel: HTMLDivElement | undefined;
  let bindHeading: HTMLHeadingElement | undefined;
  createEffect(() => {
    if (dialogOpen()) {
      setPreviewTemplate(defaultTemplate);
      setHighlightedRole(null);
    }
  });
  const selectViewLayout = (next: Template) => {
    setHighlightedRole(null);
    chooseTemplate(next);
    queueMicrotask(() => bindHeading?.focus({ preventScroll: true }));
  };
  const returnToLayouts = () => {
    setHighlightedRole(null);
    setStage('choose');
    queueMicrotask(() =>
      choosePanel
        ?.querySelector<HTMLButtonElement>(`[data-template="${template()}"]`)
        ?.focus({ preventScroll: true }),
    );
  };
  return (
    <Dialog open={dialogOpen()} onOpenChange={setDialogOpen}>
      <Dialog.Portal>
        <Dialog.Overlay class="dg-dialog-overlay" />
        <div class="dg-dialog-positioner">
          <Dialog.Content class="dg-dialog dg-dialog-picker workspace-theme">
            <div class="dg-dialog-header">
              <Dialog.Title>
                {editingId() !== null ? `Edit ${templates[template()].name}` : 'Add View'}
              </Dialog.Title>
              <Dialog.CloseButton aria-label="Close dialog">
                <IconX size="18" />
              </Dialog.CloseButton>
            </div>
            <Dialog.Description>
              {editingId() !== null
                ? templates[template()].description
                : 'Combine recorded values into a view. Choose a layout, then assign its inputs.'}
            </Dialog.Description>
            <div class="dg-stage-viewport">
              <div class="dg-stage-track" classList={{ 'is-binding': stage() === 'bind' }}>
                <div
                  ref={choosePanel}
                  class="dg-stage dg-stage-choose"
                  aria-hidden={stage() !== 'choose'}
                  inert={stage() !== 'choose'}
                >
                  <div class="dg-view-picker">
                    <div class="dg-template-list" aria-label="View layouts">
                      <For each={templateKeys}>
                        {(key) => {
                          const definition = templates[key];
                          return (
                            <button
                              data-template={key}
                              classList={{ active: previewTemplate() === key }}
                              onMouseEnter={() => setPreviewTemplate(key)}
                              onFocus={() => setPreviewTemplate(key)}
                              onClick={() => selectViewLayout(key)}
                            >
                              <Dynamic component={definition.icon} size="21" stroke="1.7" />
                              <span>
                                <strong>{definition.name}</strong>
                                <small>{definition.summary}</small>
                              </span>
                              <IconChevronRight size="15" stroke="1.8" />
                            </button>
                          );
                        }}
                      </For>
                    </div>
                    <ViewPreview template={previewTemplate()} />
                  </div>
                </div>
                <div
                  class="dg-stage dg-stage-bind"
                  aria-hidden={stage() !== 'bind'}
                  inert={stage() !== 'bind'}
                >
                  <div class="dg-bind-layout">
                    <div class="dg-bind-fields">
                      <div class="dg-bind-intro">
                        <h3 ref={bindHeading} tabIndex={-1}>
                          {templates[template()].name}
                        </h3>
                        <p>{templates[template()].description}</p>
                      </div>
                      <div class="dg-binding-list">
                        <For each={templates[template()].roles}>
                          {(role) => (
                            <div
                              class="dg-binding-row"
                              data-role={role.name}
                              onMouseEnter={() => setHighlightedRole(role.name)}
                              onMouseLeave={() => setHighlightedRole(null)}
                              onFocusIn={() => setHighlightedRole(role.name)}
                              onFocusOut={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget as Node))
                                  setHighlightedRole(null);
                              }}
                            >
                              <div class="dg-binding-heading">
                                <strong>{role.name}</strong>
                                <small>
                                  {role.shape}
                                  {role.optional ? ' · optional' : ''}
                                </small>
                              </div>
                              <div class="dg-binding-current">
                                <IconCode size="15" />
                                <code>{draft()[role.name] || 'Not assigned'}</code>
                              </div>
                              <div class="dg-binding-choices">
                                <Show when={role.optional}>
                                  <button
                                    classList={{ active: !draft()[role.name] }}
                                    onClick={() => setDraft((current) => ({ ...current, [role.name]: '' }))}
                                  >
                                    None
                                    <Show when={!draft()[role.name]}>
                                      <IconCheck size="14" />
                                    </Show>
                                  </button>
                                </Show>
                                <For
                                  each={candidates(role)}
                                  fallback={
                                    role.optional ? null : (
                                      <span class="lv-no-candidates">No compatible value</span>
                                    )
                                  }
                                >
                                  {(name) => (
                                    <button
                                      classList={{ active: draft()[role.name] === name }}
                                      onClick={() =>
                                        setDraft((current) => ({ ...current, [role.name]: name }))
                                      }
                                    >
                                      <code>{name}</code>
                                      <Show when={draft()[role.name] === name}>
                                        <IconCheck size="14" />
                                      </Show>
                                    </button>
                                  )}
                                </For>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                    <ViewPreview template={template()} activeRole={highlightedRole() ?? undefined} />
                  </div>
                  <div class="dg-dialog-actions">
                    <Show when={editingId() === null}>
                      <button class="dg-back-action" onClick={returnToLayouts}>
                        <IconChevronLeft size="16" />
                        Back
                      </button>
                    </Show>
                    <button
                      class="dg-primary-action"
                      disabled={!validBindings(templates[template()], draft(), frames())}
                      onClick={saveView}
                    >
                      <IconCheck size="16" />
                      {editingId() === null ? 'Add view' : 'Save bindings'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
