import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sparkflow.lang', 'en-US'));
});

test('unknown routes provide a working way home', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/unknown-foundation-route');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page.getByRole('heading', { name: 'Spark Flow', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the application starts when browser preference storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Spark Flow', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('resource errors are visible and recover through Retry', async ({ page }) => {
  let failed = true;
  await page.route('**/resource-manifest.json', async (route) => {
    if (failed) await route.fulfill({ status: 503, body: 'Unavailable' });
    else await route.fulfill({ json: { courseware: [], simcanvas: [], images: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Courseware', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Resources could not be loaded');
  failed = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('fallback pages fit mobile screens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/unknown-foundation-route');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('experiment cards support keyboard navigation', async ({ page }) => {
  await page.goto('/');
  const experiment = page.getByRole('link', { name: 'Projectile Motion', exact: true });
  await experiment.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/experiment\/projectile-motion$/);
  await expect(page.getByRole('heading', { name: 'Projectile Motion', exact: true, level: 1 })).toBeVisible();
});
