import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { createMailer } from '../src/mail.js';

const env = { NODE_ENV: 'development', AUTH_BASE_URL: 'http://127.0.0.1:3100', APP_ORIGIN: 'http://127.0.0.1:5173',
  AUTH_SECRET: 'config-test-only-secret-at-least-32-characters', DATABASE_URL: 'postgresql://app@127.0.0.1/accounts',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_FROM: 'accounts@example.test' };

test('configuration fails closed and production forbids migration credentials and mail collectors', () => {
  assert.equal(loadConfig(env).port, 3100);
  for (const override of [{ NODE_ENV: undefined }, { AUTH_SECRET: '' }, { APP_ORIGIN: 'https://*.example.com' }, { SMTP_HOST: '' }, { DATABASE_POOL_MAX: '1000' }, { NODE_ENV: 'production' }]) {
    assert.throws(() => loadConfig({ ...env, ...override }));
  }
  const production = { ...env, NODE_ENV: 'production', AUTH_BASE_URL: 'https://api.example.com', APP_ORIGIN: 'https://app.example.com', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_USER: 'accounts', SMTP_PASSWORD: 'test-password' };
  const config = loadConfig(production);
  assert.equal(loadConfig({ ...production, APP_ORIGIN: 'https://app.foo.co.uk', AUTH_BASE_URL: 'https://api.foo.co.uk' }).mode, 'production');
  assert.equal(loadConfig({ ...production, APP_ORIGIN: 'https://one.pages.dev', AUTH_BASE_URL: 'https://one.pages.dev' }).mode, 'production');
  for (const origins of [
    { APP_ORIGIN: 'https://app.pages.dev', AUTH_BASE_URL: 'https://api.heyflint.com' },
    { APP_ORIGIN: 'https://app.foo.co.uk', AUTH_BASE_URL: 'https://api.other.co.uk' },
    { APP_ORIGIN: 'https://one.pages.dev', AUTH_BASE_URL: 'https://two.pages.dev' },
    { APP_ORIGIN: 'https://localhost', AUTH_BASE_URL: 'https://localhost' },
    { APP_ORIGIN: 'https://127.0.0.1', AUTH_BASE_URL: 'https://127.0.0.1' },
  ]) assert.throws(() => loadConfig({ ...production, ...origins }));
  assert.throws(() => loadConfig({ ...production, MIGRATION_DATABASE_URL: env.DATABASE_URL }));
  assert.throws(() => createMailer(config, async () => undefined));
});
