import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Field Notes catalog exposes interactive value and history states', async ({ page }) => {
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'Field Notes' })).toBeVisible();
  await page.getByRole('button', { name: 'Change a display format' }).click();
  await page.getByRole('button', { name: 'Bars' }).click();
  await expect(page.getByRole('img', { name: /Bar chart of values/ })).toBeVisible();
  const barHeights = await page
    .locator('.ct-array-bars i')
    .evaluateAll((bars) => bars.map((bar) => Number.parseFloat(getComputedStyle(bar).height)));
  expect(barHeights.every((height, index) => index === 0 || height > barHeights[index - 1])).toBe(true);
  await page.getByRole('textbox', { name: 'Filter recorded values' }).fill('mid');
  await expect(page.locator('.ct-filter-results').getByText('mid')).toBeVisible();
  await expect(page.locator('.ct-filter-results').getByText('left')).toHaveCount(0);
  await page.getByRole('button', { name: 'Jump to latest' }).click();
  await page.getByRole('checkbox', { name: 'Changes only' }).check();
  await expect(page.getByRole('group', { name: 'Recorded sequences' }).getByRole('button')).toHaveCount(1);
  await expect(page.locator('.ct-inspection')).toContainText('#06');
  await expect(page.getByRole('table')).toContainText('span [0, 2]');
  await page.getByRole('button', { name: 'Select sequence 7' }).click();
  await expect(page.getByRole('checkbox', { name: 'Changes only' })).not.toBeChecked();
  await expect(page.locator('.ct-inspection')).toContainText('#07');
  await page.getByRole('button', { name: 'Open configuration' }).click();
  await expect(page.getByRole('dialog')).toContainText('Range & marker');
  await page.getByRole('button', { name: 'Close dialog' }).click();
});

test('Field Notes catalog keeps mobile content within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Change a display format' }).click();
  await page.getByRole('button', { name: 'Text' }).click();
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
});

test('Field Notes catalog has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/catalog');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
});

test('Field Notes popover and dialog are accessible while open', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Change a display format' }).click();
  await expect(page.locator('.ct-popover')).toBeVisible();
  let result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map(({ id }) => id)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open configuration' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map(({ id }) => id)).toEqual([]);
});
