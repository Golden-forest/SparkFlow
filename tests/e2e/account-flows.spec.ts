import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:3100';
const appOrigin = 'http://127.0.0.1:4175';
const mailboxOrigin = 'http://127.0.0.1:3101';
const initialPassword = 'V4lid-test-password!';
const replacementPassword = 'N3w-valid-password!';
let contentServer: Server;
let contentReceivedSessionCookie = false;
let lastSignInAttemptAt = 0;

test.beforeAll(async () => {
  contentServer = createServer((incoming, outgoing) => {
    contentReceivedSessionCookie ||= Boolean(incoming.headers.cookie?.includes('session_token'));
    outgoing.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    outgoing.end(`<!doctype html><html lang="en"><title>Resource isolation probe</title>
      <body><p id="storage"></p><p id="parent"></p><script>
      let canReadParentDocument = false;
      try { canReadParentDocument = Boolean(window.parent.document.body); } catch { /* Browser origin isolation. */ }
      let ownStorageAvailable = false;
      try { localStorage.setItem('account-origin-probe','available'); ownStorageAvailable = localStorage.getItem('account-origin-probe') === 'available'; } catch { /* Sandbox storage compatibility is tested below. */ }
      document.getElementById('storage').textContent = ownStorageAvailable ? 'Own storage: available' : 'Own storage: blocked';
      document.getElementById('parent').textContent = canReadParentDocument ? 'Parent access: available' : 'Parent access: blocked';
    </script></body></html>`);
  });
  await new Promise<void>((resolve, reject) => {
    contentServer.once('error', reject);
    contentServer.listen(4176, 'localhost', resolve);
  });
});

test.beforeEach(async ({ page }) => {
  // Retries share the fixture's real, persisted sensitive-endpoint buckets.
  if (test.info().retry > 0) await delay(11_000);
  await page.addInitScript(() => localStorage.setItem('sparkflow.lang', 'en-US'));
});

test.afterAll(async () => {
  if (contentServer?.listening) {
    await new Promise<void>((resolve, reject) => contentServer.close(error => error ? reject(error) : resolve()));
  }
});

interface TestMessage {
  to: string;
  subject: string;
  text: string;
}

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function mailedLink(request: APIRequestContext, recipient: string, purpose: 'verify' | 'reset') {
  let messages: TestMessage[] = [];
  await expect.poll(async () => {
    const response = await request.get(`${mailboxOrigin}/messages`, { params: { recipient } });
    expect(response.ok()).toBe(true);
    messages = (await response.json() as { messages: TestMessage[] }).messages;
    return messages.filter(message => purpose === 'verify'
      ? message.text.includes('/verify-email?')
      : message.text.includes('/reset-password')).length;
  }, { message: 'The real SMTP collector must receive the account email' }).toBeGreaterThan(0);

  const message = messages.filter(candidate => purpose === 'verify'
    ? candidate.text.includes('/verify-email?')
    : candidate.text.includes('/reset-password')).at(-1);
  expect(message).toBeDefined();
  const candidates = message!.text.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  const link = candidates.map(candidate => candidate.replace(/&amp;/g, '&').replace(/[),.;]+$/, ''))
    .find(candidate => purpose === 'verify' ? candidate.includes('/verify-email?') : candidate.includes('/reset-password'));
  expect(link).toBeDefined();
  const parsed = new URL(link!);
  expect([apiOrigin, appOrigin]).toContain(parsed.origin);
  return link!;
}

async function registerAndVerify(page: Page, request: APIRequestContext, email: string, name: string) {
  await page.goto('/account/sign-up');
  if (test.info().project.name === 'account-mobile') {
    await page.screenshot({ path: '/tmp/atomic-accounts-mobile-sign-up.png', fullPage: true });
  }
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(initialPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(initialPassword);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Check your email', { exact: true })).toBeVisible();
  const sessionBeforeVerification = await page.context().request.get(`${apiOrigin}/api/auth/get-session`);
  expect(sessionBeforeVerification.status()).toBe(200);
  expect(await sessionBeforeVerification.json() === null).toBe(true);
  await page.goto(await mailedLink(request, email, 'verify'));
  await expect(page).toHaveURL(/\/account\/verify-email(?:\?|$)/);
}

async function signIn(page: Page, email: string, password = initialPassword) {
  await page.goto('/account/sign-in');
  if (test.info().project.name === 'account-desktop') {
    await page.screenshot({ path: '/tmp/atomic-accounts-desktop-sign-in.png', fullPage: true });
  }
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await waitForSignInWindow();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
}

async function waitForSignInWindow() {
  // Better Auth 1.7.7 resets a bucket after a quiet window since its LAST request.
  // Real logins are spaced to retain production protection without expected 429s.
  const remaining = Math.max(0, 11_000 - (Date.now() - lastSignInAttemptAt));
  if (remaining) await delay(remaining);
  lastSignInAttemptAt = Date.now();
}

async function assertFitsViewport(page: Page) {
  const dimensions = await page.evaluate(() => ({
    contentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

test('verified accounts persist, manage private data, sign out, and recover passwords', async ({ page, browser, request }) => {
  const browserErrors = captureBrowserErrors(page);
  const email = `journey-${randomUUID()}@example.test`;
  const privateNote = `Private study note ${randomUUID()}`;

  await test.step('Register and receive a real SMTP verification message', async () => {
    await registerAndVerify(page, request, email, 'Account test');
    await expect(page.getByRole('heading', { name: 'Email confirmation', exact: true })).toBeVisible();
  });

  await test.step('Sign in and retain the session after refreshing', async () => {
    await signIn(page, email);
    const sessionCookie = (await page.context().cookies()).find(cookie => cookie.name.includes('session_token'));
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Lax');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
    await assertFitsViewport(page);
  });

  await test.step('Update the profile and persist a private note', async () => {
    await page.getByLabel('Name', { exact: true }).fill('Updated account test');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByLabel('Note', { exact: true }).fill(privateNote);
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await expect(page.getByText(privateNote, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Updated account test');
    await expect(page.getByText(privateNote, { exact: true })).toBeVisible();
    await page.screenshot({
      path: test.info().project.name === 'account-desktop'
        ? '/tmp/atomic-accounts-desktop-profile.png'
        : '/tmp/atomic-accounts-mobile-dashboard.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Delete note', exact: true }).click();
    await expect(page.getByText(privateNote, { exact: true })).toHaveCount(0);
  });

  await test.step('Render the real gallery iframe with its own storage and without the account cookie or parent DOM access', async () => {
    contentReceivedSessionCookie = false;
    // Only the static catalogue is a fixture; auth, storage, SMTP and frames remain real.
    await page.route('**/resource-manifest.json', route => route.fulfill({ json: {
      courseware: [], images: [],
      simcanvas: [{ id: 'account-origin-probe', title: 'Account origin probe', path: '/simcanvas/account-origin-probe/' }],
    } }));
    await page.goto('/');
    await page.getByRole('button', { name: 'SimCanvas', exact: true }).click();
    await page.getByRole('button', { name: 'Account origin probe', exact: true }).click();
    const frame = page.getByRole('dialog', { name: 'Account origin probe', exact: true }).locator('iframe');
    await expect(frame).toHaveAttribute('src', 'http://localhost:4176/simcanvas/account-origin-probe/');
    await expect(frame).toHaveAttribute('sandbox', /allow-same-origin/);
    await expect(frame.contentFrame().getByText('Own storage: available', { exact: true })).toBeVisible();
    await expect(frame.contentFrame().getByText('Parent access: blocked', { exact: true })).toBeVisible();
    expect(contentReceivedSessionCookie).toBe(false);
    await page.unroute('**/resource-manifest.json');
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
  });

  await test.step('Sign out and enforce protected-route access', async () => {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/account\/sign-in(?:\?|$)/);
    expect(await (await page.context().request.get(`${apiOrigin}/api/auth/get-session`)).json() === null).toBe(true);
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account\/sign-in(?:\?|$)/);
  });

  await test.step('Receive a real password-reset email and use the replacement password', async () => {
    await page.goto('/account/forgot-password');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await page.goto(await mailedLink(request, email, 'reset'));
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await page.getByLabel('New password', { exact: true }).fill(replacementPassword);
    await page.getByLabel('Confirm password', { exact: true }).fill(replacementPassword);
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue(replacementPassword);
    await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue(replacementPassword);
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
    await expect(page.getByText('Password updated', { exact: true })).toBeVisible();
    await waitForSignInWindow();
    const oldPasswordAttempt = await request.post(`${apiOrigin}/api/auth/sign-in/email`, {
      headers: { Origin: appOrigin },
      data: { email, password: initialPassword },
    });
    expect(oldPasswordAttempt.status()).toBe(401);
    await signIn(page, email, replacementPassword);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
    await assertFitsViewport(page);
  });

  await test.step('Revoke other devices and change the password without losing the current session', async () => {
    const peerContext = await browser.newContext({ baseURL: appOrigin, viewport: page.viewportSize(), locale: 'en-US' });
    try {
      const peerPage = await peerContext.newPage();
      const peerErrors = captureBrowserErrors(peerPage);
      await signIn(peerPage, email, replacementPassword);
      await page.getByRole('button', { name: 'Sign out other devices', exact: true }).click();
      await expect(page.getByText('Other devices have been signed out.', { exact: true })).toBeVisible();
      expect(await (await peerContext.request.get(`${apiOrigin}/api/auth/get-session`)).json() === null).toBe(true);
      await peerPage.goto('/account');
      await expect(peerPage).toHaveURL(/\/account\/sign-in(?:\?|$)/);
      await signIn(peerPage, email, replacementPassword);
      await page.getByLabel('Current password', { exact: true }).fill(replacementPassword);
      await page.getByLabel('New password', { exact: true }).fill('Ch4nged-valid-password!');
      await page.getByLabel('Confirm new password', { exact: true }).fill('Ch4nged-valid-password!');
      await page.getByRole('button', { name: 'Change password', exact: true }).click();
      await expect(page.getByText('Password updated. Other devices have been signed out.', { exact: true })).toBeVisible();
      expect(await (await peerContext.request.get(`${apiOrigin}/api/auth/get-session`)).json() === null).toBe(true);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
      expect(peerErrors).toEqual([]);
    } finally {
      await peerContext.close();
    }
  });

  await page.screenshot({
    path: test.info().project.name === 'account-desktop'
      ? '/tmp/atomic-accounts-desktop-profile.png'
      : '/tmp/atomic-accounts-mobile-dashboard.png',
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});

test('two verified browser users cannot read or delete each other’s notes', async ({ page, browser, request }) => {
  const firstErrors = captureBrowserErrors(page);
  const secondContext = await browser.newContext({
    baseURL: appOrigin,
    viewport: page.viewportSize(),
    locale: 'en-US',
    isMobile: Boolean(test.info().project.use.isMobile),
    hasTouch: Boolean(test.info().project.use.hasTouch),
  });
  try {
    const secondPage = await secondContext.newPage();
    const secondErrors = captureBrowserErrors(secondPage);
    const firstEmail = `first-${randomUUID()}@example.test`;
    const secondEmail = `second-${randomUUID()}@example.test`;
    const firstNote = `First user only ${randomUUID()}`;
    const secondNote = `Second user only ${randomUUID()}`;

    await registerAndVerify(page, request, firstEmail, 'First browser user');
    await signIn(page, firstEmail);
    await page.getByLabel('Note', { exact: true }).fill(firstNote);
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await expect(page.getByText(firstNote, { exact: true })).toBeVisible();
    const firstNotesResponse = await page.context().request.get(`${apiOrigin}/api/notes`);
    const firstNotes = await firstNotesResponse.json() as { notes: Array<{ id: string; body: string }> };
    expect(firstNotes.notes).toHaveLength(1);

    await registerAndVerify(secondPage, request, secondEmail, 'Second browser user');
    await signIn(secondPage, secondEmail);
    await expect(secondPage.getByText(firstNote, { exact: true })).toHaveCount(0);
    const foreignDeletion = await secondContext.request.delete(`${apiOrigin}/api/notes/${firstNotes.notes[0].id}`, {
      headers: { Origin: appOrigin },
    });
    expect(foreignDeletion.status()).toBe(404);
    await secondPage.getByLabel('Note', { exact: true }).fill(secondNote);
    await secondPage.getByRole('button', { name: 'Add note', exact: true }).click();
    await expect(secondPage.getByText(secondNote, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(firstNote, { exact: true })).toBeVisible();
    await expect(page.getByText(secondNote, { exact: true })).toHaveCount(0);
    await secondPage.reload();
    await expect(secondPage.getByText(secondNote, { exact: true })).toBeVisible();
    await expect(secondPage.getByText(firstNote, { exact: true })).toHaveCount(0);
    await assertFitsViewport(page);
    await assertFitsViewport(secondPage);
    expect(firstErrors).toEqual([]);
    expect(secondErrors).toEqual([]);
  } finally {
    await secondContext.close();
  }
});
