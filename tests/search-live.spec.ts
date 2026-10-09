import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockRuns } from './support/mock-tauri';

const records = readFileSync(new URL('../protocol/v2/example.ndjson', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const runs = ['search-one', 'search-two'].map((id) => ({
  id,
  source: 'binary.rs',
  input: 'sample.in',
  startedAt: '2026-09-30T09:00:00.000Z',
  durationMs: 8,
  status: 'completed',
  frames: records.map((record) => ({ ...record, runId: id })),
}));

test.beforeEach(async ({ page }) => {
  await mockRuns(page, runs);
  await page.goto('/');
  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
});

test('typed search synchronizes table, graph, timeline, and hit navigation', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Search trace' });
  await search.focus();
  await page.getByRole('option', { name: /left.*int value/ }).click();
  await page.getByRole('option', { name: />=.*Greater than or equal/ }).click();
  await search.fill('2');
  await search.press('Space');

  await expect(page.locator('.ws-search-navigation')).toContainText('2 hits');
  await expect(page.locator('.dg-frame-row.is-search-dim')).toHaveCount(2);
  await expect(page.locator('.dg-frame-row.is-search-hit')).toHaveCount(2);
  await expect(page.locator('.dg-graph-node.is-search-dim')).toHaveCount(2);
  await expect(page.locator('.dg-search-ticks .is-hit')).toHaveCount(2);
  await expect(page.locator('.dg-value-cell.is-search-match')).toHaveCount(2);
  await page.getByRole('button', { name: 'Next search hit' }).click();
  await expect(page.locator('.dg-frame-row.is-selected')).toContainText('2');
  await expect(page.locator('.dg-graph-node.is-selected')).toHaveAttribute('aria-label', /Record 2/);
});

test('collection match highlights an element and search state belongs to the run', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Search trace' });
  await search.fill('a');
  await search.press('Space');
  await search.fill('contains');
  await search.press('Space');
  await search.fill('5');
  await search.press('Space');
  await expect(page.locator('.ws-search-navigation')).toContainText('4 hits');
  await expect(page.locator('.dg-array span.is-search-match')).toHaveCount(4);
  await expect(page.locator('.dg-array span.is-search-match').first()).toHaveText('5');

  await page.locator('.dg-run-list button[data-run-id="search-two"]').click();
  await expect(page.locator('.ws-search-chip.field')).toHaveCount(0);
  await page.locator('.dg-run-list button[data-run-id="search-one"]').click();
  await expect(page.locator('.ws-search-chip.field')).toHaveText('a');
  await expect(page.locator('.ws-search-navigation')).toContainText('4 hits');
});

test('focused search suggestions preserve accessibility', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Search trace' }).focus();
  await expect(page.getByRole('listbox', { name: 'Choose a recorded value' })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
});

test('nullable values offer their observed bool type and is null', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Search trace' });
  await search.focus();
  await page.getByRole('option', { name: /ok.*bool value/ }).click();
  await expect(page.getByRole('option', { name: /is true.*Value is true/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /is null.*Value is null/ })).toBeVisible();
  await page.getByRole('option', { name: /is null.*Value is null/ }).click();
  await expect(page.locator('.ws-search-navigation')).toContainText('2 hits');
});
