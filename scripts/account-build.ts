import fs from 'node:fs';
import path from 'node:path';
import { getDomain } from 'tldts';

export const CONTENT_DIRECTORIES = ['courseware', 'simcanvas', 'rating', 'images'] as const;

function sameSite(first: string, second: string): boolean {
  const a = new URL(first);
  const b = new URL(second);
  const domain = getDomain(a.hostname, { allowPrivateDomains: true });
  return a.protocol === b.protocol && !!domain && domain === getDomain(b.hostname, { allowPrivateDomains: true });
}

function httpsOrigin(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`${label} is required for an account-enabled production build.`);
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`${label} must be an HTTPS origin.`);
  }
  if (url.hostname.includes('*') || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(`${label} must use an explicit production hostname.`);
  }
  return url.origin;
}

export function accountBuildOrigins(env: Record<string, string | undefined>): { app: string; api: string; content: string } | null {
  if (!env.VITE_ACCOUNT_API_URL?.trim()) return null;
  const app = httpsOrigin(env.VITE_APP_ORIGIN, 'VITE_APP_ORIGIN');
  const api = httpsOrigin(env.VITE_ACCOUNT_API_URL, 'VITE_ACCOUNT_API_URL');
  const content = httpsOrigin(env.VITE_CONTENT_BASE_URL, 'VITE_CONTENT_BASE_URL');
  if ([app, api].some(origin => new URL(origin).hostname === new URL(content).hostname)) {
    throw new Error('Teaching resources require a separate hostname from the app and API; ports do not isolate cookies.');
  }
  if (!sameSite(app, api) || !sameSite(app, content)) {
    throw new Error('App, account API and protected resources must belong to the same HTTPS site for Lax cookies.');
  }
  return { app, api, content };
}

function htmlFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : /\.html?$/i.test(entry.name) ? [file] : [];
  });
}

/** Run after Vite copied public files, before an account artifact is deployable. */
export function isolateAccountBuild(outputDirectory: string, origins: { app: string; api: string; content: string }): void {
  for (const directory of CONTENT_DIRECTORIES) fs.rmSync(path.join(outputDirectory, directory), { recursive: true, force: true });
  const unexpected = htmlFiles(outputDirectory).filter((file) => path.relative(outputDirectory, file) !== 'index.html');
  if (unexpected.length) throw new Error('Account build contains additional executable HTML outside the resource bundle.');
  const redirectsPath = path.join(outputDirectory, '_redirects');
  const existing = fs.existsSync(redirectsPath) ? fs.readFileSync(redirectsPath, 'utf8') : '';
  const redirects = CONTENT_DIRECTORIES.map((directory) => `/${directory}/* ${origins.content}/${directory}/:splat 302`).join('\n');
  fs.writeFileSync(redirectsPath, `${redirects}\n${existing}`);
}
