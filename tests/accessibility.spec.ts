import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockRuns } from './support/mock-tauri';

const frames = readFileSync(new URL('../protocol/v2/example.ndjson', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));

test('the trace workspace has no detectable accessibility violations', async ({ page }) => {
  await mockRuns(page, [
    {
      id: 'a11y-run',
      source: 'binary.rs',
      input: '',
      startedAt: '2026-09-30T09:00:00.000Z',
      durationMs: 8,
      status: 'completed',
      frames: frames.map((frame) => ({ ...frame, runId: 'a11y-run' })),
    },
  ]);
  await page.goto('/');
  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

  await page.getByRole('button', { name: 'Add View' }).click();
  const chooser = await new AxeBuilder({ page }).analyze();
  expect(
    chooser.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([]);

  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Range & marker/ })
    .click();
  const bindings = await new AxeBuilder({ page }).analyze();
  expect(
    bindings.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([]);

  await page.getByRole('dialog').getByRole('button', { name: 'Add view' }).click();
  const withView = await new AxeBuilder({ page }).analyze();
  expect(
    withView.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([]);

  await page.getByRole('button', { name: 'Change left display format' }).click();
  await page.getByRole('button', { name: 'Binary' }).click();
  const withBinary = await new AxeBuilder({ page }).analyze();
  expect(
    withBinary.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([]);
});
