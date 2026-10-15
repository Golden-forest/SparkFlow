import { expect, test, type Page } from '@playwright/test';

type ExperimentCase = {
  id: string;
  name: string;
  cardTitle: string;
};

const runtimeErrors = new WeakMap<Page, string[]>();

const experimentCases: ExperimentCase[] = [
  { id: 'projectile-motion', name: 'Projectile Motion Lab', cardTitle: 'Projectile Motion' },
  { id: 'uniform-circular-motion', name: 'Uniform Circular Motion Lab', cardTitle: 'Circular Motion' },
  { id: 'inclined-plane-friction', name: 'Inclined Plane Friction Lab', cardTitle: 'Inclined Plane' },
  { id: 'spring-oscillation', name: 'Spring Oscillation Lab', cardTitle: 'Spring Oscillation' },
  { id: 'momentum-carts', name: 'Momentum Carts Collision', cardTitle: 'Momentum Carts' },
];

async function adjustFirstRangeControl(page: Page): Promise<void> {
  const slider = page.locator('input[type="range"]').first();
  await expect(slider).toBeVisible();

  const before = await slider.inputValue();

  const max = await slider.getAttribute('max');
  await slider.focus();
  await slider.press(Number(before) === Number(max) ? 'ArrowLeft' : 'ArrowRight');
  await expect.poll(() => slider.inputValue()).not.toBe(before);
}

async function toggleFirstMonitorCheckbox(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Monitor', exact: true }).click();

  await expect
    .poll(async () => page.locator('input[type="checkbox"]').count(), { timeout: 10_000 })
    .toBeGreaterThan(0);

  const checkbox = page.locator('input[type="checkbox"]').first();
  const checkedBefore = await checkbox.isChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked({ checked: !checkedBefore });
}

async function smokeExperiment(page: Page, experiment: ExperimentCase): Promise<void> {
  await page.goto(`/experiment/${experiment.id}`);
  await expect(page.getByRole('heading', { name: experiment.cardTitle, level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

  await adjustFirstRangeControl(page);

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await toggleFirstMonitorCheckbox(page);
}

test.describe('Physics Lab smoke e2e', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    runtimeErrors.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('sparkflow.lang', 'en-US'));
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page)).toEqual([]);
  });

  test('home lists all newly added mechanics experiments', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Spark Flow', level: 1 })).toBeVisible();

    for (const experiment of experimentCases) {
      await expect(page.getByRole('heading', { name: experiment.cardTitle, level: 2 })).toBeVisible();
    }

    await page.getByRole('heading', { name: 'Projectile Motion' }).click();
    await expect(page).toHaveURL(/\/experiment\/projectile-motion$/);
    await expect(page.getByRole('heading', { name: 'Projectile Motion', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  for (const experiment of experimentCases) {
    test(`${experiment.name} renders and accepts baseline interactions`, async ({ page }) => {
      await smokeExperiment(page, experiment);
    });
  }

  test('home fits a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Spark Flow', level: 1 })).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows).toBe(false);
  });
});
