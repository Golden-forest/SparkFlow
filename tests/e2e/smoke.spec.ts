import { expect, test, type Page } from '@playwright/test';

type ExperimentCase = {
  id: string;
  name: string;
  cardTitle: string;
};

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

  await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    const min = Number.parseFloat(input.min || '0');
    const max = Number.parseFloat(input.max || '100');
    const current = Number.parseFloat(input.value || '0');
    const fallbackTarget = Number.isFinite(max) ? max : current + 1;

    let target = fallbackTarget;
    if (Number.isFinite(min) && Number.isFinite(current)) {
      target = Math.abs(current - min) < 1e-9 ? max : min;
    }

    input.value = String(target);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const after = await slider.inputValue();
  expect(after).not.toBe(before);
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
  await expect(page.getByRole('heading', { name: experiment.name, level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

  await adjustFirstRangeControl(page);

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await toggleFirstMonitorCheckbox(page);
}

test.describe.serial('Physics Lab smoke e2e', () => {
  test('home lists all newly added mechanics experiments', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Spark Flow', level: 1 })).toBeVisible();

    for (const experiment of experimentCases) {
      await expect(page.getByRole('heading', { name: experiment.cardTitle, level: 2 })).toBeVisible();
    }

    await page.getByRole('heading', { name: 'Projectile Motion' }).click();
    await expect(page).toHaveURL(/\/experiment\/projectile-motion$/);
    await expect(page.getByRole('heading', { name: 'Projectile Motion Lab', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  for (const experiment of experimentCases) {
    test(`${experiment.name} renders and accepts baseline interactions`, async ({ page }) => {
      await smokeExperiment(page, experiment);
    });
  }
});
