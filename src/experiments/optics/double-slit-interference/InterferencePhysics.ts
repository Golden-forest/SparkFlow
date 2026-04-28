export interface InterferenceSetup {
  wavelengthNm: number;
  slitSeparationMm: number;
  slitWidthMm: number;
  screenDistanceM: number;
}

export interface IntensitySample {
  screenOffsetM: number;
  intensity: number;
}

const NM_TO_M = 1e-9;
const MM_TO_M = 1e-3;
const EPSILON = 1e-12;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function isValidPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function nmToMeters(wavelengthNm: number): number {
  return wavelengthNm * NM_TO_M;
}

export function mmToMeters(lengthMm: number): number {
  return lengthMm * MM_TO_M;
}

export function calculateDiffractionAngle(screenOffsetM: number, screenDistanceM: number): number {
  if (!isValidPositiveNumber(screenDistanceM)) {
    return 0;
  }
  return Math.atan2(screenOffsetM, screenDistanceM);
}

export function calculatePathDifference(slitSeparationM: number, diffractionAngleRad: number): number {
  if (!isValidPositiveNumber(slitSeparationM)) {
    return 0;
  }
  return slitSeparationM * Math.sin(diffractionAngleRad);
}

export function calculateInterferenceIntensity(screenOffsetM: number, setup: InterferenceSetup): number {
  const wavelengthM = nmToMeters(setup.wavelengthNm);
  const slitSeparationM = mmToMeters(setup.slitSeparationMm);
  const slitWidthM = mmToMeters(setup.slitWidthMm);
  const screenDistanceM = setup.screenDistanceM;

  if (
    !isValidPositiveNumber(wavelengthM) ||
    !isValidPositiveNumber(slitSeparationM) ||
    !isValidPositiveNumber(slitWidthM) ||
    !isValidPositiveNumber(screenDistanceM)
  ) {
    return 0;
  }

  const theta = calculateDiffractionAngle(screenOffsetM, screenDistanceM);
  const pathDifference = calculatePathDifference(slitSeparationM, theta);
  const phaseDifference = (2 * Math.PI * pathDifference) / wavelengthM;

  const beta = (Math.PI * slitWidthM * Math.sin(theta)) / wavelengthM;
  const envelope = Math.abs(beta) < EPSILON ? 1 : (Math.sin(beta) / beta) ** 2;
  const interference = Math.cos(phaseDifference * 0.5) ** 2;

  return clamp01(envelope * interference);
}

export function calculateFringeSpacing(
  wavelengthNm: number,
  screenDistanceM: number,
  slitSeparationMm: number
): number {
  const wavelengthM = nmToMeters(wavelengthNm);
  const slitSeparationM = mmToMeters(slitSeparationMm);

  if (!isValidPositiveNumber(wavelengthM) || !isValidPositiveNumber(screenDistanceM) || !isValidPositiveNumber(slitSeparationM)) {
    return 0;
  }

  return (wavelengthM * screenDistanceM) / slitSeparationM;
}

export function calculateCentralMaximumWidth(
  wavelengthNm: number,
  screenDistanceM: number,
  slitWidthMm: number
): number {
  const wavelengthM = nmToMeters(wavelengthNm);
  const slitWidthM = mmToMeters(slitWidthMm);

  if (!isValidPositiveNumber(wavelengthM) || !isValidPositiveNumber(screenDistanceM) || !isValidPositiveNumber(slitWidthM)) {
    return 0;
  }

  return (2 * wavelengthM * screenDistanceM) / slitWidthM;
}

export function estimateVisibleOrder(setup: InterferenceSetup, screenHalfHeightM: number): number {
  if (!isValidPositiveNumber(screenHalfHeightM)) {
    return 0;
  }

  const spacing = calculateFringeSpacing(setup.wavelengthNm, setup.screenDistanceM, setup.slitSeparationMm);
  const slitSeparationM = mmToMeters(setup.slitSeparationMm);
  const wavelengthM = nmToMeters(setup.wavelengthNm);

  if (!isValidPositiveNumber(spacing) || !isValidPositiveNumber(slitSeparationM) || !isValidPositiveNumber(wavelengthM)) {
    return 0;
  }

  const maxByScreen = Math.floor(screenHalfHeightM / spacing);
  const maxByGeometry = Math.floor(slitSeparationM / wavelengthM);

  return Math.max(0, Math.min(maxByScreen, maxByGeometry));
}

export function sampleIntensityProfile(
  setup: InterferenceSetup,
  minScreenOffsetM: number,
  maxScreenOffsetM: number,
  sampleCount: number
): IntensitySample[] {
  if (!Number.isFinite(minScreenOffsetM) || !Number.isFinite(maxScreenOffsetM) || sampleCount <= 0) {
    return [];
  }

  if (sampleCount === 1) {
    const center = (minScreenOffsetM + maxScreenOffsetM) * 0.5;
    return [{ screenOffsetM: center, intensity: calculateInterferenceIntensity(center, setup) }];
  }

  const samples: IntensitySample[] = [];
  const span = maxScreenOffsetM - minScreenOffsetM;

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / (sampleCount - 1);
    const y = minScreenOffsetM + span * t;
    samples.push({
      screenOffsetM: y,
      intensity: calculateInterferenceIntensity(y, setup),
    });
  }

  return samples;
}
