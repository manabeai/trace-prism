import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

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
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs } }));
  await page.goto('/');

  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  await expect(page.locator('.dg-frame-row.is-selected .dg-value-cell').nth(1)).toContainText('2');
  await expect(page.locator('.dg-frame-row.is-selected .dg-value-cell').nth(3)).toContainText('3');
  await page.getByRole('button', { name: 'Change a display format' }).click();
  await page.getByRole('button', { name: 'Bars' }).click();
  await expect(page.locator('.dg-table-scroll .dg-bars')).toHaveCount(4);

  await page.getByRole('button', { name: 'Add Algo View' }).click();
  await page.locator('.dg-template-grid button').filter({ hasText: 'Binary search' }).click();
  await expect(page.locator('.dg-binding-current')).toContainText(['left', 'right', 'mid', 'ok']);
  await page.getByRole('button', { name: 'Add column' }).click();
  await expect(page.locator('.dg-algo-cell')).toHaveCount(4);

  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Transition graph');
  await expect(page.locator('.dg-graph-node')).toHaveCount(4);
  await page.locator('.dg-run-list button').filter({ hasText: 'without-from' }).click();
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Span hierarchy');
  expect(await page.locator('.dg-graph-node').count()).toBeGreaterThan(4);
  expect(errors).toEqual([]);
});

test('Graph Algo View binds an adjacency list with optional visited and current vertex', async ({ page }) => {
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
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs: [run] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Algo View' }).click();
  await page.locator('.dg-template-grid button').filter({ hasText: 'Graph' }).click();
  await expect(page.locator('.dg-binding-current')).toContainText(['adjacency', 'seen', 'u']);
  await page.getByRole('button', { name: 'Add column' }).click();

  await expect(page.locator('.dg-algo-cell svg[role="img"]')).toHaveAttribute(
    'aria-label',
    'Input graph: 3 vertices, 3 directed edges, current vertex 0',
  );
  await expect(page.locator('.dg-algo-cell svg line')).toHaveCount(3);
  await expect(page.locator('.dg-algo-cell [aria-label="Vertex 0, visited, current"]')).toHaveCount(1);

  await page.locator('.dg-view-list').getByRole('button', { name: 'Edit Graph bindings' }).click();
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
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs: [runs[0]] } }));
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

test('history divider resizes and can push either pane aside', async ({ page }) => {
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs: [runs[0]] } }));
  await page.goto('/');
  const tablePanel = page.locator('.dg-history-table-panel');
  const graphPanel = page.locator('.dg-history-graph-panel');
  const divider = page.getByRole('separator', { name: 'Resize table and graph' });
  const width = (locator: typeof tablePanel) =>
    locator.evaluate((element) => element.getBoundingClientRect().width);

  expect((await width(tablePanel)) / (await width(graphPanel))).toBeCloseTo(2, 0);
  await page.getByRole('button', { name: 'Expand graph' }).click();
  await expect.poll(() => width(graphPanel)).toBeGreaterThan(await width(tablePanel));
  await page.getByRole('button', { name: 'Expand graph' }).click();
  await expect.poll(() => width(tablePanel)).toBeGreaterThan(await width(graphPanel));
  await page.getByRole('button', { name: 'Expand table' }).click();
  expect(await width(tablePanel)).toBeGreaterThan((await width(graphPanel)) * 4);

  const bounds = await divider.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 70);
  await page.mouse.down();
  await page.mouse.move(bounds!.x - 180, bounds!.y + 70, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => width(graphPanel)).toBeGreaterThan(200);
});

test('history panes stack with usable graph space on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 620, height: 950 });
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs: [runs[0]] } }));
  await page.goto('/');
  const layout = page.locator('.dg-history-layout');
  await expect(layout).toHaveAttribute('data-orientation', 'vertical');
  const table = await page.locator('.dg-history-table-panel').boundingBox();
  const graph = await page.locator('.dg-history-graph-panel').boundingBox();
  expect(graph!.y).toBeGreaterThan(table!.y + table!.height);
  expect(graph!.height).toBeGreaterThan(350);
  await expect(page.locator('.dg-graph-node.is-selected')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(620);
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
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs: [longRun] } }));
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
  let requests = 0;
  await page.route('**/api/runs', (route) => {
    requests += 1;
    return route.fulfill({ json: { runs: [runs[0]] } });
  });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Change a display format' });
  await trigger.click();
  const popover = page.getByRole('dialog', { name: 'Display a' });
  await expect(popover).toBeVisible();

  await expect.poll(() => requests, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await expect(popover).toBeVisible();
  await popover.getByRole('button', { name: 'Bars' }).hover();
  await expect(popover).toBeVisible();
  await popover.getByRole('button', { name: 'Bars' }).click();
  await expect(page.locator('.dg-table-scroll .dg-bars')).toHaveCount(4);
});

test('grid Algo View binds recorded matrix and position values', async ({ page }) => {
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
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs: [gridRun] } }));
  await page.goto('/');
  await expect(page.locator('.dg-table-scroll .lv-matrix')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add Algo View' }).click();
  await page.locator('.dg-template-grid button').filter({ hasText: 'Grid traversal' }).click();
  await expect(page.locator('.dg-binding-current')).toContainText(['board', 'pos']);
  await page.getByRole('button', { name: 'Add column' }).click();
  await expect(page.locator('.dg-table-scroll .dg-grid-view')).toHaveCount(2);
  await expect(page.locator('.dg-table-scroll .dg-grid-view .current')).toHaveCount(2);
});

test('selection and display settings are retained separately for each run', async ({ page }) => {
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs } }));
  await page.goto('/');
  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  await page.getByRole('button', { name: 'Select record 1' }).click();
  await page.getByRole('button', { name: 'Change a display format' }).click();
  await page.getByRole('button', { name: 'Bars' }).click();
  await page.locator('.dg-run-list button').filter({ hasText: 'without-from' }).click();
  await expect(page.locator('.dg-table-scroll .dg-bars')).toHaveCount(0);
  await page.getByRole('button', { name: 'Select record 2' }).click();
  await page.locator('.dg-run-list button').filter({ hasText: 'with-from' }).first().click();
  await expect(page.locator('.dg-frame-row.is-selected')).toContainText('1');
  await expect(page.locator('.dg-table-scroll .dg-bars')).toHaveCount(4);
});

test('nested span groups collapse and expand through the table row model', async ({ page }) => {
  await page.route('**/api/runs', (route) => route.fulfill({ json: { runs: [runs[0]] } }));
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
