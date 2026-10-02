import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const frames = readFileSync(new URL('../protocol/v2/example.ndjson', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));

test('the trace workspace has no detectable accessibility violations', async ({ page }) => {
  await page.route('**/api/runs', (route) =>
    route.fulfill({
      json: {
        runs: [
          {
            id: 'a11y-run',
            source: 'binary.rs',
            input: '',
            startedAt: '2026-09-30T09:00:00.000Z',
            durationMs: 8,
            status: 'completed',
            frames: frames.map((frame) => ({ ...frame, runId: 'a11y-run' })),
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.dg-frame-row')).toHaveCount(4);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
});
