import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { accountBuildOrigins, isolateAccountBuild, CONTENT_DIRECTORIES } from '../../scripts/account-build';

const env = { VITE_APP_ORIGIN: 'https://lab.example.test', VITE_ACCOUNT_API_URL: 'https://api.example.test', VITE_CONTENT_BASE_URL: 'https://content.example.test' };
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach(directory => fs.rmSync(directory, { recursive: true, force: true })));

it('requires separate trusted HTTPS origins when account support is enabled', () => {
  expect(accountBuildOrigins({})).toBeNull();
  expect(accountBuildOrigins(env)).toEqual({ app: env.VITE_APP_ORIGIN, api: env.VITE_ACCOUNT_API_URL, content: env.VITE_CONTENT_BASE_URL });
  for (const bad of [undefined, 'http://content.example.test', env.VITE_APP_ORIGIN, env.VITE_ACCOUNT_API_URL, 'https://api.example.test:8443', 'https://lab.example.test:8443', 'https://*.example.test', 'https://localhost', 'https://user:secret@content.example.test', 'https://content.example.test/path']) {
    expect(() => accountBuildOrigins({ ...env, VITE_CONTENT_BASE_URL: bad })).toThrow();
  }
});

it('checks registrable sites including country and private public suffixes', () => {
  expect(accountBuildOrigins({ VITE_APP_ORIGIN: 'https://app.product.co.uk', VITE_ACCOUNT_API_URL: 'https://api.product.co.uk', VITE_CONTENT_BASE_URL: 'https://content.product.co.uk' })).not.toBeNull();
  expect(() => accountBuildOrigins({ ...env, VITE_APP_ORIGIN: 'https://project.pages.dev' })).toThrow(/same HTTPS site/);
  expect(() => accountBuildOrigins({ VITE_APP_ORIGIN: 'https://app.first.co.uk', VITE_ACCOUNT_API_URL: 'https://api.second.co.uk', VITE_CONTENT_BASE_URL: 'https://content.first.co.uk' })).toThrow(/same HTTPS site/);
  expect(() => accountBuildOrigins({ VITE_APP_ORIGIN: 'https://app-project.pages.dev', VITE_ACCOUNT_API_URL: 'https://api-project.pages.dev', VITE_CONTENT_BASE_URL: 'https://content-project.pages.dev' })).toThrow(/same HTTPS site/);
});

it('removes every local executable resource directory and redirects old links', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'account-build-'));
  directories.push(output);
  fs.writeFileSync(path.join(output, 'index.html'), 'account application');
  fs.mkdirSync(path.join(output, 'assets'));
  fs.writeFileSync(path.join(output, 'assets', 'app.js'), 'application');
  for (const directory of CONTENT_DIRECTORIES) {
    fs.mkdirSync(path.join(output, directory));
    fs.writeFileSync(path.join(output, directory, 'lesson.html'), 'executable lesson');
  }
  isolateAccountBuild(output, accountBuildOrigins(env)!);
  for (const directory of CONTENT_DIRECTORIES) expect(fs.existsSync(path.join(output, directory))).toBe(false);
  expect(fs.existsSync(path.join(output, 'assets', 'app.js'))).toBe(true);
  expect(fs.readFileSync(path.join(output, '_redirects'), 'utf8')).toContain('/rating/* https://content.example.test/rating/:splat 302');
});

it('fails if a new unreviewed HTML location would remain on the account origin', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'account-build-'));
  directories.push(output);
  fs.writeFileSync(path.join(output, 'index.html'), 'application');
  fs.writeFileSync(path.join(output, 'uploaded.html'), 'executable upload');
  expect(() => isolateAccountBuild(output, accountBuildOrigins(env)!)).toThrow(/executable HTML/);
});
