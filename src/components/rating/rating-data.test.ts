import { describe, expect, it } from 'vitest';
import { decodeRatingManifest, decodeRatingStore } from './rating-data';

describe('saved rating validation', () => {
  it('preserves valid partial records', () => {
    const store = { teacher1: { a1: { dims: { d3: 5, d4: 2 }, seconds: 12, d4Text: 'Evidence' } } };
    expect(decodeRatingStore(store)).toEqual(store);
    expect(decodeRatingStore({})).toEqual({});
  });

  it.each([null, [], { teacher1: null }, { teacher1: { a1: { dims: null, seconds: 0 } } },
    { teacher1: { a1: { dims: { d3: 6 }, seconds: 0 } } },
    { teacher1: { a1: { dims: {}, seconds: -1 } } }])('rejects corrupt saved records %j', value => {
    expect(() => decodeRatingStore(value)).toThrow('Invalid saved ratings.');
  });
});

describe('rating manifest validation', () => {
  const manifest = {
    version: 1,
    rateable: [{ id: 'a1', bg: 'Background' }],
    orders: { teacher1: ['a1'] },
    browse: [],
    cal: [{ n: 1, file: 'cal/a1.html', label: 'One', symptom: 'Evidence', goal: 'Target' }],
  };

  it('accepts valid rating assets', () => {
    expect(decodeRatingManifest(manifest)).toEqual(manifest);
  });

  it('rejects malformed responses and asset path traversal', () => {
    expect(() => decodeRatingManifest({ ...manifest, rateable: {} })).toThrow();
    expect(() => decodeRatingManifest({ ...manifest, rateable: [{ id: '../settings', bg: '' }] })).toThrow();
    expect(() => decodeRatingManifest({ ...manifest, cal: [{ ...manifest.cal[0], file: '../index.html' }] })).toThrow();
  });
});
