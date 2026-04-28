import { describe, expect, it } from 'vitest';
import {
  MEDIUM_PRESETS,
  calculateCriticalAngleDeg,
  calculateFresnelReflectance,
  calculateRefraction,
  calculateSnellRefractedAngleDeg,
  getMediumRefractiveIndex,
  isMediumKey,
  resolveMediumKey,
} from '../RefractionPhysics';

describe('RefractionPhysics', () => {
  it('calculates Snell refraction angle for air to glass', () => {
    const refracted = calculateSnellRefractedAngleDeg(30, 1.0, 1.5);
    expect(refracted).not.toBeNull();
    expect(refracted as number).toBeCloseTo(19.47, 2);
  });

  it('detects total internal reflection when incident angle exceeds critical angle', () => {
    const critical = calculateCriticalAngleDeg(1.5, 1.0);
    expect(critical).not.toBeNull();
    expect(critical as number).toBeCloseTo(41.81, 2);

    const result = calculateRefraction(50, 1.5, 1.0);
    expect(result.isTotalInternalReflection).toBe(true);
    expect(result.refractedAngleDeg).toBeNull();
    expect(result.reflectance).toBe(1);
    expect(result.transmittance).toBe(0);
  });

  it('returns no critical angle when light goes from lower index to higher index', () => {
    const critical = calculateCriticalAngleDeg(1.0, 1.5);
    expect(critical).toBeNull();
  });

  it('keeps unpolarized Fresnel reflectance increasing toward grazing incidence', () => {
    const normal = calculateFresnelReflectance(0, 1.0, 1.5).reflectance;
    const medium = calculateFresnelReflectance(40, 1.0, 1.5).reflectance;
    const grazing = calculateFresnelReflectance(80, 1.0, 1.5).reflectance;

    expect(normal).toBeLessThan(medium);
    expect(medium).toBeLessThan(grazing);
    expect(grazing).toBeLessThanOrEqual(1);
  });

  it('validates medium presets and fallback resolution', () => {
    expect(isMediumKey('air')).toBe(true);
    expect(isMediumKey('water')).toBe(true);
    expect(isMediumKey('unknown')).toBe(false);

    expect(resolveMediumKey('glass')).toBe('glass');
    expect(resolveMediumKey('invalid')).toBe('air');
    expect(resolveMediumKey('invalid', 'diamond')).toBe('diamond');
  });

  it('keeps refractive index mapping aligned with presets', () => {
    expect(getMediumRefractiveIndex('air')).toBe(MEDIUM_PRESETS.air.refractiveIndex);
    expect(getMediumRefractiveIndex('water')).toBe(1.33);
    expect(getMediumRefractiveIndex('glass')).toBe(1.5);
    expect(getMediumRefractiveIndex('diamond')).toBe(2.42);
  });
});

