import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('search prototype builds a typed query with the mouse and marks matching records', async ({ page }) => {
  await page.goto('/catalog/search');
  const search = page.getByRole('combobox', { name: 'Search trace' });
  await search.focus();
  await expect(page.getByRole('option', { name: /Numbers · Vec<int>/ })).toBeVisible();
  await page.getByRole('option', { name: /Numbers · Vec<int>/ }).click();
  await expect(page.getByRole('option', { name: /Sum of elements/ })).toBeVisible();
  await page.getByRole('option', { name: /Sum of elements/ }).click();
  await page.getByRole('option', { name: /Greater than or equal/ }).click();
  await search.fill('50');
  await search.press('Space');
  await expect(page.locator('.sp-query-string')).toContainText('A sum >= 50');
  await expect(page.locator('.sp-hit-count')).toHaveText('6 hits');
  await expect(page.locator('.sp-tick.is-hit')).toHaveCount(6);
  await expect(page.locator('#sp-row-6 td.is-match')).toHaveCount(1);
});

test('keyboard chips, free-text fallback, navigation, and dimming work', async ({ page }) => {
  await page.goto('/catalog/search');
  const search = page.getByRole('combobox', { name: 'Search trace' });
  await search.fill('a');
  await search.press('Space');
  await search.fill('>');
  await search.press('Space');
  await search.fill('20');
  await search.press('Space');
  await expect(page.locator('.sp-query-string')).toContainText('a > 20');
  await expect(page.locator('.sp-hit-count')).toHaveText('6 hits');
  await expect(page.locator('.sp-tick.is-hit')).toHaveCount(6);
  await expect(page.locator('.sp-node.is-dim')).toHaveCount(6);
  await page.getByRole('button', { name: 'Next hit' }).click();
  await expect(page.locator('.sp-graph-inspect')).toContainText('seq 7');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await search.fill('exploring');
  await expect(page.locator('.sp-hit-count')).toHaveText('4 hits');
  await expect(page.locator('.sp-table-panel td.is-match')).toHaveCount(4);
});

test('collection membership highlights the exact matching element', async ({ page }) => {
  await page.goto('/catalog/search');
  const search = page.getByRole('combobox', { name: 'Search trace' });
  await search.fill('A');
  await search.press('Space');
  await search.fill('contains');
  await search.press('Space');
  await search.fill('7');
  await search.press('Space');
  await expect(page.locator('.sp-hit-count')).toHaveText('3 hits');
  await expect(page.locator('.sp-element-hit')).toHaveCount(3);
  await expect(page.locator('#sp-row-6 .sp-element-hit')).toHaveText('7');
});

test('IME conversion Enter does not commit a search chip', async ({ page }) => {
  await page.goto('/catalog/search');
  const search = page.getByRole('combobox', { name: 'Search trace' });
  await search.fill('a');
  await search.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(page.locator('.sp-chip.variable')).toHaveCount(0);
  await expect(search).toHaveValue('a');
  await search.press('Space');
  await expect(page.locator('.sp-chip.variable')).toHaveText('a');
});

test('search prototype is usable on mobile and has no accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/catalog/search');
  const search = page.getByRole('combobox', { name: 'Search trace' });
  await search.focus();
  await expect(page.getByRole('listbox')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
});
