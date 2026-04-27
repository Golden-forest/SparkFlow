import * as THREE from 'three';

export interface ProjectileLaunchParameters {
  launchSpeed: number;
  launchAngleDeg: number;
  launchHeight: number;
  mass: number;
  gravity: number;
}

export interface ProjectileState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  time: number;
  maxHeight: number;
  horizontalDistance: number;
  hasLanded: boolean;
}

export interface ProjectileKinematics {
  flightTime: number;
  maxHeight: number;
  range: number;
}

export interface ProjectileEnergies {
  speed: number;
  kineticEnergy: number;
  potentialEnergy: number;
  mechanicalEnergy: number;
}

export function createInitialProjectileState(params: ProjectileLaunchParameters): ProjectileState {
  const angleRad = THREE.MathUtils.degToRad(params.launchAngleDeg);
  const velocity = new THREE.Vector3(
    params.launchSpeed * Math.cos(angleRad),
    params.launchSpeed * Math.sin(angleRad),
    0
  );
  const position = new THREE.Vector3(0, params.launchHeight, 0);

  return {
    position,
    velocity,
    time: 0,
    maxHeight: params.launchHeight,
    horizontalDistance: 0,
    hasLanded: false,
  };
}

export function stepProjectile(
  state: ProjectileState,
  deltaTime: number,
  gravity: number,
  groundHeight = 0
): ProjectileState {
  if (state.hasLanded || deltaTime <= 0) {
    return state;
  }

  const vx = state.velocity.x;
  const vy = state.velocity.y;
  const y0 = state.position.y;
  const x0 = state.position.x;

  const yNext = y0 + vy * deltaTime - 0.5 * gravity * deltaTime * deltaTime;
  const xNext = x0 + vx * deltaTime;

  if (yNext <= groundHeight) {
    const impactTime = solveImpactTime(y0, vy, gravity, deltaTime, groundHeight);
    const impactX = x0 + vx * impactTime;
    const impactVy = vy - gravity * impactTime;

    return {
      position: new THREE.Vector3(impactX, groundHeight, 0),
      velocity: new THREE.Vector3(vx, impactVy, 0),
      time: state.time + impactTime,
      maxHeight: Math.max(state.maxHeight, y0),
      horizontalDistance: Math.max(0, impactX),
      hasLanded: true,
    };
  }

  const nextPosition = new THREE.Vector3(xNext, yNext, 0);
  const nextVelocity = new THREE.Vector3(vx, vy - gravity * deltaTime, 0);

  return {
    position: nextPosition,
    velocity: nextVelocity,
    time: state.time + deltaTime,
    maxHeight: Math.max(state.maxHeight, yNext),
    horizontalDistance: Math.max(0, xNext),
    hasLanded: false,
  };
}

export function estimateProjectileKinematics(params: ProjectileLaunchParameters): ProjectileKinematics {
  const angleRad = THREE.MathUtils.degToRad(params.launchAngleDeg);
  const vx = params.launchSpeed * Math.cos(angleRad);
  const vy = params.launchSpeed * Math.sin(angleRad);
  const discriminant = vy * vy + 2 * params.gravity * Math.max(0, params.launchHeight);
  const flightTime = (vy + Math.sqrt(Math.max(0, discriminant))) / params.gravity;
  const range = vx * flightTime;
  const maxHeight = params.launchHeight + (vy * vy) / (2 * params.gravity);

  return {
    flightTime,
    maxHeight,
    range,
  };
}

export function calculateProjectileEnergies(
  state: ProjectileState,
  mass: number,
  gravity: number,
  referenceHeight = 0
): ProjectileEnergies {
  const speed = state.velocity.length();
  const kineticEnergy = 0.5 * mass * speed * speed;
  const potentialEnergy = mass * gravity * Math.max(0, state.position.y - referenceHeight);

  return {
    speed,
    kineticEnergy,
    potentialEnergy,
    mechanicalEnergy: kineticEnergy + potentialEnergy,
  };
}

function solveImpactTime(y0: number, vy: number, gravity: number, maxTime: number, groundHeight: number): number {
  const a = -0.5 * gravity;
  const b = vy;
  const c = y0 - groundHeight;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return maxTime;
  }

  const sqrtD = Math.sqrt(discriminant);
  const root1 = (-b + sqrtD) / (2 * a);
  const root2 = (-b - sqrtD) / (2 * a);
  const validRoots = [root1, root2].filter((t) => Number.isFinite(t) && t >= 0 && t <= maxTime);

  if (validRoots.length === 0) {
    return maxTime;
  }

  return Math.min(...validRoots);
}
