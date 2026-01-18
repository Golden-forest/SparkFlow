import * as THREE from 'three';
import type { PhysicsObjectConfig } from '../types/ObjectTypes';

export class PhysicsObjectFactory {
  private static readonly MATERIALS = {
    sphere: new THREE.MeshStandardMaterial({
      color: 0x00ff41,
      metalness: 0.3,
      roughness: 0.7,
    }),
    box: new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      metalness: 0.5,
      roughness: 0.5,
    }),
    plank: new THREE.MeshStandardMaterial({
      color: 0xd8ca9d,
      metalness: 0.1,
      roughness: 0.8,
    }),
  };

  static create(config: PhysicsObjectConfig): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    let material: THREE.MeshStandardMaterial;

    switch (config.type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(config.radius || 1, 32, 32);
        material = this.MATERIALS.sphere.clone();
        break;

      case 'box':
        geometry = new THREE.BoxGeometry(
          config.width || 2,
          config.height || 2,
          config.depth || 2
        );
        material = this.MATERIALS.box.clone();
        break;

      case 'plank':
        geometry = new THREE.BoxGeometry(
          config.width || 4,
          config.height || 0.5,
          config.depth || 2
        );
        material = this.MATERIALS.plank.clone();
        break;

      default:
        throw new Error(`Unknown object type: ${config.type}`);
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(config.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  static dispose(): void {
    Object.values(this.MATERIALS).forEach(material => material.dispose());
  }
}
