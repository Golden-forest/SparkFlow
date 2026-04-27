import * as THREE from 'three';

export type RotationDirection = 'counterclockwise' | 'clockwise';

export interface CircularMotionParameters {
  radius: number;
  angularSpeed: number;
  mass: number;
  height: number;
  initialAngle?: number;
}

export interface CircularMotionState {
  angle: number;
  radius: number;
  angularSpeed: number;
  mass: number;
  height: number;
  time: number;
  revolutions: number;
  position: THREE.Vector3;
}

export interface CircularMotionMetrics {
  period: number;
  frequency: number;
  tangentialSpeed: number;
  centripetalAcceleration: number;
  centripetalForce: number;
}

export function toDirectionSign(direction: RotationDirection): 1 | -1 {
  return direction === 'clockwise' ? -1 : 1;
}

export function calculateCircularPosition(radius: number, height: number, angle: number): THREE.Vector3 {
  return new THREE.Vector3(radius * Math.cos(angle), height, radius * Math.sin(angle));
}

export function createInitialCircularState(params: CircularMotionParameters): CircularMotionState {
  const initialAngle = params.initialAngle ?? 0;

  return {
    angle: initialAngle,
    radius: params.radius,
    angularSpeed: Math.abs(params.angularSpeed),
    mass: params.mass,
    height: params.height,
    time: 0,
    revolutions: 0,
    position: calculateCircularPosition(params.radius, params.height, initialAngle),
  };
}

export function stepCircularMotion(
  state: CircularMotionState,
  deltaTime: number,
  directionSign: 1 | -1
): CircularMotionState {
  const nextAngle = state.angle + directionSign * state.angularSpeed * deltaTime;
  const nextRevolutions = Math.abs(nextAngle) / (2 * Math.PI);

  return {
    ...state,
    angle: nextAngle,
    time: state.time + deltaTime,
    revolutions: nextRevolutions,
    position: calculateCircularPosition(state.radius, state.height, nextAngle),
  };
}

export function calculateCircularMetrics(state: CircularMotionState): CircularMotionMetrics {
  const omega = Math.abs(state.angularSpeed);
  const tangentialSpeed = omega * state.radius;
  const centripetalAcceleration = omega * omega * state.radius;
  const centripetalForce = state.mass * centripetalAcceleration;
  const period = omega > 0 ? (2 * Math.PI) / omega : Number.POSITIVE_INFINITY;
  const frequency = omega / (2 * Math.PI);

  return {
    period,
    frequency,
    tangentialSpeed,
    centripetalAcceleration,
    centripetalForce,
  };
}

export function calculateTangentialDirection(angle: number, directionSign: 1 | -1): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(angle) * directionSign, 0, Math.cos(angle) * directionSign).normalize();
}

export function calculateCentripetalDirection(angle: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle)).normalize();
}
