import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { onRequest } from '../../functions/_middleware.ts';

const ORIGIN = 'https://example.test';
const CODE = 'local-test-access-code';
const MAX_AGE = 60 * 60 * 24 * 30;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const env = { AUTH_CODE_HASH: hash(CODE), AUTH_SECRET: 'local-test-key-at-least-32-characters-long', AUTH_GATE_ENABLED: 'true' };

test('separate protected resources allow only the configured app to embed and read them', async () => {
    const appOrigin = 'https://lab.example.test';
    const settings = { ...env, AUTH_FRAME_ORIGIN: appOrigin };
    const result = await request('/rating/manifest.json', { headers: { Cookie: await cookie(), Origin: appOrigin } }, settings);
    assert.equal(result.nextCount, 1);
    assert.equal(result.response.headers.get('X-Frame-Options'), null);
    assert.equal(result.response.headers.get('Content-Security-Policy'), `frame-ancestors 'self' ${appOrigin}`);
    assert.equal(result.response.headers.get('Access-Control-Allow-Origin'), appOrigin);
    assert.equal(result.response.headers.get('Access-Control-Allow-Credentials'), 'true');
    const other = await request('/rating/manifest.json', { headers: { Cookie: await cookie(), Origin: 'https://evil.test' } }, settings);
    assert.equal(other.response.headers.get('Access-Control-Allow-Origin'), null);
    const blocked = await request('/rating/manifest.json', { headers: { Origin: appOrigin, Accept: 'application/json' } }, settings);
    assert.equal(blocked.response.status, 401);
    assert.equal(blocked.nextCount, 0);
    assert.equal(blocked.response.headers.get('Access-Control-Allow-Origin'), appOrigin);
    const login = await request('/__auth', {}, settings);
    assert.equal(login.response.headers.get('X-Frame-Options'), 'DENY');
    assert.match(login.response.headers.get('Content-Security-Policy') ?? '', /frame-ancestors 'none'/);
    const forgedLogin = await request('/__auth', { ...form(), headers: { Origin: appOrigin } }, settings);
    assert.equal(forgedLogin.response.status, 403);
});

test('resource frame configuration fails closed and cannot enable foreign-origin writes', async () => {
    for (const origin of ['*', 'https://*.example.test', 'http://lab.example.test', 'https://lab.example.test/', 'https://user:password@lab.example.test']) {
        const result = await request('/', {}, { ...env, AUTH_FRAME_ORIGIN: origin });
        assert.equal(result.response.status, 503);
        assert.equal(result.nextCount, 0);
    }
    const settings = { ...env, AUTH_FRAME_ORIGIN: 'https://lab.example.test' };
    const permitted = await request('/rating/manifest.json', { method: 'OPTIONS', headers: { Origin: settings.AUTH_FRAME_ORIGIN, 'Access-Control-Request-Method': 'GET' } }, settings);
    assert.equal(permitted.response.status, 204);
    assert.equal(permitted.nextCount, 0);
    const mutation = await request('/rating/manifest.json', { method: 'OPTIONS', headers: { Origin: settings.AUTH_FRAME_ORIGIN, 'Access-Control-Request-Method': 'POST' } }, settings);
    assert.equal(mutation.response.status, 403);
});

test('account pages hide one-time email tokens from subresource referrers', async () => {
    const result = await request('/account/reset-password?token=test-only', { headers: { Cookie: await cookie() } });
    assert.equal(result.nextCount, 1);
    assert.equal(result.response.headers.get('Referrer-Policy'), 'no-referrer');
});

async function request(path = '/', init: RequestInit = {}, settings: Record<string, string | undefined> = env) {
    let nextCount = 0;
    const response = await onRequest({
        request: new Request(`${ORIGIN}${path}`, init),
        env: settings,
        next: async () => {
            nextCount += 1;
            return new Response('protected content', {
                headers: { 'Cache-Control': 'public, max-age=3600', Vary: 'Accept-Encoding' },
            });
        },
    });
    return { response, nextCount };
}

function form(fields: Record<string, string> = { code: CODE }): RequestInit {
    return { method: 'POST', headers: { Origin: ORIGIN }, body: new URLSearchParams(fields) };
}

async function cookie() {
    const { response } = await request('/__auth', form());
    assert.equal(response.status, 303);
    const header = response.headers.get('Set-Cookie');
    assert.ok(header);
    return header.split(';')[0];
}

test('keeps the existing public mode optional, but explicit protection fails closed', async () => {
    for (const settings of [{}, { AUTH_GATE_ENABLED: 'false' }]) {
        const result = await request('/', {}, settings);
        assert.equal(result.nextCount, 1);
        assert.equal(await result.response.text(), 'protected content');
    }
    for (const settings of [
        { AUTH_GATE_ENABLED: 'true' },
        { AUTH_CODE_HASH: env.AUTH_CODE_HASH },
        { AUTH_SECRET: env.AUTH_SECRET },
        { ...env, AUTH_GATE_ENABLED: 'false' },
        { ...env, AUTH_GATE_ENABLED: 'invalid' },
        { ...env, AUTH_CODE_HASH: 'invalid-hash' },
        { ...env, AUTH_SECRET: 'short-key' },
    ]) {
        const result = await request('/', {}, settings);
        assert.equal(result.nextCount, 0);
        assert.equal(result.response.status, 503);
        assert.match(result.response.headers.get('Cache-Control') ?? '', /no-store/);
    }
});

test('protects static paths with an accessible English form and safe escaped return path', async () => {
    const { response, nextCount } = await request('/simcanvas/example/?mode=lesson&value=%22');
    assert.equal(nextCount, 0);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Security-Policy') ?? '', /form-action 'self'/);
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    const html = await response.text();
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<label for="code">Access code<\/label>/);
    assert.match(html, /name="returnTo" value="\/simcanvas\/example\/\?mode=lesson&amp;value=%22"/);
});

test('incorrect codes stay denied with an accessible error and no cookie', async () => {
    const { response, nextCount } = await request('/__auth', form({ code: 'incorrect' }));
    assert.equal(response.status, 401);
    assert.equal(nextCount, 0);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.match(await response.text(), /role="alert"/);
});

test('successful login issues distinct signed cookies and returns to the requested local page', async () => {
    const { response } = await request('/__auth', form({ code: CODE, returnTo: '/experiment/pendulum?mode=lesson' }));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('Location'), '/experiment/pendulum?mode=lesson');
    const header = response.headers.get('Set-Cookie');
    assert.ok(header);
    assert.match(header, /^sf_gate=v1\./);
    assert.match(header, /HttpOnly; Secure; SameSite=Lax/);
    assert.match(header, new RegExp(`Max-Age=${MAX_AGE}`));
    const firstCookie = header.split(';')[0];
    assert.notEqual(firstCookie, await cookie());
    const granted = await request('/simcanvas/example/', { headers: { Cookie: firstCookie } });
    assert.equal(granted.nextCount, 1);
    assert.equal(await granted.response.text(), 'protected content');
    assert.equal(granted.response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(granted.response.headers.get('Vary'), 'Accept-Encoding, Cookie');
    assert.equal(granted.response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
});

test('never redirects login to another origin or back to an authentication action', async () => {
    for (const returnTo of ['https://attacker.test', '//attacker.test', '/\\attacker.test', '/__auth/logout', '/%5c%5cattacker.test']) {
        const { response } = await request('/__auth', form({ code: CODE, returnTo }));
        const destination = response.headers.get('Location');
        assert.ok(destination);
        assert.equal(new URL(destination, ORIGIN).origin, ORIGIN);
        assert.ok(!destination.startsWith('/__auth'));
    }
});

test('rejects old perpetual cookies, tampered tokens, duplicate cookies, and both credential rotations', async () => {
    const validCookie = await cookie();
    const oldToken = createHmac('sha256', env.AUTH_SECRET).update('grant').digest('hex');
    const tampered = `${validCookie.slice(0, -1)}${validCookie.endsWith('0') ? '1' : '0'}`;
    for (const supplied of [`sf_gate=${oldToken}`, tampered, `${validCookie}; ${validCookie}`]) {
        assert.equal((await request('/', { headers: { Cookie: supplied } })).nextCount, 0);
    }
    for (const settings of [
        { ...env, AUTH_CODE_HASH: hash('rotated-code') },
        { ...env, AUTH_SECRET: 'rotated-signing-key-at-least-32-characters-long' },
    ]) {
        assert.equal((await request('/', { headers: { Cookie: validCookie } }, settings)).nextCount, 0);
    }
});

test('enforces the 30-day expiration on the server even if the cookie is manually replayed', async (t) => {
    const issuedAt = 1_800_000_000_000;
    const clock = t.mock.method(Date, 'now', () => issuedAt);
    const validCookie = await cookie();
    clock.mock.mockImplementation(() => issuedAt + (MAX_AGE - 1) * 1000);
    assert.equal((await request('/', { headers: { Cookie: validCookie } })).nextCount, 1);
    clock.mock.mockImplementation(() => issuedAt + MAX_AGE * 1000);
    assert.equal((await request('/', { headers: { Cookie: validCookie } })).nextCount, 0);
    clock.mock.mockImplementation(() => issuedAt - 1000);
    assert.equal((await request('/', { headers: { Cookie: validCookie } })).nextCount, 0);
});

test('rejects missing and cross-origin origins for login and logout', async () => {
    for (const path of ['/__auth', '/__auth/logout']) {
        for (const origin of [undefined, 'https://attacker.test', 'null']) {
            const { response } = await request(path, {
                method: 'POST', headers: origin ? { Origin: origin } : {}, body: new URLSearchParams({ code: CODE }),
            });
            assert.equal(response.status, 403);
            assert.equal(response.headers.get('Set-Cookie'), null);
        }
    }
});

test('malformed forms and oversized bodies return controlled errors', async () => {
    const cases: Array<{ init: RequestInit; status: number }> = [
        { init: { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' }, body: CODE }, status: 415 },
        { init: form({}), status: 400 },
        { init: form({ code: 'x'.repeat(257) }), status: 400 },
        { init: form({ code: 'x'.repeat(4097) }), status: 413 },
        { init: { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `code=${CODE}&code=${CODE}` }, status: 400 },
        { init: { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new Uint8Array([255]) }, status: 400 },
        { init: { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': '4097' }, body: `code=${CODE}` }, status: 413 },
    ];
    for (const { init, status } of cases) {
        const { response } = await request('/__auth', init);
        assert.equal(response.status, status);
        assert.equal(response.headers.get('Set-Cookie'), null);
    }
});

test('logout requires POST and clears this browser cookie', async () => {
    const get = await request('/__auth/logout');
    assert.equal(get.response.status, 405);
    assert.equal(get.response.headers.get('Allow'), 'POST');
    const { response } = await request('/__auth/logout', { method: 'POST', headers: { Origin: ORIGIN } });
    assert.equal(response.status, 303);
    assert.match(response.headers.get('Set-Cookie') ?? '', /^sf_gate=; Max-Age=0;/);
    assert.match(response.headers.get('Cache-Control') ?? '', /no-store/);
});

test('API consumers receive an unauthorized JSON response instead of an HTML success', async () => {
    for (const [path, headers] of [['/api/example', {}], ['/', { Accept: 'application/json' }]] as const) {
        const { response, nextCount } = await request(path, { headers });
        assert.equal(response.status, 401);
        assert.equal(nextCount, 0);
        assert.deepEqual(await response.json(), { error: 'unauthorized' });
    }
});
