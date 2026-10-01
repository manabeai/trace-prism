import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const records = readFileSync(new URL('../protocol/v2/example.ndjson', import.meta.url), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const startedAt = '2026-09-30T09:00:00.000Z';
const runs = [
  { id: 'with-from', source: 'binary.rs', input: 'sample.in', startedAt, durationMs: 8, status: 'completed', frames: records },
  { id: 'without-from', source: 'hierarchy.rs', input: 'sample.in', startedAt, durationMs: 8, status: 'completed', frames: records.map(({ from: _from, ...record }) => ({ ...record, runId: 'without-from' })) },
];

test('v2 trace materializes in the live workspace and remains explorable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/runs', route => route.fulfill({ json: { runs } }));
  await page.goto('/');

  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  await expect(page.locator('.dg-frame-row.is-selected .dg-value-cell').nth(1)).toContainText('2');
  await expect(page.locator('.dg-frame-row.is-selected .dg-value-cell').nth(3)).toContainText('3');
  await page.getByRole('button', { name: 'Change a display format' }).click();
  await page.getByRole('button', { name: 'Bars' }).click();
  await expect(page.locator('.dg-bars')).toHaveCount(4);

  await page.getByRole('button', { name: 'Add Algo View' }).click();
  await page.locator('.dg-template-grid button').filter({ hasText: 'Binary search' }).click();
  await expect(page.locator('.dg-binding-current')).toContainText(['left', 'right', 'mid', 'ok']);
  await page.getByRole('button', { name: 'Add column' }).click();
  await expect(page.locator('.dg-algo-cell')).toHaveCount(4);

  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Transition graph');
  await expect(page.locator('.dg-graph-node')).toHaveCount(4);
  await page.locator('.dg-run-list button').filter({ hasText: 'hierarchy.rs' }).click();
  await expect(page.locator('.dg-graph-meta strong')).toHaveText('Span hierarchy');
  expect(await page.locator('.dg-graph-node').count()).toBeGreaterThan(4);
  expect(errors).toEqual([]);
});

test('grid Algo View binds recorded matrix and position values', async ({ page }) => {
  const integer = (value: number) => ({ t: 'int', v: String(value) });
  const array = (items: unknown[]) => ({ t: 'array', items });
  const board = array([array([integer(0), integer(1)]), array([integer(0), integer(0)])]);
  const gridRun = {
    id: 'grid', source: 'maze.rs', input: 'sample.in', startedAt, durationMs: 3, status: 'completed',
    frames: [
      { format: 'viz.trace/v2', kind: 'snapshot', runId: 'grid', seq: '0', span: [], values: [{ name: 'board', value: board }, { name: 'pos', value: array([integer(0), integer(0)]) }] },
      { format: 'viz.trace/v2', kind: 'patch', runId: 'grid', seq: '1', span: [integer(0)], ops: [{ op: 'put', name: 'pos', value: array([integer(1), integer(0)]) }] },
    ],
  };
  await page.route('**/api/runs', route => route.fulfill({ json: { runs: [gridRun] } }));
  await page.goto('/');
  await expect(page.locator('.lv-matrix')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add Algo View' }).click();
  await page.locator('.dg-template-grid button').filter({ hasText: 'Grid traversal' }).click();
  await expect(page.locator('.dg-binding-current')).toContainText(['board', 'pos']);
  await page.getByRole('button', { name: 'Add column' }).click();
  await expect(page.locator('.dg-grid-view')).toHaveCount(2);
  await expect(page.locator('.dg-grid-view .current')).toHaveCount(2);
});
