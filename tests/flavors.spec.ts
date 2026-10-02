import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('design flavors preserve the sample content and expose an interactive tooltip', async ({ page }) => {
  await page.goto('/flavors?theme=prism');
  const preview = page.locator('.fl-preview');
  await expect(preview).toHaveAttribute('data-flavor', 'prism');
  await expect(page.locator('.fl-table tbody tr')).toHaveCount(5);
  await expect(page.locator('.fl-inspection-body')).toContainText('11');
  await expect(page.locator('.fl-inspection-body')).toContainText('15');

  await page.getByRole('button', { name: /Graphite/ }).click();
  await expect(preview).toHaveAttribute('data-flavor', 'graphite');
  await expect(page).toHaveURL(/theme=graphite/);
  await page.getByRole('button', { name: 'Show value tooltip' }).focus();
  await expect(page.locator('.fl-floating-tip')).toContainText('11 → 15');

  await page.getByRole('button', { name: /Field Notes/ }).click();
  await expect(preview).toHaveAttribute('data-flavor', 'field-notes');
  await expect(page.locator('.fl-table tbody tr')).toHaveCount(5);
});

test('each flavor has no detectable accessibility violations', async ({ page }) => {
  for (const theme of ['prism', 'graphite', 'field-notes']) {
    await page.goto(`/flavors?theme=${theme}`);
    await expect(page.locator('.fl-preview')).toHaveAttribute('data-flavor', theme);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual(
      [],
    );
  }
});
