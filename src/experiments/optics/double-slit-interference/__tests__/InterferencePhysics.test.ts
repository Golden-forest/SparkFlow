import { describe, expect, it } from 'vitest';
import {
  calculateFringeSpacing,
  calculateInterferenceIntensity,
  estimateVisibleOrder,
  type InterferenceSetup,
} from '../InterferencePhysics';

const BASE_SETUP: InterferenceSetup = {
  wavelengthNm: 550,
  slitSeparationMm: 0.5,
  slitWidthMm: 0.1,
  screenDistanceM: 1,
};

describe('InterferencePhysics', () => {
  it('keeps center intensity at maximum', () => {
    const center = calculateInterferenceIntensity(0, BASE_SETUP);
    expect(center).toBeCloseTo(1, 6);
  });

  it('has near-zero intensity at a destructive interference point', () => {
    const spacing = calculateFringeSpacing(
      BASE_SETUP.wavelengthNm,
      BASE_SETUP.screenDistanceM,
      BASE_SETUP.slitSeparationMm,
    );
    const darkOffset = spacing * 0.5;
    const intensity = calculateInterferenceIntensity(darkOffset, BASE_SETUP);
    expect(intensity).toBeLessThan(0.02);
  });

  it('is symmetric around the center line', () => {
    const y = 0.0008;
    const plus = calculateInterferenceIntensity(y, BASE_SETUP);
    const minus = calculateInterferenceIntensity(-y, BASE_SETUP);
    expect(plus).toBeCloseTo(minus, 8);
  });

  it('matches fringe spacing scaling law', () => {
    const spacing1 = calculateFringeSpacing(500, 1, 0.5);
    const spacing2 = calculateFringeSpacing(500, 2, 0.5);
    const spacing3 = calculateFringeSpacing(500, 1, 1.0);

    expect(spacing2).toBeCloseTo(spacing1 * 2, 12);
    expect(spacing3).toBeCloseTo(spacing1 * 0.5, 12);
  });

  it('returns non-negative visible order', () => {
    const order = estimateVisibleOrder(BASE_SETUP, 0.0025);
    expect(order).toBeGreaterThanOrEqual(0);
  });
});
