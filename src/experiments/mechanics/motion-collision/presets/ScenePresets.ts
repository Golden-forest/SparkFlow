import * as THREE from 'three';
import type { SimulationObject, ObjectType } from '../types/ObjectTypes';

/**
 * 场景预设类型 (Task 7.1)
 */
export interface ScenePreset {
  id: string;
  name: string;
  description: string;
  objects: Omit<SimulationObject, 'mesh' | 'trajectory' | 'isSelected' | 'acceleration'>[];
}

/**
 * 预定义场景预设
 */
export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'free-fall',
    name: 'Free Fall',
    description: 'Single object falling under gravity',
    objects: [
      {
        id: 'sphere-1',
        type: 'sphere' as ObjectType,
        position: new THREE.Vector3(0, 5, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        mass: 1.0,
        radius: 0.5,
      },
    ],
  },
  {
    id: 'elastic-collision',
    name: 'Elastic Collision',
    description: 'Two spheres colliding head-on',
    objects: [
      {
        id: 'sphere-1',
        type: 'sphere' as ObjectType,
        position: new THREE.Vector3(-3, 0.5, 0),
        velocity: new THREE.Vector3(2, 0, 0),
        mass: 1.0,
        radius: 0.5,
      },
      {
        id: 'sphere-2',
        type: 'sphere' as ObjectType,
        position: new THREE.Vector3(3, 0.5, 0),
        velocity: new THREE.Vector3(-2, 0, 0),
        mass: 1.0,
        radius: 0.5,
      },
    ],
  },
  {
    id: 'projectile',
    name: 'Projectile Motion',
    description: 'Ball launched at an angle',
    objects: [
      {
        id: 'sphere-1',
        type: 'sphere' as ObjectType,
        position: new THREE.Vector3(-4, 0.5, 0),
        velocity: new THREE.Vector3(3, 4, 0),
        mass: 1.0,
        radius: 0.5,
      },
    ],
  },
  {
    id: 'three-body',
    name: 'Three Body Collision',
    description: 'Three objects with different masses',
    objects: [
      {
        id: 'sphere-1',
        type: 'sphere' as ObjectType,
        position: new THREE.Vector3(-4, 0.5, 0),
        velocity: new THREE.Vector3(2, 0, 0),
        mass: 1.0,
        radius: 0.5,
      },
      {
        id: 'sphere-2',
        type: 'sphere' as ObjectType,
        position: new THREE.Vector3(0, 0.5, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        mass: 2.0,
        radius: 0.7,
      },
      {
        id: 'sphere-3',
        type: 'sphere' as ObjectType,
        position: new THREE.Vector3(4, 0.5, 0),
        velocity: new THREE.Vector3(-2, 0, 0),
        mass: 1.0,
        radius: 0.5,
      },
    ],
  },
];
