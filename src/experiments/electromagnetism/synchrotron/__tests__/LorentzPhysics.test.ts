import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createChargedParticleState,
  stepChargedParticle,
  type FieldParameters,
} from '../LorentzPhysics.ts';

test('magnetic field bends velocity while preserving speed when electric field is zero', () => {
  const fields: FieldParameters = {
    electricField: new THREE.Vector3(0, 0, 0),
    magneticField: new THREE.Vector3(0, 1.5, 0),
    charge: 1,
    mass: 2,
  };
  const state = createChargedParticleState({
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(1.6, 0, 0),
  });

  const next = stepChargedParticle(state, fields, 0.05);

  assert.notEqual(next.velocity.z, 0);
  assert.ok(Math.abs(next.velocity.length() - state.velocity.length()) < 0.01);
});
