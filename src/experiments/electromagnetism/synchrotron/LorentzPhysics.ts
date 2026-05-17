import * as THREE from 'three';

export interface FieldParameters {
  electricField: THREE.Vector3;
  magneticField: THREE.Vector3;
  charge: number;
  mass: number;
}

export interface ChargedParticleState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  time: number;
  trajectory: THREE.Vector3[];
}

export interface ParticleInitialState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const MAX_TRAJECTORY_POINTS = 320;
const MIN_MASS = 0.01;

export function calculateLorentzForce(
  velocity: THREE.Vector3,
  fields: FieldParameters,
): THREE.Vector3 {
  const magneticTerm = new THREE.Vector3().crossVectors(velocity, fields.magneticField);
  return fields.electricField.clone().add(magneticTerm).multiplyScalar(fields.charge);
}

export function createChargedParticleState(initial: ParticleInitialState): ChargedParticleState {
  return {
    position: initial.position.clone(),
    velocity: initial.velocity.clone(),
    acceleration: new THREE.Vector3(),
    time: 0,
    trajectory: [initial.position.clone()],
  };
}

export function stepChargedParticle(
  state: ChargedParticleState,
  fields: FieldParameters,
  deltaTime: number,
): ChargedParticleState {
  const mass = Math.max(Math.abs(fields.mass), MIN_MASS);
  const chargeToMass = fields.charge / mass;
  const dt = Math.max(0, Math.min(deltaTime, 0.05));

  // Boris integration keeps pure magnetic motion stable for an educational real-time demo.
  const electricHalfKick = fields.electricField.clone().multiplyScalar(chargeToMass * dt * 0.5);
  const vMinus = state.velocity.clone().add(electricHalfKick);

  const t = fields.magneticField.clone().multiplyScalar(chargeToMass * dt * 0.5);
  const s = t.clone().multiplyScalar(2 / (1 + t.lengthSq()));
  const vPrime = vMinus.clone().add(new THREE.Vector3().crossVectors(vMinus, t));
  const vPlus = vMinus.clone().add(new THREE.Vector3().crossVectors(vPrime, s));
  const nextVelocity = vPlus.add(electricHalfKick);
  const nextPosition = state.position.clone().add(nextVelocity.clone().multiplyScalar(dt));

  const force = calculateLorentzForce(nextVelocity, fields);
  const acceleration = force.multiplyScalar(1 / mass);
  const trajectory = [...state.trajectory, nextPosition.clone()].slice(-MAX_TRAJECTORY_POINTS);

  return {
    position: nextPosition,
    velocity: nextVelocity,
    acceleration,
    time: state.time + dt,
    trajectory,
  };
}

export function calculateCyclotronRadius(
  velocity: THREE.Vector3,
  magneticField: THREE.Vector3,
  charge: number,
  mass: number,
): number {
  const magneticStrength = magneticField.length();
  const chargeMagnitude = Math.abs(charge);
  if (magneticStrength < 0.0001 || chargeMagnitude < 0.0001) {
    return Number.POSITIVE_INFINITY;
  }

  const fieldDirection = magneticField.clone().normalize();
  const parallelSpeed = velocity.dot(fieldDirection);
  const parallelVelocity = fieldDirection.multiplyScalar(parallelSpeed);
  const perpendicularSpeed = velocity.clone().sub(parallelVelocity).length();

  return (Math.abs(mass) * perpendicularSpeed) / (chargeMagnitude * magneticStrength);
}
