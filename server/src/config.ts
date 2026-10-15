import { isIP } from 'node:net';
import { getDomain } from 'tldts';

export interface ServerConfig {
  mode: 'development' | 'test' | 'production';
  appName: string;
  port: number;
  authBaseURL: string;
  appOrigin: string;
  secret: string;
  databaseURL: string;
  appRole: string;
  poolMax: number;
  smtp: { host: string; port: number; secure: boolean; from: string; user?: string; password?: string };
}

function integer(value: string | undefined, fallback: number, max: number): number {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new Error('Invalid numeric server configuration.');
  return number;
}

function origin(value: string | undefined): string {
  if (!value) throw new Error('Explicit application and authentication origins are required.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hostname.includes('*')
    || url.pathname !== '/' || url.search || url.hash || value !== url.origin) {
    throw new Error('Configure exact origins without paths, credentials or wildcards.');
  }
  return url.origin;
}

export function databaseURL(value: string | undefined): string {
  if (!value) throw new Error('A PostgreSQL connection URL is required.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || url.pathname === '/') {
    throw new Error('Invalid PostgreSQL connection configuration.');
  }
  return value;
}

export function roleName(value: string | undefined): string {
  const name = value ?? 'sparkflow_app';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error('Invalid application database role.');
  return name;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const mode = env.NODE_ENV;
  if (!['development', 'test', 'production'].includes(mode ?? '')) throw new Error('Set NODE_ENV explicitly.');
  const appName = (env.APP_NAME ?? 'Application').trim();
  if (!appName || appName.length > 80) throw new Error('Invalid application name.');
  const authBaseURL = origin(env.AUTH_BASE_URL);
  const appOrigin = origin(env.APP_ORIGIN);
  const secret = env.AUTH_SECRET ?? '';
  if (secret.trim().length < 32) throw new Error('A random authentication secret of at least 32 characters is required.');
  const secure = env.SMTP_SECURE === 'true';
  if (env.SMTP_SECURE !== 'true' && env.SMTP_SECURE !== 'false') throw new Error('Set SMTP_SECURE explicitly.');
  const smtp = {
    host: env.SMTP_HOST ?? '', port: integer(env.SMTP_PORT, secure ? 465 : 587, 65535),
    secure, from: env.SMTP_FROM ?? '', user: env.SMTP_USER || undefined, password: env.SMTP_PASSWORD || undefined,
  };
  if (!smtp.host || !smtp.from || /[\r\n]/.test(smtp.from)) throw new Error('SMTP host and sender are required.');
  if (!!smtp.user !== !!smtp.password) throw new Error('Both SMTP credentials are required together.');
  if (mode === 'production') {
    if (![authBaseURL, appOrigin].every(value => value.startsWith('https://')) || !smtp.user || !smtp.password) {
      throw new Error('Production requires HTTPS origins and authenticated TLS email delivery.');
    }
    const appHost = new URL(appOrigin).hostname;
    const authHost = new URL(authBaseURL).hostname;
    if ([appHost, authHost].some(host => host === 'localhost' || host.endsWith('.localhost') || isIP(host.replace(/^\[|\]$/g, '')))) {
      throw new Error('Production requires public domain names.');
    }
    const appDomain = getDomain(appHost, { allowPrivateDomains: true });
    const authDomain = getDomain(authHost, { allowPrivateDomains: true });
    if (appHost !== authHost && (!appDomain || appDomain !== authDomain)) {
      throw new Error('Production application and authentication origins must share the same site.');
    }
    if (env.MIGRATION_DATABASE_URL) throw new Error('Do not give migration credentials to the application process.');
  } else if (![authBaseURL, appOrigin].every(value => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname))) {
    throw new Error('Non-production origins must use loopback hosts.');
  }
  return {
    mode: mode as ServerConfig['mode'], appName, port: integer(env.PORT, 3100, 65535), authBaseURL, appOrigin, secret,
    databaseURL: databaseURL(env.DATABASE_URL), appRole: roleName(env.DATABASE_APP_ROLE),
    poolMax: integer(env.DATABASE_POOL_MAX, 10, 30), smtp,
  };
}
