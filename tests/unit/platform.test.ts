import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStorage } from '@/platform/browser-storage';
import { requestJson, RequestError } from '@/platform/request';
import { decodeResourceManifest } from '@/platform/resource-manifest';

afterEach(() => vi.unstubAllGlobals());

describe('browser preferences', () => {
  it('returns defaults and reports failed writes when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    expect(browserStorage.get('preference')).toBeNull();
    expect(browserStorage.set('preference', 'value')).toBe(false);
    expect(browserStorage.remove('preference')).toBe(false);
  });
});

describe('network boundary', () => {
  it('keeps request headers and decodes valid JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}', { headers: { 'Content-Type': 'Application/JSON; charset=utf-8' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(requestJson('/api', (value) => value, { headers: new Headers({ 'X-Request': 'test' }) })).resolves.toEqual({ ok: true });
    const headers = fetcher.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-Request')).toBe('test');
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('rejects HTML fallback and non-success responses instead of treating them as data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } })));
    await expect(requestJson('/api', (value) => value)).rejects.toBeInstanceOf(RequestError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(requestJson('/api', (value) => value)).rejects.toMatchObject({ status: 401 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/jsonp' } })));
    await expect(requestJson('/api', (value) => value)).rejects.toBeInstanceOf(RequestError);
  });

  it('passes cancellation through to fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(requestJson('/api', (value) => value, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('resource manifest validation', () => {
  it('preserves multilingual local resources and existing external gallery links', () => {
    const input = {
      courseware: [{ id: 'lesson', title: 'Lesson', path: '/courseware/中文课件/' }],
      simcanvas: [{ id: 'remote', title: 'Remote', path: 'https://example.com/shared/123' }],
      images: [],
    };
    expect(decodeResourceManifest(input)).toMatchObject({ ...input, images: [] });
  });

  it.each(['javascript:alert(1)', '//evil.invalid/page', '/simcanvas/../account', '/simcanvas/%2e%2e/account', 'https://user:password@example.com/'])('rejects unsafe resource paths: %s', (path) => {
    expect(() => decodeResourceManifest({ courseware: [], images: [], simcanvas: [{ id: 'x', title: 'x', path }] })).toThrow();
  });

  it('rejects malformed resource lists', () => {
    expect(() => decodeResourceManifest([])).toThrow();
    expect(() => decodeResourceManifest({})).toThrow();
    expect(() => decodeResourceManifest({ error: 'unavailable' })).toThrow();
    expect(() => decodeResourceManifest({ courseware: [], simcanvas: [], images: 'invalid' })).toThrow();
    expect(() => decodeResourceManifest({ courseware: [], simcanvas: [], images: [{ id: 1, title: 'x', path: '/images/x.png' }] })).toThrow();
  });
});
