/**
 * Optional site-wide shared access-code gate, not individual user authentication.
 *
 * AUTH_CODE_HASH: lowercase SHA-256 hex of the shared access code.
 * AUTH_SECRET: random signing key of at least 32 characters.
 * AUTH_GATE_ENABLED: set to "true" in protected deployments to fail closed when
 * secrets are missing. With no flag and no secrets, the gate remains disabled
 * for backwards compatibility. "false" is only valid when both secrets are absent.
 * AUTH_FRAME_ORIGIN: optional exact HTTPS app origin for a separate protected
 * resource project. Allows that origin to embed/read resources, never to submit
 * access-code forms or share individual account cookies.
 *
 * Tokens expire on the server after 30 days. Rotating either secret or access-code
 * hash revokes all tokens. Logout clears this browser's cookie; individual token
 * revocation and distributed rate limiting require an external session service.
 */

const COOKIE_NAME = 'sf_gate';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const LOGIN_PATH = '/__auth';
const LOGOUT_PATH = '/__auth/logout';
const MAX_BODY_BYTES = 4096;
const MAX_CODE_LENGTH = 256;
const encoder = new TextEncoder();

interface GateContext {
    request: Request;
    env: Record<string, string | undefined>;
    next: () => Promise<Response>;
}

function toHex(bytes: Uint8Array): string {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

async function sha256Hex(input: string): Promise<string> {
    return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input))));
}

function signingKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
    );
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

async function issueToken(key: CryptoKey, codeHash: string): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const payload = `v1.${issuedAt}.${issuedAt + COOKIE_MAX_AGE}.${nonce}`;
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${codeHash}.${payload}`));
    return `${payload}.${toHex(new Uint8Array(signature))}`;
}

async function validToken(token: string, key: CryptoKey, codeHash: string): Promise<boolean> {
    const match = /^v1\.(\d{1,12})\.(\d{1,12})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
    if (!match) return false;
    const issuedAt = Number(match[1]);
    const expiresAt = Number(match[2]);
    const now = Math.floor(Date.now() / 1000);
    if (issuedAt > now || expiresAt <= now || expiresAt - issuedAt !== COOKIE_MAX_AGE) return false;
    const payload = token.slice(0, token.lastIndexOf('.'));
    return crypto.subtle.verify('HMAC', key, fromHex(match[4]), encoder.encode(`${codeHash}.${payload}`));
}

function getCookie(request: Request): string | null {
    const matches = (request.headers.get('Cookie') ?? '').split(';')
        .map((part) => part.trim())
        .filter((part) => part.startsWith(`${COOKIE_NAME}=`));
    // Reject duplicate cookies instead of allowing ambiguous path/domain values.
    return matches.length === 1 ? matches[0].slice(COOKIE_NAME.length + 1) : null;
}

function protectedResponse(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    const vary = headers.get('Vary');
    if (!vary?.split(',').some((value) => value.trim().toLowerCase() === 'cookie')) {
        headers.set('Vary', vary ? `${vary}, Cookie` : 'Cookie');
    }
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function failure(message: string, status: number, headers?: Record<string, string>): Response {
    return protectedResponse(new Response(message, {
        status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers },
    }));
}

function localReturnPath(value: string | null, origin: string): string {
    if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
    const destination = new URL(value, origin);
    if (destination.origin !== origin || destination.pathname.startsWith(LOGIN_PATH)) return '/';
    return `${destination.pathname}${destination.search}${destination.hash}`;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character] ?? character));
}

function loginPage(returnPath: string, error = false): Response {
    const response = new Response(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Access required</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0D1117; color: #F0F6FC;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .card {
    width: min(380px, 90vw); padding: 40px 32px; border-radius: 20px;
    background: #111827; border: 1px solid #30363D;
    box-shadow: 0 24px 50px rgba(0,0,0,0.45);
  }
  h1 { font-size: 22px; margin-bottom: 12px; }
  p { font-size: 14px; color: #94A3B8; margin-bottom: 24px; line-height: 1.5; }
  p.error { color: #FCA5A5; }
  label { display: block; margin-bottom: 8px; font-size: 14px; }
  input {
    width: 100%; padding: 12px 14px; border-radius: 10px; font-size: 16px;
    border: 1px solid #475569; background: #0D1117; color: #F0F6FC; margin-bottom: 16px;
  }
  input:focus-visible, button:focus-visible { outline: 2px solid #22D3EE; outline-offset: 3px; }
  button {
    width: 100%; padding: 12px; border: none; border-radius: 10px; cursor: pointer;
    font-size: 15px; font-weight: 600; color: #fff;
    background: linear-gradient(90deg, #0369A1, #0284C7);
    box-shadow: 0 8px 20px rgba(3,105,161,0.3); transition: filter 0.2s;
  }
  button:hover { filter: brightness(1.15); }
  @media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
</head>
<body>
  <main class="card">
    <h1>Access required</h1>
    <p id="message"${error ? ' class="error" role="alert"' : ''}>${error ? 'The access code is incorrect. Please try again.' : 'Enter your access code to continue.'}</p>
    <form method="POST" action="${LOGIN_PATH}">
      <input type="hidden" name="returnTo" value="${escapeHtml(returnPath)}">
      <label for="code">Access code</label>
      <input id="code" type="password" name="code" autofocus autocomplete="current-password" aria-describedby="message"${error ? ' aria-invalid="true"' : ''} maxlength="${MAX_CODE_LENGTH}" required>
      <button type="submit">Continue</button>
    </form>
  </main>
</body>
</html>`, {
        status: error ? 401 : 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        },
    });
    const protectedPage = protectedResponse(response);
    protectedPage.headers.set('X-Frame-Options', 'DENY');
    return protectedPage;
}

async function readForm(request: Request): Promise<URLSearchParams | Response> {
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
        return failure('Use a URL-encoded form.', 415);
    }
    const length = request.headers.get('Content-Length');
    if (length && Number(length) > MAX_BODY_BYTES) return failure('Request body is too large.', 413);
    const reader = request.body?.getReader();
    if (!reader) return failure('A form body is required.', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BODY_BYTES) {
                await reader.cancel();
                return failure('Request body is too large.', 413);
            }
            chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
        return failure('The form body is invalid.', 400);
    } finally {
        reader.releaseLock();
    }
}

export const onRequest = async ({ request, env, next }: GateContext): Promise<Response> => {
    const url = new URL(request.url);
    const codeHash = env.AUTH_CODE_HASH ?? '';
    const secret = env.AUTH_SECRET ?? '';
    const enabled = env.AUTH_GATE_ENABLED;
    if (enabled !== undefined && enabled !== 'true' && enabled !== 'false') {
        return failure('Access control is unavailable. Check the server configuration.', 503);
    }
    if (!codeHash && !secret && enabled !== 'true') return next();
    if (enabled === 'false' || !/^[a-f0-9]{64}$/.test(codeHash) || secret.trim().length < 32) {
        return failure('Access control is unavailable. Check the server configuration.', 503);
    }

    const frameSetting = env.AUTH_FRAME_ORIGIN;
    let frameOrigin: string | undefined;
    if (frameSetting !== undefined) {
        try {
            const configured = new URL(frameSetting);
            if (configured.protocol !== 'https:' || configured.origin !== frameSetting
                || configured.username || configured.password || configured.hostname.includes('*')) throw new Error('Invalid frame origin.');
            frameOrigin = configured.origin;
        } catch {
            return failure('Resource access is unavailable. Check the server configuration.', 503);
        }
    }
    const resourceResponse = (response: Response): Response => {
        const result = protectedResponse(response);
        // Email one-time tokens can arrive in the account page URL before React loads.
        if (url.pathname === '/account' || url.pathname.startsWith('/account/')) result.headers.set('Referrer-Policy', 'no-referrer');
        if (frameOrigin) {
            result.headers.delete('X-Frame-Options');
            const directives = (result.headers.get('Content-Security-Policy') ?? '').split(';')
                .filter(directive => directive.trim() && !/^frame-ancestors\s/i.test(directive.trim()));
            result.headers.set('Content-Security-Policy', [...directives, `frame-ancestors 'self' ${frameOrigin}`].join('; '));
            result.headers.append('Vary', 'Origin');
            if (request.headers.get('Origin') === frameOrigin) {
                result.headers.set('Access-Control-Allow-Origin', frameOrigin);
                result.headers.set('Access-Control-Allow-Credentials', 'true');
            }
        }
        return result;
    };
    if (frameOrigin && request.method === 'OPTIONS' && !url.pathname.startsWith(LOGIN_PATH)) {
        if (request.headers.get('Origin') !== frameOrigin
            || !['GET', 'HEAD'].includes(request.headers.get('Access-Control-Request-Method') ?? '')) {
            return failure('The resource request is not allowed.', 403);
        }
        return resourceResponse(new Response(null, {
            status: 204,
            headers: { 'Access-Control-Allow-Methods': 'GET, HEAD' },
        }));
    }

    if (url.pathname === LOGOUT_PATH) {
        if (request.method !== 'POST') return failure('Use POST to sign out.', 405, { Allow: 'POST' });
        if (request.headers.get('Origin') !== url.origin) return failure('The request origin is not allowed.', 403);
        return protectedResponse(new Response(null, {
            status: 303,
            headers: {
                Location: '/',
                'Set-Cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
            },
        }));
    }

    const key = await signingKey(secret);
    if (url.pathname === LOGIN_PATH) {
        const returnPath = localReturnPath(url.searchParams.get('returnTo'), url.origin);
        if (request.method === 'GET' || request.method === 'HEAD') return loginPage(returnPath);
        if (request.method !== 'POST') return failure('Use POST to submit an access code.', 405, { Allow: 'GET, HEAD, POST' });
        if (request.headers.get('Origin') !== url.origin) return failure('The request origin is not allowed.', 403);
        const form = await readForm(request);
        if (form instanceof Response) return form;
        const destination = localReturnPath(form.get('returnTo'), url.origin);
        const code = form.get('code');
        if (form.getAll('code').length !== 1 || !code || code.length > MAX_CODE_LENGTH) {
            return failure('Provide one valid access code.', 400);
        }
        if (!timingSafeEqual(await sha256Hex(code), codeHash)) return loginPage(destination, true);
        return protectedResponse(new Response(null, {
            status: 303,
            headers: {
                Location: destination,
                'Set-Cookie': `${COOKIE_NAME}=${await issueToken(key, codeHash)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
            },
        }));
    }

    const token = getCookie(request);
    if (token && await validToken(token, key, codeHash)) return resourceResponse(await next());
    if (url.pathname === '/api' || url.pathname.startsWith('/api/') || request.headers.get('Accept')?.includes('application/json')) {
        return resourceResponse(Response.json({ error: 'unauthorized' }, { status: 401 }));
    }
    return loginPage(localReturnPath(`${url.pathname}${url.search}`, url.origin));
};
