/**
 * Site-wide access-code gate (Pages Functions middleware).
 *
 * Runs in front of every route including static assets under /simcanvas/.
 * Visitors without a valid cookie get a minimal login page; submitting the
 * correct access code sets an HttpOnly signed cookie valid for 30 days.
 *
 * Required environment variables (set per Pages project, Production):
 *   AUTH_CODE_HASH — lowercase hex SHA-256 of the access code
 *   AUTH_SECRET    — random string used to sign the cookie (HMAC key)
 *
 * Generate locally:
 *   printf 'my-code' | shasum -a 256        # AUTH_CODE_HASH
 *   openssl rand -hex 32                    # AUTH_SECRET
 */

const COOKIE_NAME = 'sf_gate';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const LOGIN_PATH = '/__auth';

const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, message: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function getCookie(request: Request, name: string): string | null {
    for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
        const [key, ...rest] = part.trim().split('=');
        if (key === name) return rest.join('=');
    }
    return null;
}

function loginPage(error: boolean): Response {
    const message = error
        ? '<p class="error">授权码不正确，请重试</p>'
        : '<p>本站仅限授权访问，请输入授权码</p>';
    return new Response(
        `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Spark Flow · 访问验证</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0D1117; color: #F0F6FC;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .card {
    width: min(360px, 90vw); padding: 40px 32px; border-radius: 20px;
    background: #111827; border: 1px solid #30363D;
    box-shadow: 0 24px 50px rgba(0,0,0,0.45); text-align: center;
  }
  h1 { font-size: 22px; margin-bottom: 8px;
       background: linear-gradient(90deg, #22D3EE, #60A5FA, #818CF8);
       -webkit-background-clip: text; background-clip: text; color: transparent; }
  p { font-size: 13px; color: #94A3B8; margin-bottom: 24px; }
  p.error { color: #F87171; }
  input {
    width: 100%; padding: 12px 14px; border-radius: 10px; font-size: 16px;
    border: 1px solid #30363D; background: #0D1117; color: #F0F6FC;
    text-align: center; letter-spacing: 2px; outline: none; margin-bottom: 16px;
  }
  input:focus { border-color: #22D3EE; }
  button {
    width: 100%; padding: 12px; border: none; border-radius: 10px; cursor: pointer;
    font-size: 15px; font-weight: 600; color: #fff;
    background: linear-gradient(90deg, #0891B2, #0EA5E9);
    transition: filter 0.2s;
  }
  button:hover { filter: brightness(1.15); }
</style>
</head>
<body>
  <div class="card">
    <h1>Spark Flow</h1>
    ${message}
    <form method="POST" action="${LOGIN_PATH}">
      <input type="password" name="code" placeholder="授权码" autofocus autocomplete="off" required>
      <button type="submit">进入</button>
    </form>
  </div>
</body>
</html>`,
        { status: error ? 401 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
    );
}

export const onRequest = async (context: { request: Request; env: Record<string, string | undefined>; next: () => Promise<Response> }) => {
    const { request, env, next } = context;
    const url = new URL(request.url);

    const codeHash = env.AUTH_CODE_HASH ?? '';
    const secret = env.AUTH_SECRET ?? '';
    // No secrets configured at all (e.g. local dev): bypass the gate.
    // Partial configuration is a deploy mistake: deny everything so the
    // misconfiguration is noticed instead of silently serving the site.
    if (!codeHash && !secret) return next();
    if (!codeHash || !secret) {
        return new Response('auth gate misconfigured: set both AUTH_CODE_HASH and AUTH_SECRET', { status: 500 });
    }

    const expectedToken = await hmacHex(secret, 'grant');

    if (url.pathname === LOGIN_PATH) {
        if (request.method !== 'POST') return Response.redirect(url.origin + '/', 303);
        const form = await request.formData();
        const code = String(form.get('code') ?? '');
        const ok = timingSafeEqual(await sha256Hex(code), codeHash);
        if (!ok) return loginPage(true);
        // Response.redirect() returns immutable headers, so build the 303 by hand
        // to be able to attach Set-Cookie.
        return new Response(null, {
            status: 303,
            headers: {
                Location: '/',
                'Set-Cookie': `${COOKIE_NAME}=${expectedToken}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
            },
        });
    }

    const token = getCookie(request, COOKIE_NAME);
    if (token && timingSafeEqual(token, expectedToken)) return next();
    return loginPage(false);
};
