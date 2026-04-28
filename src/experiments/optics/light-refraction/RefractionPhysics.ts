export const MEDIUM_PRESETS = {
  air: { label: 'Air', refractiveIndex: 1.0 },
  water: { label: 'Water', refractiveIndex: 1.33 },
  glass: { label: 'Glass', refractiveIndex: 1.5 },
  diamond: { label: 'Diamond', refractiveIndex: 2.42 },
} as const;

export type MediumKey = keyof typeof MEDIUM_PRESETS;

export interface FresnelResult {
  rs: number;
  rp: number;
  reflectance: number;
  transmittance: number;
}

export interface RefractionResult extends FresnelResult {
  n1: number;
  n2: number;
  incidentAngleDeg: number;
  reflectedAngleDeg: number;
  refractedAngleDeg: number | null;
  criticalAngleDeg: number | null;
  isTotalInternalReflection: boolean;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MIN_REFRACTIVE_INDEX = 1e-6;
const MAX_INCIDENT_ANGLE_DEG = 89.999;

export const MEDIUM_OPTIONS = (Object.keys(MEDIUM_PRESETS) as MediumKey[]).map((key) => ({
  value: key,
  label: MEDIUM_PRESETS[key].label,
}));

export function isMediumKey(value: string): value is MediumKey {
  return value in MEDIUM_PRESETS;
}

export function resolveMediumKey(value: string, fallback: MediumKey = 'air'): MediumKey {
  return isMediumKey(value) ? value : fallback;
}

export function getMediumRefractiveIndex(medium: MediumKey): number {
  return MEDIUM_PRESETS[medium].refractiveIndex;
}

export function calculateCriticalAngleDeg(n1: number, n2: number): number | null {
  const sourceIndex = sanitizeRefractiveIndex(n1);
  const targetIndex = sanitizeRefractiveIndex(n2);
  if (sourceIndex <= targetIndex) {
    return null;
  }

  return Math.asin(clamp(targetIndex / sourceIndex, -1, 1)) * RAD_TO_DEG;
}

export function calculateSnellRefractedAngleDeg(incidentAngleDeg: number, n1: number, n2: number): number | null {
  const sourceIndex = sanitizeRefractiveIndex(n1);
  const targetIndex = sanitizeRefractiveIndex(n2);
  const thetaI = clampIncidentAngleDeg(incidentAngleDeg) * DEG_TO_RAD;
  const sinThetaT = (sourceIndex / targetIndex) * Math.sin(thetaI);

  if (Math.abs(sinThetaT) > 1) {
    return null;
  }

  return Math.asin(clamp(sinThetaT, -1, 1)) * RAD_TO_DEG;
}

export function calculateFresnelReflectance(incidentAngleDeg: number, n1: number, n2: number): FresnelResult {
  const sourceIndex = sanitizeRefractiveIndex(n1);
  const targetIndex = sanitizeRefractiveIndex(n2);
  const thetaI = clampIncidentAngleDeg(incidentAngleDeg) * DEG_TO_RAD;
  const thetaTDeg = calculateSnellRefractedAngleDeg(incidentAngleDeg, sourceIndex, targetIndex);

  if (thetaTDeg === null) {
    return {
      rs: 1,
      rp: 1,
      reflectance: 1,
      transmittance: 0,
    };
  }

  const thetaT = thetaTDeg * DEG_TO_RAD;
  const cosI = Math.max(Math.cos(thetaI), 1e-8);
  const cosT = Math.max(Math.cos(thetaT), 1e-8);

  const rsNumerator = sourceIndex * cosI - targetIndex * cosT;
  const rsDenominator = sourceIndex * cosI + targetIndex * cosT;
  const rpNumerator = sourceIndex * cosT - targetIndex * cosI;
  const rpDenominator = sourceIndex * cosT + targetIndex * cosI;

  const rs = rsDenominator === 0 ? 1 : (rsNumerator / rsDenominator) ** 2;
  const rp = rpDenominator === 0 ? 1 : (rpNumerator / rpDenominator) ** 2;
  const reflectance = clamp((rs + rp) / 2, 0, 1);

  return {
    rs: clamp(rs, 0, 1),
    rp: clamp(rp, 0, 1),
    reflectance,
    transmittance: 1 - reflectance,
  };
}

export function calculateRefraction(incidentAngleDeg: number, n1: number, n2: number): RefractionResult {
  const sourceIndex = sanitizeRefractiveIndex(n1);
  const targetIndex = sanitizeRefractiveIndex(n2);
  const normalizedIncident = clampIncidentAngleDeg(incidentAngleDeg);
  const refractedAngleDeg = calculateSnellRefractedAngleDeg(normalizedIncident, sourceIndex, targetIndex);
  const criticalAngleDeg = calculateCriticalAngleDeg(sourceIndex, targetIndex);
  const fresnel = calculateFresnelReflectance(normalizedIncident, sourceIndex, targetIndex);

  return {
    n1: sourceIndex,
    n2: targetIndex,
    incidentAngleDeg: normalizedIncident,
    reflectedAngleDeg: normalizedIncident,
    refractedAngleDeg,
    criticalAngleDeg,
    isTotalInternalReflection: refractedAngleDeg === null,
    ...fresnel,
  };
}

function clampIncidentAngleDeg(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 0;
  }

  return clamp(angle, 0, MAX_INCIDENT_ANGLE_DEG);
}

function sanitizeRefractiveIndex(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.max(value, MIN_REFRACTIVE_INDEX);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

