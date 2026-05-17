import * as THREE from 'three';
import {
  calculateLorentzForce,
  createChargedParticleState,
  stepChargedParticle,
  type ChargedParticleState,
  type FieldParameters,
} from './LorentzPhysics.ts';

export type SynchrotronMechanism = 'rf' | 'bending' | 'synchronized' | 'collision';

export interface SynchrotronMicroSettings {
  mechanism: SynchrotronMechanism;
  electricFieldStrength: number;
  magneticFieldStrength: number;
  charge: number;
  mass: number;
  initialSpeed: number;
}

export interface MicroParticleState extends ChargedParticleState {
  id: string;
  charge: number;
  color: number;
  active: boolean;
}

export interface CollisionState {
  hasCollided: boolean;
  point: THREE.Vector3;
  age: number;
  energy: number;
}

export interface SynchrotronMicroState {
  mechanism: SynchrotronMechanism;
  particles: MicroParticleState[];
  collision: CollisionState;
  time: number;
  orbitProgress?: number;
}

export interface MicroVectorHints {
  velocity: THREE.Vector3;
  electricField: THREE.Vector3;
  magneticField: THREE.Vector3;
  lorentzForce: THREE.Vector3;
}

export const DESIGN_ORBIT_RADIUS = 2.15;
export const DESIGN_BEND_ARC = Math.PI * 2;

const DESIGN_ORBIT_Y = 0.04;
const BEND_START_ANGLE = Math.PI;
const MAX_MICRO_TRAJECTORY_POINTS = 360;
const MIN_GUIDED_SPEED = 0.25;
const MAX_SYNC_SPEED = 6.8;
const MAX_SYNC_INITIAL_SPEED = 0.82;

const DEFAULT_COLLISION_STATE: CollisionState = {
  hasCollided: false,
  point: new THREE.Vector3(),
  age: 0,
  energy: 0,
};

function asMicroParticle(
  id: string,
  charge: number,
  color: number,
  position: THREE.Vector3,
  velocity: THREE.Vector3,
): MicroParticleState {
  return {
    ...createChargedParticleState({ position, velocity }),
    id,
    charge,
    color,
    active: true,
  };
}

function getSafeMass(settings: SynchrotronMicroSettings): number {
  return Math.max(0.05, Math.abs(settings.mass));
}

function appendTrajectory(particle: MicroParticleState, point: THREE.Vector3): THREE.Vector3[] {
  return [...particle.trajectory, point.clone()].slice(-MAX_MICRO_TRAJECTORY_POINTS);
}

function getInitialGuidedSpeed(settings: SynchrotronMicroSettings): number {
  const requestedSpeed = Math.max(MIN_GUIDED_SPEED, Math.abs(settings.initialSpeed));
  if (settings.mechanism === 'synchronized') {
    return Math.min(requestedSpeed * 0.34, MAX_SYNC_INITIAL_SPEED);
  }
  return requestedSpeed;
}

export function isGuidedOrbitMechanism(mechanism: SynchrotronMechanism): boolean {
  return mechanism === 'bending' || mechanism === 'synchronized';
}

export function getDesignOrbitAngle(progress: number): number {
  const wrappedProgress = THREE.MathUtils.euclideanModulo(progress, 1);
  return BEND_START_ANGLE - wrappedProgress * DESIGN_BEND_ARC;
}

export function getDesignOrbitPosition(progress: number): THREE.Vector3 {
  const angle = getDesignOrbitAngle(progress);
  return new THREE.Vector3(
    Math.cos(angle) * DESIGN_ORBIT_RADIUS,
    DESIGN_ORBIT_Y,
    Math.sin(angle) * DESIGN_ORBIT_RADIUS,
  );
}

function getGuidedOrbitDirection(settings: SynchrotronMicroSettings): number {
  return Math.sign(settings.charge || 1);
}

export function getDesignOrbitVelocity(progress: number, speed: number, direction = 1): THREE.Vector3 {
  const angle = getDesignOrbitAngle(progress);
  return new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle))
    .normalize()
    .multiplyScalar(Math.max(MIN_GUIDED_SPEED, Math.abs(speed)) * Math.sign(direction || 1));
}

export function getRequiredBForDesignOrbit(speed: number, settings: SynchrotronMicroSettings): number {
  const chargeMagnitude = Math.abs(settings.charge);
  if (chargeMagnitude < 0.0001) {
    return Number.POSITIVE_INFINITY;
  }
  return (getSafeMass(settings) * Math.abs(speed)) / (chargeMagnitude * DESIGN_ORBIT_RADIUS);
}

export function getGuidedMagneticField(
  speed: number,
  settings: SynchrotronMicroSettings,
): THREE.Vector3 {
  const requiredB = getRequiredBForDesignOrbit(speed, settings);
  if (!Number.isFinite(requiredB)) {
    return new THREE.Vector3();
  }
  return new THREE.Vector3(0, -requiredB, 0);
}

export function createMicroState(settings: SynchrotronMicroSettings): SynchrotronMicroState {
  const speed = isGuidedOrbitMechanism(settings.mechanism)
    ? getInitialGuidedSpeed(settings)
    : Math.max(MIN_GUIDED_SPEED, Math.abs(settings.initialSpeed));
  const charge = settings.charge === 0 ? 1 : settings.charge;

  if (settings.mechanism === 'collision') {
    return {
      mechanism: settings.mechanism,
      particles: [
        asMicroParticle(
          'beam-blue',
          Math.abs(charge),
          0x38bdf8,
          new THREE.Vector3(-2.9, DESIGN_ORBIT_Y, -0.1),
          new THREE.Vector3(speed, 0, 0.03),
        ),
        asMicroParticle(
          'beam-orange',
          -Math.abs(charge),
          0xfb923c,
          new THREE.Vector3(2.9, DESIGN_ORBIT_Y, 0.1),
          new THREE.Vector3(-speed, 0, -0.03),
        ),
      ],
      collision: { ...DEFAULT_COLLISION_STATE, point: new THREE.Vector3() },
      time: 0,
    };
  }

  if (isGuidedOrbitMechanism(settings.mechanism)) {
    const orbitProgress = 0;
    const startPosition = getDesignOrbitPosition(orbitProgress);
    const startVelocity = getDesignOrbitVelocity(orbitProgress, speed, getGuidedOrbitDirection(settings));

    return {
      mechanism: settings.mechanism,
      particles: [
        asMicroParticle(
          'beam-primary',
          charge,
          charge >= 0 ? 0x38bdf8 : 0xfb923c,
          startPosition,
          startVelocity,
        ),
      ],
      collision: { ...DEFAULT_COLLISION_STATE, point: new THREE.Vector3() },
      time: 0,
      orbitProgress,
    };
  }

  return {
    mechanism: settings.mechanism,
    particles: [
      asMicroParticle(
        'beam-primary',
        charge,
        charge >= 0 ? 0x38bdf8 : 0xfb923c,
        new THREE.Vector3(-3.2, DESIGN_ORBIT_Y, 0),
        new THREE.Vector3(speed, 0, 0),
      ),
    ],
    collision: { ...DEFAULT_COLLISION_STATE, point: new THREE.Vector3() },
    time: 0,
  };
}

export function getFieldsForMechanism(
  settings: SynchrotronMicroSettings,
  particleCharge = settings.charge,
  speed = Math.max(MIN_GUIDED_SPEED, Math.abs(settings.initialSpeed)),
): FieldParameters {
  const mass = getSafeMass(settings);

  if (settings.mechanism === 'rf') {
    return {
      electricField: new THREE.Vector3(settings.electricFieldStrength, 0, 0),
      magneticField: new THREE.Vector3(),
      charge: particleCharge,
      mass,
    };
  }

  if (settings.mechanism === 'bending') {
    return {
      electricField: new THREE.Vector3(),
      magneticField: getGuidedMagneticField(speed, settings),
      charge: particleCharge,
      mass,
    };
  }

  if (settings.mechanism === 'synchronized') {
    return {
      electricField: new THREE.Vector3(Math.abs(settings.electricFieldStrength), 0, 0),
      magneticField: getGuidedMagneticField(speed, settings),
      charge: particleCharge,
      mass,
    };
  }

  return {
    electricField: new THREE.Vector3(),
    magneticField: new THREE.Vector3(),
    charge: particleCharge,
    mass,
  };
}

export function getMicroVectorHints(
  settings: SynchrotronMicroSettings,
  particle: MicroParticleState,
): MicroVectorHints {
  const speed = particle.velocity.length();

  if (isGuidedOrbitMechanism(settings.mechanism)) {
    const magneticField = getGuidedMagneticField(speed, settings);
    const electricSign = Math.sign(settings.electricFieldStrength || 1) * Math.sign(particle.charge || 1);
    const electricField = settings.mechanism === 'synchronized'
      ? particle.velocity.clone().normalize().multiplyScalar(Math.abs(settings.electricFieldStrength) * electricSign)
      : new THREE.Vector3();
    const lorentzForce = calculateLorentzForce(particle.velocity, {
      electricField,
      magneticField,
      charge: particle.charge,
      mass: getSafeMass(settings),
    });

    return {
      velocity: particle.velocity.clone(),
      electricField,
      magneticField,
      lorentzForce,
    };
  }

  const fields = getFieldsForMechanism(settings, particle.charge, speed);
  return {
    velocity: particle.velocity.clone(),
    electricField: fields.electricField,
    magneticField: fields.magneticField,
    lorentzForce: calculateLorentzForce(particle.velocity, fields),
  };
}

export function detectBeamCollision(particles: MicroParticleState[], radius: number): boolean {
  if (particles.length < 2) return false;
  return particles[0].position.distanceTo(particles[1].position) <= radius;
}

function stepGuidedOrbitState(
  state: SynchrotronMicroState,
  settings: SynchrotronMicroSettings,
  dt: number,
): SynchrotronMicroState {
  const particle = state.particles[0];
  const currentSpeed = particle?.velocity.length() ?? Math.max(MIN_GUIDED_SPEED, Math.abs(settings.initialSpeed));
  const mass = getSafeMass(settings);
  const chargeMagnitude = Math.max(Math.abs(settings.charge), 0.0001);
  const electricAcceleration = Math.abs(settings.electricFieldStrength) * chargeMagnitude / mass;
  const speedDelta = settings.mechanism === 'synchronized'
    ? Math.sign(settings.electricFieldStrength || 1) * electricAcceleration * dt * 0.82
    : 0;
  const targetSpeed = settings.mechanism === 'bending'
    ? Math.max(MIN_GUIDED_SPEED, Math.abs(settings.initialSpeed))
    : THREE.MathUtils.clamp(currentSpeed + speedDelta, MIN_GUIDED_SPEED, MAX_SYNC_SPEED);
  const angularStep = (targetSpeed / DESIGN_ORBIT_RADIUS) * dt;
  const orbitDirection = getGuidedOrbitDirection(settings);
  const orbitProgress = THREE.MathUtils.euclideanModulo((state.orbitProgress ?? 0) + orbitDirection * angularStep / DESIGN_BEND_ARC, 1);
  const position = getDesignOrbitPosition(orbitProgress);
  const velocity = getDesignOrbitVelocity(orbitProgress, targetSpeed, orbitDirection);
  const inward = new THREE.Vector3(-position.x, 0, -position.z).normalize();
  const centripetalAcceleration = inward.multiplyScalar((targetSpeed * targetSpeed) / DESIGN_ORBIT_RADIUS);
  const tangentAcceleration = velocity.clone().normalize().multiplyScalar(dt > 0 ? (targetSpeed - currentSpeed) / dt : 0);
  const acceleration = centripetalAcceleration.add(tangentAcceleration);
  const baseParticle = particle ?? asMicroParticle(
    'beam-primary',
    settings.charge === 0 ? 1 : settings.charge,
    settings.charge >= 0 ? 0x38bdf8 : 0xfb923c,
    position,
    velocity,
  );
  const guidedParticle: MicroParticleState = {
    ...baseParticle,
    position,
    velocity,
    acceleration,
    time: baseParticle.time + dt,
    trajectory: appendTrajectory(baseParticle, position),
  };

  return {
    mechanism: settings.mechanism,
    particles: [guidedParticle],
    collision: state.collision,
    time: state.time + dt,
    orbitProgress,
  };
}

export function stepMicroState(
  state: SynchrotronMicroState,
  settings: SynchrotronMicroSettings,
  deltaTime: number,
): SynchrotronMicroState {
  const dt = THREE.MathUtils.clamp(deltaTime, 0, 0.04);

  if (state.collision.hasCollided) {
    return {
      ...state,
      collision: {
        ...state.collision,
        age: state.collision.age + dt,
      },
      time: state.time + dt,
    };
  }

  if (isGuidedOrbitMechanism(settings.mechanism)) {
    return stepGuidedOrbitState(state, settings, dt);
  }

  const particles = state.particles.map((particle) => {
    const fields = getFieldsForMechanism(settings, particle.charge, particle.velocity.length());
    const stepped = stepChargedParticle(particle, fields, dt);
    return {
      ...particle,
      ...stepped,
    };
  });

  if (settings.mechanism === 'collision' && detectBeamCollision(particles, 0.28)) {
    const point = particles[0].position.clone().add(particles[1].position).multiplyScalar(0.5);
    const energy = particles.reduce((sum, particle) => sum + 0.5 * settings.mass * particle.velocity.lengthSq(), 0);
    return {
      mechanism: settings.mechanism,
      particles: particles.map((particle) => ({ ...particle, active: false })),
      collision: {
        hasCollided: true,
        point,
        age: 0,
        energy,
      },
      time: state.time + dt,
    };
  }

  return {
    mechanism: settings.mechanism,
    particles,
    collision: state.collision,
    time: state.time + dt,
  };
}

export function getPrimaryMetrics(state: SynchrotronMicroState): {
  speed: number;
  kineticEnergy: number;
  separation: number;
  orbitRadius: number;
} {
  const first = state.particles[0];
  const speed = first?.velocity.length() ?? 0;
  const kineticEnergy = first ? 0.5 * first.velocity.lengthSq() : 0;
  const separation = state.particles.length > 1 ? state.particles[0].position.distanceTo(state.particles[1].position) : 0;
  const orbitRadius = first ? Math.hypot(first.position.x, first.position.z) : 0;
  return { speed, kineticEnergy, separation, orbitRadius };
}
