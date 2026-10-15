/** Executable teaching resources live on a different origin from accounts. */
export function parseContentOrigin(value: string | undefined, production: boolean): string | null {
  if (!value?.trim()) return null;
  const url = new URL(value.trim());
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
    || url.hostname.includes('*')
    || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && !production))) {
    throw new Error('The content URL must be an HTTPS origin.');
  }
  return url.origin;
}

export const contentOrigin = parseContentOrigin(import.meta.env.VITE_CONTENT_BASE_URL, import.meta.env.PROD);

export function contentUrl(resourcePath: string, origin = contentOrigin): string {
  if (/^https?:\/\//.test(resourcePath)) return resourcePath;
  const url = new URL(resourcePath, 'https://resources.invalid');
  if (resourcePath.includes('\\') || url.origin !== 'https://resources.invalid'
    || !/^\/(courseware|simcanvas|rating|images)\//.test(url.pathname)) {
    throw new Error('Invalid teaching resource path.');
  }
  return origin ? new URL(`${url.pathname}${url.search}${url.hash}`, origin).href : resourcePath;
}

/** Own-origin storage is safe only after resources were moved off the app origin. */
export function contentSandbox(src: string, capabilities = 'allow-scripts', appOrigin = window.location.origin, resourceOrigin = contentOrigin): string {
  if (resourceOrigin && resourceOrigin !== appOrigin && new URL(src, appOrigin).origin === resourceOrigin) {
    return `${capabilities} allow-same-origin`;
  }
  return capabilities;
}
