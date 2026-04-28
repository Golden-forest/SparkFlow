import { describe, expect, it } from 'vitest';
import { wavelengthToRGB } from '../WavelengthColor';

describe('WavelengthColor', () => {
  it('returns expected dominant channels for violet, green, and red', () => {
    const violet = wavelengthToRGB(400);
    const green = wavelengthToRGB(530);
    const red = wavelengthToRGB(680);

    expect(violet[2]).toBeGreaterThan(violet[0]);
    expect(violet[2]).toBeGreaterThan(violet[1]);

    expect(green[1]).toBeGreaterThan(green[0]);
    expect(green[1]).toBeGreaterThan(green[2]);

    expect(red[0]).toBeGreaterThan(red[1]);
    expect(red[0]).toBeGreaterThan(red[2]);
  });

  it('clamps all channel outputs between 0 and 1', () => {
    for (const wavelength of [380, 450, 550, 650, 780]) {
      const [r, g, b] = wavelengthToRGB(wavelength);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  it('returns black for out-of-range wavelengths', () => {
    expect(wavelengthToRGB(300)).toEqual([0, 0, 0]);
    expect(wavelengthToRGB(800)).toEqual([0, 0, 0]);
  });
});
