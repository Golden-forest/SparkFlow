import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { startPostgres, freePort } from './fixtures/postgres.js';
import { loadConfig } from '../src/config.js';
import { migrate } from '../src/migrations.js';
import { createPool, verifyApplicationRole, asUser } from '../src/database.js';
import { createMailer, type AccountMail } from '../src/mail.js';
import { createApplication } from '../src/app.js';
import { createHTTPServer } from '../src/http.js';

test('real PostgreSQL and HTTP account lifecycle, revocation and two-user isolation', { timeout: 60_000 }, async () => {
  const pg = await startPostgres();
  const port = await freePort();
  const appOrigin = 'http://127.0.0.1:4175';
  const config = loadConfig({ NODE_ENV: 'test', PORT: String(port), AUTH_BASE_URL: `http://127.0.0.1:${port}`, APP_ORIGIN: appOrigin,
    AUTH_SECRET: 'integration-test-only-secret-at-least-32-characters', DATABASE_URL: pg.databaseURL, DATABASE_APP_ROLE: pg.appRole,
    DATABASE_POOL_MAX: '2', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_FROM: 'accounts@example.test',
  });
  const pool = createPool(config);
  const mail: AccountMail[] = [];
  const mailer = createMailer(config, async message => { mail.push(message); });
  let server: ReturnType<typeof createHTTPServer> | undefined;
  const password = 'A secure test password 123!';
  async function call(path: string, method = 'GET', body?: unknown, cookie?: string, origin: string | null = appOrigin) {
    const headers = new Headers();
    if (origin !== null) headers.set('Origin', origin);
    if (cookie) headers.set('Cookie', cookie);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    return fetch(`${config.authBaseURL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  }
  async function signIn(email: string, pwd = password) {
    const response = await call('/api/auth/sign-in/email', 'POST', { email, password: pwd });
    assert.equal(response.status, 200, `Sign-in status ${response.status}`);
    return response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
  }
  async function register(email: string) {
    const response = await call('/api/auth/sign-up/email', 'POST', { email, name: 'Test user', password, callbackURL: `${appOrigin}/account/verify-email` });
    assert.equal(response.status, 200);
    assert.equal((await call('/api/auth/sign-in/email', 'POST', { email, password })).status, 403);
    await mailer.drain();
    const message = mail.find(message => message.to === email && message.subject.startsWith('Verify'));
    assert.ok(message);
    const link = /https?:\/\/\S+/.exec(message.text)?.[0];
    assert.ok(link);
    const verify = await fetch(link, { redirect: 'manual' });
    assert.equal(verify.status, 302);
    assert.equal(new URL(verify.headers.get('Location')!).origin, appOrigin);
  }
  try {
    await migrate(pg.migrationURL, pg.appRole);
    await migrate(pg.migrationURL, pg.appRole); // Idempotent versioned migrations.
    await verifyApplicationRole(pool, pg.appRole);
    const migratorPool = createPool({ ...config, databaseURL: pg.migrationURL });
    try { await assert.rejects(verifyApplicationRole(migratorPool, pg.appRole)); } finally { await migratorPool.end(); }
    const adminPool = createPool({ ...config, databaseURL: pg.adminURL });
    try {
      await adminPool.query(`GRANT ${pg.migrationRole} TO ${pg.appRole}`);
      try { await assert.rejects(verifyApplicationRole(pool, pg.appRole), /parent database roles/); }
      finally { await adminPool.query(`REVOKE ${pg.migrationRole} FROM ${pg.appRole}`); }
      await adminPool.query(`GRANT CREATE ON SCHEMA auth TO ${pg.appRole}`);
      try { await assert.rejects(verifyApplicationRole(pool, pg.appRole), /create objects/); }
      finally { await adminPool.query(`REVOKE CREATE ON SCHEMA auth FROM ${pg.appRole}`); }
    } finally {
      await adminPool.end();
    }
    await verifyApplicationRole(pool, pg.appRole);
    const app = createApplication(config, pool, mailer);
    await app.ready();
    server = createHTTPServer(config, app.handler);
    await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(port, '127.0.0.1', resolve); });
    const health = await call('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('Cache-Control'), 'no-store');
    assert.equal(health.headers.get('Access-Control-Allow-Origin'), appOrigin);
    assert.equal((await call('/api/notes', 'POST', { body: 'x'.repeat(17_000) })).status, 413);
    assert.equal((await call('/api/notes')).status, 401);
    assert.equal((await call('/api/auth/sign-up/email', 'POST', {}, undefined, null)).status, 403);
    assert.equal((await call('/api/auth/sign-up/email', 'POST', {}, undefined, 'https://attacker.test')).status, 403);
    assert.equal((await call('/api/auth/sign-up/email', 'POST', { name: 'x'.repeat(81) })).status, 400);
    const cors = await fetch(`${config.authBaseURL}/api/notes`, { method: 'OPTIONS', headers: { Origin: appOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(cors.status, 204);
    assert.equal(cors.headers.get('Access-Control-Allow-Credentials'), 'true');
    await register('alice@example.test');
    await register('bob@example.test');
    assert.equal((await call('/api/auth/sign-in/email', 'POST', { email: 'unknown@example.test', password })).status, 401);
    // A new auth instance sees the same database-backed limit, without process-local memory.
    const otherInstance = createApplication(config, pool, mailer);
    await otherInstance.ready();
    const limited = await otherInstance.handler(new Request(`${config.authBaseURL}/api/auth/sign-in/email`, {
      method: 'POST', headers: { Origin: appOrigin, 'Content-Type': 'application/json', 'X-Real-IP': '127.0.0.1' },
      body: JSON.stringify({ email: 'alice@example.test', password }),
    }));
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('X-Retry-After'));
    // Unverified sign-in attempts also count toward the real authentication rate limiter.
    await delay(10_100);
    const alice = await signIn('alice@example.test');
    const bob = await signIn('bob@example.test');
    const aliceSession = await (await call('/api/auth/get-session', 'GET', undefined, alice)).json();
    const bobSession = await (await call('/api/auth/get-session', 'GET', undefined, bob)).json();
    assert.equal(aliceSession.user.emailVerified, true);
    assert.notEqual(aliceSession.user.id, bobSession.user.id);
    // Normal active session refreshes must not hit the former 60-request global ceiling.
    for (let index = 0; index < 70; index++) assert.equal((await call('/api/auth/get-session', 'GET', undefined, alice)).status, 200);
    assert.equal((await call('/api/auth/update-user', 'POST', { name: 'Alice Updated' }, alice)).status, 200);
    assert.equal((await (await call('/api/auth/get-session', 'GET', undefined, alice)).json()).user.name, 'Alice Updated');
    const created = await call('/api/notes', 'POST', { body: 'Alice private note' }, alice);
    assert.equal(created.status, 201);
    const note = (await created.json()).note;
    assert.equal((await (await call('/api/notes', 'GET', undefined, bob)).json()).notes.length, 0);
    assert.equal((await call(`/api/notes/${note.id}`, 'DELETE', undefined, bob)).status, 404);
    assert.equal((await (await call('/api/notes', 'GET', undefined, alice)).json()).notes[0].id, note.id);
    assert.equal((await call('/api/notes', 'POST', { body: 'x'.repeat(2001) }, alice)).status, 400);
    // Direct SQL proves RLS works even if an application query forgets its owner predicate.
    assert.equal((await pool.query('SELECT * FROM app.notes')).rows.length, 0);
    assert.equal((await asUser(pool, bobSession.user.id, client => client.query('SELECT * FROM app.notes'))).rows.length, 0);
    await assert.rejects(asUser(pool, bobSession.user.id, client => client.query('INSERT INTO app.notes(id,user_id,body) VALUES($1,$2,$3)', ['11111111-1111-4111-8111-111111111111', aliceSession.user.id, 'Forbidden'])), /row-level security/);
    assert.equal((await pool.query("SELECT nullif(current_setting('app.current_user_id',true),'') AS context")).rows[0].context, null);
    assert.equal((await call(`/api/notes/${note.id}`, 'DELETE', undefined, alice)).status, 204);
    assert.ok((await pool.query('SELECT 1 FROM auth."rateLimit" LIMIT 1')).rowCount);
    assert.equal((await call('/api/auth/sign-out', 'POST', undefined, alice)).status, 200);
    assert.equal((await call('/api/notes', 'GET', undefined, alice)).status, 401);
    const aliceAgain = await signIn('alice@example.test');
    assert.equal((await call('/api/auth/request-password-reset', 'POST', { email: 'alice@example.test', redirectTo: `${appOrigin}/account/reset-password` })).status, 200);
    await mailer.drain();
    const resetMail = mail.findLast(message => message.to === 'alice@example.test' && message.subject === 'Reset your password');
    assert.ok(resetMail);
    const resetLink = /https?:\/\/\S+/.exec(resetMail.text)?.[0];
    assert.ok(resetLink);
    const resetRedirect = await fetch(resetLink, { redirect: 'manual' });
    const destination = new URL(resetRedirect.headers.get('Location')!);
    assert.equal(destination.origin, appOrigin);
    const token = destination.searchParams.get('token');
    assert.ok(token);
    const newPassword = 'Another strong test password 456!';
    assert.equal((await call('/api/auth/reset-password', 'POST', { token, newPassword })).status, 200);
    assert.equal((await call('/api/auth/get-session', 'GET', undefined, aliceAgain)).status, 200);
    assert.equal(await (await call('/api/auth/get-session', 'GET', undefined, aliceAgain)).json(), null);
    assert.equal((await call('/api/notes', 'GET', undefined, aliceAgain)).status, 401);
    assert.equal((await call('/api/auth/reset-password', 'POST', { token, newPassword })).status, 400);
    assert.equal((await call('/api/auth/request-password-reset', 'POST', { email: 'bob@example.test', redirectTo: `${appOrigin}/account/reset-password` })).status, 200);
    await mailer.drain();
    const bobReset = mail.findLast(message => message.to === 'bob@example.test' && message.subject === 'Reset your password');
    const bobLink = /https?:\/\/\S+/.exec(bobReset!.text)?.[0];
    assert.ok(bobLink);
    const bobRedirect = await fetch(bobLink, { redirect: 'manual' });
    const expiredToken = new URL(bobRedirect.headers.get('Location')!).searchParams.get('token');
    assert.ok(expiredToken);
    await pool.query('UPDATE auth.verification SET "expiresAt"=now()-interval \'1 second\' WHERE value=$1', [bobSession.user.id]);
    assert.equal((await call('/api/auth/reset-password', 'POST', { token: expiredToken, newPassword })).status, 400);
    await delay(10_100);
    assert.equal((await call('/api/auth/sign-in/email', 'POST', { email: 'alice@example.test', password })).status, 401);
    const changed = await signIn('alice@example.test', newPassword);
    await pool.query('UPDATE auth.session SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1', [aliceSession.user.id]);
    assert.equal((await call('/api/notes', 'GET', undefined, changed)).status, 401);
    assert.equal((await call('/api/notes', 'GET', undefined, bob)).status, 200);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await mailer.drain(); mailer.close(); await pool.end(); await pg.close();
  }
});
