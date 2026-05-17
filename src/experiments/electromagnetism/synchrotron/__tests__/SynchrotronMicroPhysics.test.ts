import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DESIGN_BEND_ARC,
  DESIGN_ORBIT_RADIUS,
  createMicroState,
  detectBeamCollision,
  getRequiredBForDesignOrbit,
  stepMicroState,
  type SynchrotronMicroSettings,
} from '../SynchrotronMicroPhysics.ts';

const baseSettings: SynchrotronMicroSettings = {
  mechanism: 'rf',
  electricFieldStrength: 1.2,
  magneticFieldStrength: 1.4,
  charge: 1,
  mass: 1,
  initialSpeed: 1.4,
};

test('RF acceleration segment increases particle speed', () => {
  const state = createMicroState(baseSettings);
  const initialSpeed = state.particles[0].velocity.length();
  let next = state;
  for (let index = 0; index < 20; index += 1) {
    next = stepMicroState(next, baseSettings, 0.016);
  }

  assert.ok(next.particles[0].velocity.length() > initialSpeed);
});

test('magnetic bending segment changes direction while preserving speed', () => {
  const settings: SynchrotronMicroSettings = {
    ...baseSettings,
    mechanism: 'bending',
  };
  const state = createMicroState(settings);
  const initialSpeed = state.particles[0].velocity.length();
  let next = state;
  for (let index = 0; index < 180; index += 1) {
    next = stepMicroState(next, settings, 0.016);
  }

  const radii = next.particles[0].trajectory.map((point) => Math.hypot(point.x, point.z));
  const maxRadiusError = Math.max(...radii.map((radius) => Math.abs(radius - DESIGN_ORBIT_RADIUS)));

  assert.ok((next.orbitProgress ?? 0) > 0.1);
  assert.ok(Math.abs(next.particles[0].velocity.length() - initialSpeed) < 0.01);
  assert.ok(maxRadiusError < 0.02);
});

test('magnetic bending segment covers a full 360 degree orbit instead of a partial arc', () => {
  const settings: SynchrotronMicroSettings = {
    ...baseSettings,
    mechanism: 'bending',
    initialSpeed: 2.4,
  };
  assert.equal(DESIGN_BEND_ARC, Math.PI * 2);

  let state = createMicroState(settings);
  for (let index = 0; index < 380; index += 1) {
    state = stepMicroState(state, settings, 0.016);
  }

  const points = state.particles[0].trajectory;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));

  assert.ok(minX < -DESIGN_ORBIT_RADIUS + 0.08);
  assert.ok(maxX > DESIGN_ORBIT_RADIUS - 0.08);
  assert.ok(minZ < -DESIGN_ORBIT_RADIUS + 0.08);
  assert.ok(maxZ > DESIGN_ORBIT_RADIUS - 0.08);
});

test('synchronized orbit starts slowly, accelerates clearly, and stays locked to the bending radius', () => {
  const settings: SynchrotronMicroSettings = {
    ...baseSettings,
    mechanism: 'synchronized',
    electricFieldStrength: 1.8,
    magneticFieldStrength: 0.6,
    initialSpeed: 2.5,
  };
  let state = createMicroState(settings);
  const initialSpeed = state.particles[0].velocity.length();
  assert.ok(initialSpeed < 0.95);

  for (let index = 0; index < 160; index += 1) {
    state = stepMicroState(state, settings, 0.016);
  }

  const particle = state.particles[0];
  const radius = Math.hypot(particle.position.x, particle.position.z);

  assert.ok(particle.velocity.length() > initialSpeed + 1.2);
  assert.ok(Math.abs(radius - DESIGN_ORBIT_RADIUS) < 0.02);
  assert.ok(getRequiredBForDesignOrbit(particle.velocity.length(), settings) > settings.magneticFieldStrength);
});

test('collision segment detects counter-running beams near the interaction point', () => {
  const settings: SynchrotronMicroSettings = {
    ...baseSettings,
    mechanism: 'collision',
    initialSpeed: 2.2,
  };
  let state = createMicroState(settings);
  for (let index = 0; index < 90 && !state.collision.hasCollided; index += 1) {
    state = stepMicroState(state, settings, 0.016);
  }

  assert.equal(detectBeamCollision(state.particles, 0.28), true);
  assert.equal(state.collision.hasCollided, true);
});
