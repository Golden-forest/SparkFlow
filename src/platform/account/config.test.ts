import { describe, expect, it } from 'vitest';
import { accountCallback, passwordProblem, readAccountConfig } from './config';

describe('account configuration', () => {
  it('leaves accounts disabled when the API is not configured', () => {
    expect(readAccountConfig(undefined, true)).toEqual({ status: 'disabled' });
    expect(readAccountConfig('  ', false)).toEqual({ status: 'disabled' });
  });

  it('accepts HTTPS origins and only the two explicit development API origins', () => {
    expect(readAccountConfig('https://lab-api.example.com/', false)).toEqual({ status: 'ready', apiURL: 'https://lab-api.example.com' });
    expect(readAccountConfig('http://localhost:3100', true)).toEqual({ status: 'ready', apiURL: 'http://localhost:3100' });
    expect(readAccountConfig('http://127.0.0.1:3100', true)).toEqual({ status: 'ready', apiURL: 'http://127.0.0.1:3100' });
  });

  it.each([
    'http://api.example.com', 'http://localhost:3101', 'http://[::1]:3100',
    'https://lab-api.example.com/api', 'https://lab-api.example.com?next=evil',
    'https://lab-api.example.com#secret', 'https://user:password@lab-api.example.com',
    '//lab-api.example.com', 'https://lab-api.example.com\\evil', 'https://lab-api.example.com\n',
  ])('rejects ambiguous or unsafe API URLs: %s', value => {
    expect(readAccountConfig(value, true)).toEqual({ status: 'invalid' });
  });

  it('rejects loopback APIs in production', () => {
    expect(readAccountConfig('http://localhost:3100', false)).toEqual({ status: 'invalid' });
    expect(readAccountConfig('http://127.0.0.1:3100', false)).toEqual({ status: 'invalid' });
    expect(readAccountConfig('https://localhost', false)).toEqual({ status: 'invalid' });
  });

  it('builds fixed local callbacks without accepting returnTo query parameters', () => {
    expect(accountCallback('verify-email')).toBe(`${window.location.origin}/account/verify-email`);
    expect(accountCallback('reset-password')).toBe(`${window.location.origin}/account/reset-password`);
  });

  it('matches the server password boundaries without silently trimming passwords', () => {
    expect(passwordProblem('x'.repeat(11), 'x'.repeat(11))).toMatch(/12 and 128/);
    expect(passwordProblem('x'.repeat(129), 'x'.repeat(129))).toMatch(/12 and 128/);
    expect(passwordProblem('x'.repeat(12), 'x'.repeat(12))).toBeNull();
    expect(passwordProblem('x'.repeat(128), 'x'.repeat(128))).toBeNull();
    expect(passwordProblem('  passphrase  ', 'passphrase')).toBe('The passwords do not match.');
  });
});
