import * as THREE from 'three';
import { kineticEnergy, momentum, collisionVelocity } from '@/utils/math/physics-formulas';

/**
 * Body interface for collision objects
 */
export interface Body {
  mass: number;                    // Mass (kg)
  position: THREE.Vector3;         // Position (m)
  velocity: THREE.Vector3;         // Velocity (m/s)
  radius: number;                  // Radius (m)
}

/**
 * Collision state interface
 */
export interface CollisionState {
  body1: Body;                     // First body
  body2: Body;                     // Second body
  collisionType: CollisionType;    // Type of collision
  time: number;                    // Simulation time (s)
}

/**
 * Collision type
 */
export type CollisionType = 'elastic' | 'inelastic' | 'perfectly-inelastic';

/**
 * Collision data interface
 */
export interface CollisionData {
  totalMomentum: number;           // Total momentum (kg·m/s)
  totalKE: number;                 // Total kinetic energy (J)
  momentumBody1: number;           // Momentum of body 1 (kg·m/s)
  momentumBody2: number;           // Momentum of body 2 (kg·m/s)
  velocityBody1: number;           // Velocity magnitude of body 1 (m/s)
  velocityBody2: number;           // Velocity magnitude of body 2 (m/s)
  kineticEnergyBody1: number;      // Kinetic energy of body 1 (J)
  kineticEnergyBody2: number;      // Kinetic energy of body 2 (J)
  energyLoss: number;              // Energy loss in collision (J)
}

/**
 * Create initial collision state
 */
export function createInitialState(
  body1Mass: number,
  body2Mass: number,
  body1Velocity: number,
  body2Velocity: number,
  collisionType: CollisionType = 'elastic'
): CollisionState {
  // Position bodies on X axis, approaching each other
  const body1: Body = {
    mass: body1Mass,
    position: new THREE.Vector3(-5, 0, 0),
    velocity: new THREE.Vector3(body1Velocity, 0, 0),
    radius: calculateRadius(body1Mass),
  };

  const body2: Body = {
    mass: body2Mass,
    position: new THREE.Vector3(5, 0, 0),
    velocity: new THREE.Vector3(body2Velocity, 0, 0),
    radius: calculateRadius(body2Mass),
  };

  return {
    body1,
    body2,
    collisionType,
    time: 0,
  };
}

/**
 * Calculate radius based on mass (assuming uniform density)
 */
function calculateRadius(mass: number): number {
  // Volume proportional to mass, radius proportional to cube root of volume
  const baseRadius = 0.5;
  return baseRadius * Math.cbrt(mass);
}

/**
 * Detect collision between two bodies
 */
export function detectCollision(body1: Body, body2: Body): boolean {
  const distance = body1.position.distanceTo(body2.position);
  const minDistance = body1.radius + body2.radius;
  return distance <= minDistance;
}

/**
 * Result of collision resolution
 */
export interface CollisionResolutionResult {
  state: CollisionState;
  energyLoss: number;
}

/**
 * Resolve collision based on collision type
 */
export function resolveCollision(
  state: CollisionState,
  collisionType: CollisionType,
  coefficientOfRestitution: number = 0.5
): CollisionResolutionResult {
  const { body1, body2 } = state;

  // Calculate kinetic energy before collision
  const keBefore = 0.5 * body1.mass * body1.velocity.x ** 2 +
                   0.5 * body2.mass * body2.velocity.x ** 2;

  // Get velocity components in X direction (collision axis)
  const v1x = body1.velocity.x;
  const v2x = body2.velocity.x;

  let v1xFinal: number;
  let v2xFinal: number;

  if (collisionType === 'elastic') {
    // Perfectly elastic collision (coefficient of restitution = 1)
    const result = collisionVelocity(body1.mass, v1x, body2.mass, v2x, 1.0);
    v1xFinal = result.v1Final;
    v2xFinal = result.v2Final;
  } else if (collisionType === 'perfectly-inelastic') {
    // Perfectly inelastic collision (coefficient of restitution = 0)
    // Bodies stick together, conservation of momentum
    const totalMass = body1.mass + body2.mass;
    const vFinal = (body1.mass * v1x + body2.mass * v2x) / totalMass;
    v1xFinal = vFinal;
    v2xFinal = vFinal;
  } else {
    // Inelastic collision (0 < coefficient of restitution < 1)
    const result = collisionVelocity(body1.mass, v1x, body2.mass, v2x, coefficientOfRestitution);
    v1xFinal = result.v1Final;
    v2xFinal = result.v2Final;
  }

  // Calculate kinetic energy after collision
  const keAfter = 0.5 * body1.mass * v1xFinal ** 2 +
                  0.5 * body2.mass * v2xFinal ** 2;

  // Calculate energy loss
  const energyLoss = Math.max(0, keBefore - keAfter);

  // Create new state with updated velocities
  const newBody1: Body = {
    ...body1,
    velocity: new THREE.Vector3(v1xFinal, body1.velocity.y, body1.velocity.z),
  };

  const newBody2: Body = {
    ...body2,
    velocity: new THREE.Vector3(v2xFinal, body2.velocity.y, body2.velocity.z),
  };

  const newState: CollisionState = {
    ...state,
    body1: newBody1,
    body2: newBody2,
    collisionType,
  };

  return {
    state: newState,
    energyLoss,
  };
}

/**
 * Update positions based on velocities
 */
export function updatePositions(state: CollisionState, deltaTime: number): CollisionState {
  const newBody1: Body = {
    ...state.body1,
    position: state.body1.position.clone().add(
      state.body1.velocity.clone().multiplyScalar(deltaTime)
    ),
  };

  const newBody2: Body = {
    ...state.body2,
    position: state.body2.position.clone().add(
      state.body2.velocity.clone().multiplyScalar(deltaTime)
    ),
  };

  return {
    ...state,
    body1: newBody1,
    body2: newBody2,
    time: state.time + deltaTime,
  };
}

/**
 * Calculate collision data (momentum and energy)
 */
export function calculateCollisionData(state: CollisionState): CollisionData {
  const { body1, body2 } = state;

  // Calculate momenta (X component only, since collision is 1D)
  const momentumBody1 = momentum(body1.mass, body1.velocity.x);
  const momentumBody2 = momentum(body2.mass, body2.velocity.x);

  // Total momentum (should be conserved)
  const totalMomentum = Math.abs(momentumBody1 + momentumBody2);

  // Calculate kinetic energies
  const velocityBody1 = body1.velocity.length();
  const velocityBody2 = body2.velocity.length();
  const kineticEnergyBody1 = kineticEnergy(body1.mass, velocityBody1);
  const kineticEnergyBody2 = kineticEnergy(body2.mass, velocityBody2);
  const totalKE = kineticEnergyBody1 + kineticEnergyBody2;

  // Calculate energy loss (will be provided by resolveCollision)
  // For display purposes, we use the current state
  let energyLoss = 0;

  if (state.collisionType === 'elastic') {
    energyLoss = 0;
  } else if (state.collisionType === 'perfectly-inelastic') {
    // For perfectly inelastic collision, calculate based on reduced mass
    const totalMass = body1.mass + body2.mass;
    const reducedMass = (body1.mass * body2.mass) / totalMass;
    const vRelative = body1.velocity.x - body2.velocity.x;
    const keLossInitial = 0.5 * reducedMass * vRelative ** 2;
    // For e=0, all relative kinetic energy is lost
    energyLoss = keLossInitial;
  } else {
    // For general inelastic collision (0 < e < 1)
    const totalMass = body1.mass + body2.mass;
    const reducedMass = (body1.mass * body2.mass) / totalMass;
    const vRelative = body1.velocity.x - body2.velocity.x;
    const keLossInitial = 0.5 * reducedMass * vRelative ** 2;
    // Energy loss = (1 - e²) * kinetic energy of relative motion
    // Use default coefficient of restitution (0.5) for estimation
    const e = 0.5;
    energyLoss = keLossInitial * (1 - e * e);
  }

  return {
    totalMomentum,
    totalKE,
    momentumBody1,
    momentumBody2,
    velocityBody1,
    velocityBody2,
    kineticEnergyBody1,
    kineticEnergyBody2,
    energyLoss,
  };
}

/**
 * Calculate pre-collision energy for comparison
 */
export function calculateInitialEnergy(state: CollisionState): number {
  const velocityBody1 = state.body1.velocity.length();
  const velocityBody2 = state.body2.velocity.length();
  return kineticEnergy(state.body1.mass, velocityBody1) +
         kineticEnergy(state.body2.mass, velocityBody2);
}

/**
 * Calculate post-collision energy for comparison
 */
export function calculateFinalEnergy(state: CollisionState): number {
  const velocityBody1 = state.body1.velocity.length();
  const velocityBody2 = state.body2.velocity.length();
  return kineticEnergy(state.body1.mass, velocityBody1) +
         kineticEnergy(state.body2.mass, velocityBody2);
}

/**
 * Verify momentum conservation
 */
export function verifyMomentumConservation(
  preCollisionState: CollisionState,
  postCollisionState: CollisionState
): boolean {
  const preMomentum = preCollisionState.body1.mass * preCollisionState.body1.velocity.x +
                      preCollisionState.body2.mass * preCollisionState.body2.velocity.x;

  const postMomentum = postCollisionState.body1.mass * postCollisionState.body1.velocity.x +
                       postCollisionState.body2.mass * postCollisionState.body2.velocity.x;

  // Check if momentum is conserved (allow for small numerical errors)
  const tolerance = 1e-6;
  return Math.abs(preMomentum - postMomentum) < tolerance;
}
