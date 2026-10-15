export type AccountConfig =
  | { status: 'disabled' }
  | { status: 'invalid' }
  | { status: 'ready'; apiURL: string };

/** This public setting contains an API origin, never account secrets. */
export function readAccountConfig(value: string | undefined, development: boolean): AccountConfig {
  if (!value?.trim()) return { status: 'disabled' };
  try {
    if (value.includes('\\') || [...value].some(character => character.charCodeAt(0) < 32)) return { status: 'invalid' };
    const url = new URL(value.trim());
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return { status: 'invalid' };
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (loopback) {
      const allowed = development && (url.origin === 'http://localhost:3100' || url.origin === 'http://127.0.0.1:3100');
      return allowed ? { status: 'ready', apiURL: url.origin } : { status: 'invalid' };
    }
    return url.protocol === 'https:' ? { status: 'ready', apiURL: url.origin } : { status: 'invalid' };
  } catch {
    return { status: 'invalid' };
  }
}

export const accountConfig = readAccountConfig(import.meta.env.VITE_ACCOUNT_API_URL, import.meta.env.DEV);
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 80;
export const NOTE_MAX_LENGTH = 2000;

export function accountCallback(path: 'verify-email' | 'reset-password'): string {
  return new URL(`/account/${path}`, window.location.origin).href;
}

export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return 'Use a password between 12 and 128 characters.';
  }
  return password === confirmation ? null : 'The passwords do not match.';
}
