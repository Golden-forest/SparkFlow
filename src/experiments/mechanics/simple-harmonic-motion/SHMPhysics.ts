import * as THREE from 'three';
import {
  springOscillation,
  springOscillationVelocity,
  springAngularFrequency,
  pendulumOscillation,
  pendulumAngularFrequency,
  kineticEnergy,
  elasticPotentialEnergy,
  gravitationalPotentialEnergy,
} from '@/utils/math/physics-formulas';

/**
 * Simple Harmonic Motion State Interface
 */
export interface SHMState {
  displacement: number;          // Displacement (m)
  velocity: number;              // Velocity (m/s)
  acceleration: number;          // Acceleration (m/s²)
  mass: number;                  // Mass (kg)
  time: number;                  // Time (s)
  oscillatorType: 'spring' | 'pendulum'; // Oscillator type
  amplitude: number;             // Amplitude (m)
  angularFrequency: number;      // Angular frequency (rad/s)
  phase: number;                 // Initial phase (rad)
  springConstant?: number;       // Spring constant (N/m, spring only)
  pendulumLength?: number;       // Pendulum length (m, pendulum only)
  initialAngle?: number;         // Initial angle (rad, pendulum only)
}

/**
 * Simple Harmonic Motion Data Interface
 */
export interface SHMData {
  displacement: number;          // Displacement (m)
  velocity: number;              // Velocity (m/s)
  acceleration: number;          // Acceleration (m/s²)
  kineticEnergy: number;         // Kinetic energy (J)
  potentialEnergy: number;       // Potential energy (J)
  mechanicalEnergy: number;      // Mechanical energy (J)
  period: number;                // Period (s)
  frequency: number;             // Frequency (Hz)
  angularFrequency: number;      // Angular frequency (rad/s)
}

/**
 * Create initial simple harmonic motion state
 */
export function createInitialSHM(
  type: 'spring' | 'pendulum',
  mass: number,
  parameter: number, // springConstant or pendulumLength
  amplitude: number,
  phase: number = 0
): SHMState {
  // Calculate angular frequency
  let angularFrequency: number;
  let acceleration: number;

  if (type === 'spring') {
    angularFrequency = springAngularFrequency(parameter, mass);
    acceleration = -parameter / mass * amplitude;
  } else {
    angularFrequency = pendulumAngularFrequency(parameter);
    acceleration = -angularFrequency * angularFrequency * amplitude;
  }

  const state: SHMState = {
    displacement: amplitude,
    velocity: 0,
    acceleration,
    mass,
    time: 0,
    oscillatorType: type,
    amplitude,
    phase,
    angularFrequency,
  };

  if (type === 'spring') {
    state.springConstant = parameter;
  } else {
    state.pendulumLength = parameter;
    state.initialAngle = amplitude / parameter; // Small angle approximation: θ ≈ x/L
  }

  return state;
}

/**
 * Update simple harmonic motion state
 */
export function updateSHM(state: SHMState, deltaTime: number): SHMState {
  const newState = { ...state };
  newState.time += deltaTime;

  if (state.oscillatorType === 'spring') {
    // Spring oscillator
    newState.displacement = springOscillation(
      newState.time,
      newState.amplitude,
      newState.angularFrequency,
      newState.phase
    );
    newState.velocity = springOscillationVelocity(
      newState.time,
      newState.amplitude,
      newState.angularFrequency,
      newState.phase
    );
    newState.acceleration = -newState.angularFrequency * newState.angularFrequency * newState.displacement;
  } else {
    // Simple pendulum
    const angle = pendulumOscillation(
      newState.time,
      newState.initialAngle!,
      newState.pendulumLength!,
      9.8,
      newState.phase
    );

    // Small angle approximation: x = L * θ
    newState.displacement = newState.pendulumLength! * Math.sin(angle);

    // Angular velocity: ω_angular = dθ/dt = -θ₀·ω₀·sin(ω₀t + φ)
    const angularVelocity = -newState.initialAngle! * newState.angularFrequency *
      Math.sin(newState.angularFrequency * newState.time + newState.phase);

    // Linear velocity: v = L * ω_angular
    newState.velocity = newState.pendulumLength! * angularVelocity;

    // Tangential acceleration: a = -ω₀² * L * θ
    newState.acceleration = -newState.angularFrequency * newState.angularFrequency *
      newState.pendulumLength! * angle;
  }

  return newState;
}

/**
 * Calculate simple harmonic motion physical quantities
 */
export function calculateSHMData(state: SHMState): SHMData {
  const ke = kineticEnergy(state.mass, state.velocity);
  let pe = 0;

  if (state.oscillatorType === 'spring') {
    pe = elasticPotentialEnergy(state.springConstant!, state.displacement);
  } else {
    // Pendulum gravitational potential energy: h = L - L*cos(θ)
    const angle = state.displacement / state.pendulumLength!;
    const height = state.pendulumLength! * (1 - Math.cos(angle));
    pe = gravitationalPotentialEnergy(state.mass, height);
  }

  const period = (2 * Math.PI) / state.angularFrequency;
  const frequency = 1 / period;

  return {
    displacement: state.displacement,
    velocity: state.velocity,
    acceleration: state.acceleration,
    kineticEnergy: ke,
    potentialEnergy: pe,
    mechanicalEnergy: ke + pe,
    period,
    frequency,
    angularFrequency: state.angularFrequency,
  };
}

/**
 * Calculate spring oscillator position (3D)
 */
export function calculateSpringPosition(state: SHMState): THREE.Vector3 {
  // Spring oscillates along X axis
  return new THREE.Vector3(state.displacement, 0, 0);
}

/**
 * Calculate pendulum position (3D)
 */
export function calculatePendulumPosition(state: SHMState): THREE.Vector3 {
  const angle = state.displacement / state.pendulumLength!;
  const x = state.pendulumLength! * Math.sin(angle);
  const y = -state.pendulumLength! * Math.cos(angle);
  return new THREE.Vector3(x, y, 0);
}

/**
 * Calculate velocity vector (3D)
 */
export function calculateSHMVelocityVector(state: SHMState): THREE.Vector3 {
  if (state.oscillatorType === 'spring') {
    // Spring oscillator velocity along X axis
    return new THREE.Vector3(state.velocity, 0, 0);
  } else {
    // Pendulum velocity along tangent direction
    const angle = state.displacement / state.pendulumLength!;
    const tangentAngle = angle + Math.PI / 2;
    const vx = state.velocity * Math.cos(tangentAngle);
    const vy = state.velocity * Math.sin(tangentAngle);
    return new THREE.Vector3(vx, vy, 0);
  }
}

/**
 * Calculate acceleration vector (3D)
 */
export function calculateSHMAccelerationVector(state: SHMState): THREE.Vector3 {
  if (state.oscillatorType === 'spring') {
    // Spring oscillator acceleration along X axis, pointing to equilibrium
    return new THREE.Vector3(state.acceleration, 0, 0);
  } else {
    // Pendulum acceleration along pendulum line pointing to equilibrium
    const angle = state.displacement / state.pendulumLength!;
    const ax = -state.acceleration * Math.sin(angle);
    const ay = state.acceleration * Math.cos(angle);
    return new THREE.Vector3(ax, ay, 0);
  }
}
