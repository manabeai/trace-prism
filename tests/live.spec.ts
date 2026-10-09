import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { mockRuns } from './support/mock-tauri';

const records = readFileSync(new URL('../protocol/v2/example.ndjson', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const startedAt = '2026-09-30T09:00:00.000Z';
const runs = [
  {
    id: 'with-from',
    source: 'binary.rs',
    input: 'sample.in',
    startedAt,
    durationMs: 8,
    status: 'completed',
    frames: records.map((record) => ({ ...record, runId: 'with-from' })),
  },
  {
    id: 'without-from',
    source: 'hierarchy.rs',
    input: 'sample.in',
    startedAt,
    durationMs: 8,
    status: 'completed',
    frames: records.map(({ from: _from, ...record }) => ({ ...record, runId: 'without-from' })),
  },
];

test('v2 trace materializes in the live workspace and remains explorable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockRuns(page, runs);
  await page.goto('/');

  const history = page.locator('.dg-run-list');
  await expect(history).not.toContainText(/Run|Select to load|with-from|without-from|completed/);
  await expect(history.locator('time').first()).toHaveText('18:00:00');
  await expect(history.locator('.dg-run-completed')).toHaveCount(2);

  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  await expect(page.locator('.dg-frame-row.is-selected .dg-value-cell').nth(1)).toContainText('2');
  await expect(page.locator('.dg-frame-row.is-selected .dg-value-cell').nth(3)).toContainText('3');
  await page.getByRole('button', { name: 'Change a display format' }).click();
  await page.getByRole('button', { name: 'Bars' }).click();
  await expect(page.locator('.dg-table-scroll .dg-bars')).toHaveCount(4);

  await expect(page.getByRole('heading', { name: 'Algo Views' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add View' }).click();
  await expect(page.locator('.dg-stage-choose .dg-template-preview .dg-binary-view')).toBeVisible();
  await page.locator('.dg-template-list button').filter({ hasText: 'Grid & position' }).hover();
  await expect(page.locator('.dg-stage-choose .dg-template-preview .dg-mini-grid')).toBeVisible();
  await page.locator('.dg-template-list button').filter({ hasText: 'Range & marker' }).click();
  await expect(page.locator('.dg-binding-current')).toContainText(['left', 'right', 'mid', 'ok']);
  await page.getByRole('dialog').getByRole('button', { name: 'Add view' }).click();
  await expect(page.locator('.dg-algo-cell')).toHaveCount(4);

  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Transition graph');
  await expect(page.locator('.dg-graph-node')).toHaveCount(4);
  await page.getByRole('button', { name: 'Show ID hierarchy' }).click();
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Span hierarchy');
  await expect(page.locator('.dg-graph-node')).toHaveCount(4);
  await page.getByRole('button', { name: 'Show from links' }).click();
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Transition graph');
  await page.locator('.dg-run-list button[data-run-id="without-from"]').click();
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Span hierarchy');
  await expect(page.locator('.dg-graph-node')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Show from links' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('record position keeps the playback slider stable across span lengths', async ({ page }) => {
  const run = {
    ...runs[0],
    id: 'long-span',
    frames: records.map((record, index) => ({
      ...record,
      runId: 'long-span',
      span: index === 3 ? [{ t: 'int', v: '1000000000' }] : record.span,
    })),
  };
  await mockRuns(page, [run]);
  await page.goto('/');

  await page.getByRole('button', { name: 'Select record 0' }).click();
  const label = page.locator('.dg-playback-position');
  const slider = page.locator('.dg-playback-slider');
  const beforeLabel = await label.boundingBox();
  const beforeSlider = await slider.boundingBox();

  await page.getByRole('button', { name: 'Select record 3' }).click();
  await expect(label).toContainText('[1000000000]');
  const afterLabel = await label.boundingBox();
  const afterSlider = await slider.boundingBox();

  expect(afterLabel?.width).toBe(beforeLabel?.width);
  expect(afterSlider?.width).toBe(beforeSlider?.width);
});

test('integer columns offer binary display with bit-level differences', async ({ page }) => {
  await mockRuns(page, [runs[0]]);
  await page.goto('/');

  await page.getByRole('button', { name: 'Change left display format' }).click();
  await page.getByRole('button', { name: 'Binary' }).click();

  const changed = page.locator('.dg-frame-row').nth(2).locator('.dg-value-cell').nth(1);
  await expect(changed.locator('.lv-binary-value')).toContainText('10');
  await expect(changed.locator('.lv-binary-bit.is-changed')).toHaveAttribute('data-bit-position', '1');
  await expect(
    page
      .locator('.dg-frame-row')
      .nth(3)
      .locator('.dg-value-cell')
      .nth(1)
      .locator('.lv-binary-bit.is-changed'),
  ).toHaveCount(0);
});

test('long binary values initially show the least significant changed bits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockRuns(page, [
    {
      ...runs[0],
      id: 'wide-binary',
      frames: [
        {
          format: 'viz.trace/v2',
          kind: 'snapshot',
          runId: 'wide-binary',
          seq: '0',
          span: [],
          values: [{ name: 'bits', value: { t: 'int', v: '18446744073709551616' } }],
        },
        {
          format: 'viz.trace/v2',
          kind: 'patch',
          runId: 'wide-binary',
          seq: '1',
          span: [],
          from: '0',
          ops: [{ op: 'put', name: 'bits', value: { t: 'int', v: '18446744073709551617' } }],
        },
      ],
    },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Change bits display format' }).click();
  await page.getByRole('button', { name: 'Binary' }).click();

  const divider = page.getByRole('separator', { name: 'Resize table and graph' });
  const layout = await page.locator('.dg-history-layout').boundingBox();
  const bounds = await divider.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 70);
  await page.mouse.down();
  await page.mouse.move(layout!.x + 220, bounds!.y + 70, { steps: 8 });
  await page.mouse.up();

  const binary = page.locator('.dg-frame-row').nth(1).locator('.lv-binary-value');
  await expect
    .poll(() => binary.evaluate((element) => element.scrollWidth - element.clientWidth))
    .toBeGreaterThan(0);
  const changedBit = binary.locator('.lv-binary-bit.is-changed');
  await expect(changedBit).toHaveAttribute('data-bit-position', '0');
  const viewport = await binary.boundingBox();
  const bit = await changedBit.boundingBox();
  expect(bit!.x).toBeGreaterThanOrEqual(viewport!.x);
  expect(bit!.x + bit!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width);
});

test('view layout and value assignment slide within a stable dialog', async ({ page }) => {
  await mockRuns(page, [runs[0]]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add View' }).click();

  const dialog = page.getByRole('dialog');
  const before = await dialog.boundingBox();
  await dialog.getByRole('button', { name: /Range & marker/ }).click();
  await expect(page.locator('.dg-stage-track')).toHaveClass(/is-binding/);
  await expect(page.locator('.dg-bind-intro h3')).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Back' })).toBeVisible();
  const preview = page.locator('.dg-stage-bind .dg-bind-preview');
  await expect(preview.locator('.dg-binary-view')).toBeVisible();
  for (const role of ['left', 'right', 'mid', 'predicate']) {
    await page.locator(`.dg-binding-row[data-role="${role}"]`).hover();
    await expect(preview).toHaveAttribute('data-active-role', role);
    await expect(preview.locator(`[data-view-role~="${role}"]`).first()).toBeVisible();
  }
  await page.locator('.dg-binding-row[data-role="mid"] button').first().focus();
  await expect(preview).toHaveAttribute('data-active-role', 'mid');
  await expect(preview).toContainText('Moves the marker.');
  const assigned = await dialog.boundingBox();
  expect(assigned?.width).toBe(before?.width);
  expect(assigned?.height).toBe(before?.height);

  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.dg-stage-track')).not.toHaveClass(/is-binding/);
  await expect(dialog.getByRole('button', { name: /Range & marker/ })).toBeFocused();
  const returned = await dialog.boundingBox();
  expect(returned?.width).toBe(before?.width);
  expect(returned?.height).toBe(before?.height);
});

test('fromId relates recorded IDs while the table keeps the record order', async ({ page }) => {
  const id = (v: number) => [{ t: 'int', v: String(v) }];
  const run = {
    ...runs[0],
    id: 'dfs-ids',
    frames: [
      { format: 'viz.trace/v2', kind: 'snapshot', runId: 'dfs-ids', seq: '0', span: id(0), values: [] },
      {
        format: 'viz.trace/v2',
        kind: 'patch',
        runId: 'dfs-ids',
        seq: '1',
        span: id(1),
        fromId: id(0),
        ops: [],
      },
      {
        format: 'viz.trace/v2',
        kind: 'patch',
        runId: 'dfs-ids',
        seq: '2',
        span: id(3),
        fromId: id(1),
        ops: [],
      },
      {
        format: 'viz.trace/v2',
        kind: 'patch',
        runId: 'dfs-ids',
        seq: '3',
        span: id(2),
        fromId: id(0),
        ops: [],
      },
    ],
  };
  await mockRuns(page, [run]);
  await page.goto('/');

  await expect(page.locator('.dg-frame-row th')).toContainText(['0', '1', '2', '3']);
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Transition graph');
  await expect(page.locator('.dg-graph-node text')).toContainText(['0', '1', '3', '2']);
  await expect(page.locator('.dg-graph-edge')).toHaveCount(3);

  await page.getByRole('button', { name: 'Show ID hierarchy' }).click();
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Span hierarchy');
  await expect(page.locator('.dg-graph-node')).toHaveCount(5);
  await page.getByRole('button', { name: 'Select record 1' }).click();
  await expect(page.locator('.dg-graph-node.is-selected')).toHaveAttribute('aria-label', /Record 1/);
  await page.getByRole('button', { name: 'Show from links' }).click();
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Transition graph');
});

test('node-link view binds an adjacency list with optional visited and current vertex', async ({ page }) => {
  const adjacency = {
    t: 'array',
    items: [[1, 2], [2], []].map((row) => ({
      t: 'array',
      items: row.map((v) => ({ t: 'int', v: String(v) })),
    })),
  };
  const run = {
    ...runs[0],
    id: 'graph-input',
    frames: [
      {
        format: 'viz.trace/v2',
        kind: 'snapshot',
        runId: 'graph-input',
        seq: '0',
        span: [],
        values: [
          { name: 'adjacency', value: adjacency },
          { name: 'seen', value: { t: 'array', items: [true, false, false].map((v) => ({ t: 'bool', v })) } },
          { name: 'u', value: { t: 'int', v: '0' } },
        ],
      },
    ],
  };
  await mockRuns(page, [run]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add View' }).click();
  await page.locator('.dg-template-list button').filter({ hasText: 'Node-link graph' }).hover();
  await expect(page.locator('.dg-stage-choose .dg-template-preview svg[role="img"]')).toHaveAttribute(
    'aria-label',
    /4 vertices/,
  );
  await page.locator('.dg-template-list button').filter({ hasText: 'Node-link graph' }).click();
  await expect(page.locator('.dg-binding-current')).toContainText(['adjacency', 'seen', 'u']);
  for (const role of ['adjacency', 'visited', 'v']) {
    await page.locator(`.dg-binding-row[data-role="${role}"]`).hover();
    await expect(page.locator('.dg-stage-bind .dg-bind-preview')).toHaveAttribute('data-active-role', role);
    await expect(
      page.locator(`.dg-stage-bind .dg-bind-preview [data-view-role~="${role}"]`).first(),
    ).toBeVisible();
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Add view' }).click();

  await expect(page.locator('.dg-algo-cell svg[role="img"]')).toHaveAttribute(
    'aria-label',
    'Input graph: 3 vertices, 3 directed edges, current vertex 0',
  );
  await expect(page.locator('.dg-algo-cell svg line')).toHaveCount(3);
  await expect(page.locator('.dg-algo-cell [aria-label="Vertex 0, visited, current"]')).toHaveCount(1);

  await page.locator('.dg-view-list').getByRole('button', { name: 'Edit Node-link graph bindings' }).click();
  await page.locator('.dg-binding-row').nth(1).getByRole('button', { name: 'None' }).click();
  await page.locator('.dg-binding-row').nth(2).getByRole('button', { name: 'None' }).click();
  await page.getByRole('button', { name: 'Save bindings' }).click();
  await expect(page.locator('.dg-algo-cell svg[role="img"]')).toHaveAttribute(
    'aria-label',
    'Input graph: 3 vertices, 3 directed edges',
  );
  await expect(page.locator('.dg-algo-cell [aria-label="Vertex 0"]')).toHaveCount(1);
});

test('table and graph stay side by side and share record focus', async ({ page }) => {
  await mockRuns(page, [runs[0]]);
  await page.goto('/');

  const table = page.locator('.dg-table-scroll');
  const graph = page.locator('.dg-graph-scroll');
  const tableBounds = await table.boundingBox();
  const graphBounds = await graph.boundingBox();
  const graphPanelBounds = await page.locator('.dg-history-graph-panel').boundingBox();
  expect(tableBounds).not.toBeNull();
  expect(graphBounds).not.toBeNull();
  expect(graphBounds!.x).toBeGreaterThan(tableBounds!.x + tableBounds!.width);
  expect(Math.abs(graphPanelBounds!.y - tableBounds!.y)).toBeLessThan(2);
  await expect(page.locator('.dg-run-list')).not.toContainText('binary.rs');
  await expect(page.getByRole('heading', { name: 'Value history' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'source / from' })).toHaveCount(0);
  await expect(page.locator('.dg-frame-row').first()).not.toContainText('main.rs');
  await expect(page.locator('.dg-record-inspector')).toHaveCount(0);
  await expect(page.locator('.dg-playback')).not.toContainText('main.rs');
  expect((await page.locator('.dg-graph-scroll svg').boundingBox())!.width).toBeLessThan(500);

  const initialScroll = await graph.evaluate((element) => element.scrollLeft);
  await page.getByRole('button', { name: 'Select record 0' }).click();
  await expect(page.locator('.dg-graph-node.is-selected')).toHaveAttribute('aria-label', /Record 0,/);
  await expect.poll(() => graph.evaluate((element) => element.scrollLeft)).toBeLessThan(initialScroll);
  const firstScroll = await graph.evaluate((element) => element.scrollLeft);

  await page.getByRole('button', { name: 'Select record 3' }).click();
  await expect(page.locator('.dg-graph-node.is-selected')).toHaveAttribute('aria-label', /Record 3,/);
  await expect.poll(() => graph.evaluate((element) => element.scrollLeft)).toBeGreaterThan(firstScroll);
  await expect
    .poll(async () => {
      const selectedBounds = await page.locator('.dg-graph-node.is-selected').boundingBox();
      const viewportBounds = await graph.boundingBox();
      return (
        selectedBounds!.x > viewportBounds!.x &&
        selectedBounds!.x + selectedBounds!.width < viewportBounds!.x + viewportBounds!.width
      );
    })
    .toBe(true);

  await page.locator('.dg-graph-node[aria-label^="Record 1,"]').click();
  await expect(page.locator('.dg-frame-row.is-selected th')).toContainText('1');
  await expect(page.locator('.dg-playback strong')).toHaveText('seq 1');
});

test('history divider can collapse and restore either pane', async ({ page }) => {
  await mockRuns(page, [runs[0]]);
  await page.goto('/');
  const tablePanel = page.locator('.dg-history-table-panel');
  const graphPanel = page.locator('.dg-history-graph-panel');
  const divider = page.getByRole('separator', { name: 'Resize table and graph' });
  const width = (locator: typeof tablePanel) =>
    locator.evaluate((element) => element.getBoundingClientRect().width);
  const dragDivider = async (targetX: number) => {
    const bounds = await divider.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 70);
    await page.mouse.down();
    await page.mouse.move(targetX, bounds!.y + 70, { steps: 8 });
    await page.mouse.up();
  };

  expect((await width(tablePanel)) / (await width(graphPanel))).toBeCloseTo(2, 0);
  await expect(page.locator('.dg-history-handle-mark')).toBeVisible();
  await expect(page.getByRole('button', { name: /Expand (table|graph)/ })).toHaveCount(0);
  await expect(divider).toHaveAttribute('aria-valuemin', '0');
  await expect(divider).toHaveAttribute('aria-valuemax', '1');

  const layout = await page.locator('.dg-history-layout').boundingBox();
  await dragDivider(layout!.x + 1);
  await expect.poll(() => width(tablePanel)).toBeLessThan(2);
  await expect(page.locator('.dg-history-handle-mark')).toBeVisible();

  await dragDivider(layout!.x + layout!.width / 2);
  await expect.poll(() => width(tablePanel)).toBeGreaterThan(200);

  await dragDivider(layout!.x + layout!.width - 1);
  await expect.poll(() => width(graphPanel)).toBeLessThan(2);
  await expect(page.locator('.dg-history-handle-mark')).toBeVisible();

  await dragDivider(layout!.x + layout!.width / 2);
  await expect.poll(() => width(graphPanel)).toBeGreaterThan(200);

  await divider.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => width(tablePanel)).toBeLessThan(2);
  await page.keyboard.press('End');
  await expect.poll(() => width(graphPanel)).toBeLessThan(2);
});

test('history columns compress before the table needs horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockRuns(page, [runs[0]]);
  await page.goto('/');

  const scroll = page.locator('.dg-table-scroll');
  const divider = page.getByRole('separator', { name: 'Resize table and graph' });
  const layout = await page.locator('.dg-history-layout').boundingBox();
  const resizeTable = async (width: number) => {
    const bounds = await divider.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 70);
    await page.mouse.down();
    await page.mouse.move(layout!.x + width, bounds!.y + 70, { steps: 8 });
    await page.mouse.up();
  };
  const overflow = () => scroll.evaluate((element) => element.scrollWidth - element.clientWidth);

  await resizeTable(620);
  await expect.poll(overflow).toBeLessThanOrEqual(2);
  await expect(page.getByRole('columnheader')).toHaveCount(6);

  await page.getByRole('button', { name: 'Add View' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Range & marker/ })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add view' }).click();
  await resizeTable(660);
  await expect.poll(overflow).toBeLessThanOrEqual(2);
  await expect(page.getByRole('columnheader')).toHaveCount(7);

  await resizeTable(350);
  await expect.poll(overflow).toBeGreaterThan(0);
  await expect(page.locator('.dg-history-table')).toHaveCSS('table-layout', 'fixed');
});

test('history panes stack with usable graph space on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 620, height: 950 });
  await mockRuns(page, [runs[0]]);
  await page.goto('/');
  const layout = page.locator('.dg-history-layout');
  await expect(layout).toHaveAttribute('data-orientation', 'vertical');
  const table = await page.locator('.dg-history-table-panel').boundingBox();
  const graph = await page.locator('.dg-history-graph-panel').boundingBox();
  expect(graph!.y).toBeGreaterThan(table!.y + table!.height);
  expect(graph!.height).toBeGreaterThan(350);
  await expect(page.locator('.dg-graph-node.is-selected')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(620);

  const divider = page.getByRole('separator', { name: 'Resize table and graph' });
  await divider.scrollIntoViewIfNeeded();
  const dragDivider = async (targetY: number) => {
    const bounds = await divider.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width / 2, targetY, { steps: 8 });
    await page.mouse.up();
  };
  const layoutBounds = await layout.boundingBox();
  const tableHeight = () =>
    page.locator('.dg-history-table-panel').evaluate((element) => element.getBoundingClientRect().height);
  await dragDivider(layoutBounds!.y + 1);
  await expect.poll(tableHeight).toBeLessThan(2);
  await dragDivider(layoutBounds!.y + layoutBounds!.height / 2);
  await expect.poll(tableHeight).toBeGreaterThan(200);
});

test('the seq slider keeps the selected table row in view', async ({ page }) => {
  const longRun = {
    ...runs[0],
    id: 'long-run',
    frames: Array.from({ length: 48 }, (_, index) => ({
      format: 'viz.trace/v2',
      kind: 'snapshot',
      runId: 'long-run',
      seq: String(index),
      span: [],
      values: [{ name: 'n', value: { t: 'int', v: String(index) } }],
    })),
  };
  await mockRuns(page, [longRun]);
  await page.goto('/');
  const table = page.locator('.dg-table-scroll');
  const slider = page.getByRole('slider', { name: 'Record position' });
  const selectPosition = (position: number) =>
    slider.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, position);
  const rowIsVisible = () =>
    table.evaluate((element) => {
      const row = element.querySelector('.dg-frame-row.is-selected');
      if (!row) return false;
      const viewport = element.getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      return bounds.top >= viewport.top + 45 && bounds.bottom <= viewport.bottom;
    });

  await selectPosition(3);
  await expect(page.locator('.dg-playback strong')).toHaveText('seq 3');
  await expect.poll(rowIsVisible).toBe(true);
  const firstScroll = await table.evaluate((element) => element.scrollTop);

  await selectPosition(42);
  await expect(page.locator('.dg-playback strong')).toHaveText('seq 42');
  await expect.poll(rowIsVisible).toBe(true);
  expect(await table.evaluate((element) => element.scrollTop)).toBeGreaterThan(firstScroll);

  await page.getByRole('button', { name: 'Latest' }).click();
  await expect(page.locator('.dg-playback strong')).toHaveText('seq 47');
  await expect.poll(rowIsVisible).toBe(true);

  const sliderBounds = await slider.boundingBox();
  const y = sliderBounds!.y + sliderBounds!.height / 2;
  await page.mouse.move(sliderBounds!.x + sliderBounds!.width * 0.1, y);
  await page.mouse.down();
  for (const position of [0.35, 0.65, 0.9]) {
    await page.mouse.move(sliderBounds!.x + sliderBounds!.width * position, y, { steps: 4 });
    await expect.poll(rowIsVisible).toBe(true);
  }
  await page.mouse.up();
});

test('format popover stays open across run polling while moving into its options', async ({ page }) => {
  await mockRuns(page, [runs[0]]);
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Change a display format' });
  await trigger.click();
  const popover = page.getByRole('dialog', { name: 'Display a' });
  await expect(popover).toBeVisible();

  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as Window & { __traceprismListRunsCalls: number }).__traceprismListRunsCalls,
        ),
      {
        timeout: 10_000,
      },
    )
    .toBeGreaterThanOrEqual(3);
  await expect(popover).toBeVisible();
  await popover.getByRole('button', { name: 'Bars' }).hover();
  await expect(popover).toBeVisible();
  await popover.getByRole('button', { name: 'Bars' }).click();
  await expect(page.locator('.dg-table-scroll .dg-bars')).toHaveCount(4);
});

test('grid view binds recorded matrix and position values', async ({ page }) => {
  const integer = (value: number) => ({ t: 'int', v: String(value) });
  const array = (items: unknown[]) => ({ t: 'array', items });
  const board = array([array([integer(0), integer(1)]), array([integer(0), integer(0)])]);
  const gridRun = {
    id: 'grid',
    source: 'maze.rs',
    input: 'sample.in',
    startedAt,
    durationMs: 3,
    status: 'completed',
    frames: [
      {
        format: 'viz.trace/v2',
        kind: 'snapshot',
        runId: 'grid',
        seq: '0',
        span: [],
        values: [
          { name: 'board', value: board },
          { name: 'pos', value: array([integer(0), integer(0)]) },
        ],
      },
      {
        format: 'viz.trace/v2',
        kind: 'patch',
        runId: 'grid',
        seq: '1',
        span: [integer(0)],
        ops: [{ op: 'put', name: 'pos', value: array([integer(1), integer(0)]) }],
      },
    ],
  };
  await mockRuns(page, [gridRun]);
  await page.goto('/');
  await expect(page.locator('.dg-table-scroll .lv-matrix')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add View' }).click();
  await page.locator('.dg-template-list button').filter({ hasText: 'Grid & position' }).click();
  await expect(page.locator('.dg-binding-current')).toContainText(['board', 'pos']);
  for (const role of ['board', 'position']) {
    await page.locator(`.dg-binding-row[data-role="${role}"]`).hover();
    await expect(page.locator('.dg-stage-bind .dg-bind-preview')).toHaveAttribute('data-active-role', role);
    await expect(
      page.locator(`.dg-stage-bind .dg-bind-preview [data-view-role~="${role}"]`).first(),
    ).toBeVisible();
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Add view' }).click();
  await expect(page.locator('.dg-table-scroll .dg-grid-view')).toHaveCount(2);
  await expect(page.locator('.dg-table-scroll .dg-grid-view .current')).toHaveCount(2);
});

test('selection and display settings are retained separately for each run', async ({ page }) => {
  await mockRuns(page, runs);
  await page.goto('/');
  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  await page.getByRole('button', { name: 'Select record 1' }).click();
  await page.getByRole('button', { name: 'Change a display format' }).click();
  await page.getByRole('button', { name: 'Bars' }).click();
  await page.locator('.dg-run-list button[data-run-id="without-from"]').click();
  await expect(page.locator('.dg-table-scroll .dg-bars')).toHaveCount(0);
  await page.getByRole('button', { name: 'Select record 2' }).click();
  await page.locator('.dg-run-list button[data-run-id="with-from"]').click();
  await expect(page.locator('.dg-frame-row.is-selected')).toContainText('1');
  await expect(page.locator('.dg-table-scroll .dg-bars')).toHaveCount(4);
});

test('nested span groups collapse and expand through the table row model', async ({ page }) => {
  await mockRuns(page, [runs[0]]);
  await page.goto('/');
  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  const outer = page.locator('.dg-group-row button').filter({ hasText: '[0]' }).first();
  await outer.click();
  await expect(outer).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.dg-frame-row')).toHaveCount(2);
  await outer.click();
  await expect(outer).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  await outer.click();
  await page.locator('.dg-graph-node[aria-label^="Record 2,"]').click();
  await expect(outer).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.dg-frame-row.is-selected th')).toContainText('2');
});
