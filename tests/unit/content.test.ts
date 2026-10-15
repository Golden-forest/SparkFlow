import { describe, expect, it } from 'vitest';
import { contentSandbox, contentUrl, parseContentOrigin } from '@/platform/content';

describe('isolated content origin', () => {
  it('keeps existing galleries usable and maps all resource paths to the isolated origin', () => {
    expect(contentUrl('/rating/cal/example.html', null)).toBe('/rating/cal/example.html');
    expect(contentUrl('/courseware/中文/', 'https://content.example.test')).toBe('https://content.example.test/courseware/%E4%B8%AD%E6%96%87/');
    expect(contentUrl('https://external.example.test/lesson', 'https://content.example.test')).toBe('https://external.example.test/lesson');
  });
  it.each(['/rating/../account', '//other.example.test/rating/x', '/rating/%2e%2e/account', '/\\other.example.test/rating/x'])('rejects a resource path escaping its directory: %s', (resource) => {
    expect(() => contentUrl(resource, 'https://content.example.test')).toThrow();
  });
  it('allows local development only and rejects malformed production origins', () => {
    expect(parseContentOrigin(undefined, true)).toBeNull();
    expect(parseContentOrigin('http://127.0.0.1:4176', false)).toBe('http://127.0.0.1:4176');
    for (const value of ['http://127.0.0.1:4176', 'https://user:secret@content.test', 'https://content.test/path', 'https://content.test?x=1']) {
      expect(() => parseContentOrigin(value, true)).toThrow();
    }
  });
  it('allows resource storage only for the configured independent origin', () => {
    const app = 'https://lab.example.test';
    const resource = 'https://content.example.test';
    expect(contentSandbox(`${resource}/rating/x.html`, 'allow-scripts', app, resource)).toBe('allow-scripts allow-same-origin');
    expect(contentSandbox('/rating/x.html', 'allow-scripts', app, resource)).toBe('allow-scripts');
    expect(contentSandbox('/rating/x.html', 'allow-scripts', app, app)).toBe('allow-scripts');
    expect(contentSandbox('https://external.test/x.html', 'allow-scripts', app, resource)).toBe('allow-scripts');
  });
});
