import * as THREE from 'three';
import { ExperimentBase, type ExperimentMetadata, type ExperimentConfig, type DisplayValue } from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  createInitialState,
  detectCollision,
  resolveCollision,
  updatePositions,
  calculateCollisionData,
  calculateInitialEnergy,
  type CollisionState,
  type CollisionType,
  type CollisionData,
  type CollisionResolutionResult,
} from './CollisionPhysics';

/**
 * Collision & Momentum Conservation Laboratory
 *
 * Explore elastic, inelastic, and perfectly inelastic collisions.
 * Verify conservation of momentum and energy in different collision scenarios.
 *
 * Core Features:
 * - Three collision types: elastic, inelastic, perfectly inelastic
 * - Adjustable masses and initial velocities
 * - Real-time monitoring of momentum and kinetic energy
 * - Vector visualization (velocity and momentum arrows)
 * - Collision point marking
 * - Energy loss display for inelastic collisions
 * - Verification of momentum conservation
 *
 * Physical Model: One-dimensional collision between two spherical bodies
 */
export class Collision extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'collision',
    name: 'Collision & Momentum Conservation Lab',
    category: ExperimentCategory.Mechanics,
    description: 'Explore elastic, inelastic, and perfectly inelastic collisions. Verify conservation of momentum and energy',
    difficulty: 'intermediate',
    duration: 20,
    keywords: ['collision', 'momentum', 'energy', 'conservation', 'elastic', 'inelastic'],
    thumbnail: '/thumbnails/collision.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      timestep: 1 / 60,
    },
    camera: {
      position: [0, 5, 15],
      target: [0, 0, 0],
      fov: 50,
    },
    parameters: [
      {
        key: 'collisionType',
        label: 'Collision Type',
        type: 'select',
        defaultValue: 'elastic',
        options: [
          { value: 'elastic', label: 'Elastic' },
          { value: 'inelastic', label: 'Inelastic' },
          { value: 'perfectly-inelastic', label: 'Perfectly Inelastic' },
        ],
      },
      {
        key: 'body1Mass',
        label: 'Body 1 Mass',
        type: 'number',
        defaultValue: 2.0,
        min: 0.5,
        max: 10,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'body2Mass',
        label: 'Body 2 Mass',
        type: 'number',
        defaultValue: 1.0,
        min: 0.5,
        max: 10,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'body1Velocity',
        label: 'Body 1 Initial Velocity',
        type: 'number',
        defaultValue: 3.0,
        min: -10,
        max: 10,
        step: 0.1,
        unit: 'm/s',
      },
      {
        key: 'body2Velocity',
        label: 'Body 2 Initial Velocity',
        type: 'number',
        defaultValue: -2.0,
        min: -10,
        max: 10,
        step: 0.1,
        unit: 'm/s',
      },
      {
        key: 'coefficientOfRestitution',
        label: 'Coefficient of Restitution',
        type: 'number',
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
      },
      {
        key: 'showVectors',
        label: 'Show Vectors',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  // State
  private collisionState: CollisionState | null = null;
  private preCollisionEnergy: number = 0;
  private hasCollided: boolean = false;
  private collisionMarker: THREE.Mesh | null = null;
  private energyLoss: number = 0;

  // 3D object references
  private groundPlane: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private body1Mesh: THREE.Mesh | null = null;
  private body2Mesh: THREE.Mesh | null = null;
  private velocityArrow1: THREE.ArrowHelper | null = null;
  private velocityArrow2: THREE.ArrowHelper | null = null;
  private momentumArrow1: THREE.ArrowHelper | null = null;
  private momentumArrow2: THREE.ArrowHelper | null = null;
  private totalMomentumArrow: THREE.ArrowHelper | null = null;
  private energyBar1: THREE.Mesh | null = null;
  private energyBar2: THREE.Mesh | null = null;

  // Vector arrow scale factors
  private readonly VELOCITY_SCALE = 0.5;
  private readonly MOMENTUM_SCALE = 0.3;

  // Constants for visualization
  private readonly BODY1_COLOR = 0xff6b6b; // Red
  private readonly BODY2_COLOR = 0x4ecdc4; // Blue
  private readonly GROUND_COLOR = 0x1a1a2e;

  protected async setupScene(): Promise<void> {
    if (!this.scene) return;

    // Create ground
    this.createGround();

    // Create grid
    this.createGrid();

    // Initialize collision
    this.resetCollision();
  }

  private createGround(): void {
    if (!this.scene) return;

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: this.GROUND_COLOR,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.1;
    this.groundPlane.receiveShadow = true;
    this.addToScene(this.groundPlane);

    // Grid helper
    this.gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
    this.gridHelper.position.y = 0;
    this.addToScene(this.gridHelper);
  }

  private createGrid(): void {
    if (!this.scene) return;

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.position.set(0, 0, 0);
    this.addToScene(axesHelper);
  }

  private createBodyMeshes(): void {
    if (!this.scene || !this.collisionState) return;

    // Remove old meshes
    if (this.body1Mesh) {
      this.removeFromScene(this.body1Mesh);
    }
    if (this.body2Mesh) {
      this.removeFromScene(this.body2Mesh);
    }

    const { body1, body2 } = this.collisionState;

    // Create body 1 (red sphere)
    const geometry1 = new THREE.SphereGeometry(body1.radius, 32, 32);
    const material1 = new THREE.MeshStandardMaterial({
      color: this.BODY1_COLOR,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.body1Mesh = new THREE.Mesh(geometry1, material1);
    this.body1Mesh.position.copy(body1.position);
    this.body1Mesh.castShadow = true;
    this.body1Mesh.receiveShadow = true;
    this.addToScene(this.body1Mesh);

    // Create body 2 (blue sphere)
    const geometry2 = new THREE.SphereGeometry(body2.radius, 32, 32);
    const material2 = new THREE.MeshStandardMaterial({
      color: this.BODY2_COLOR,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.body2Mesh = new THREE.Mesh(geometry2, material2);
    this.body2Mesh.position.copy(body2.position);
    this.body2Mesh.castShadow = true;
    this.body2Mesh.receiveShadow = true;
    this.addToScene(this.body2Mesh);
  }

  private createVectorArrows(): void {
    if (!this.scene || !this.collisionState || !this.showVectors) return;

    // Remove old arrows
    if (this.velocityArrow1) {
      this.removeFromScene(this.velocityArrow1);
    }
    if (this.velocityArrow2) {
      this.removeFromScene(this.velocityArrow2);
    }
    if (this.momentumArrow1) {
      this.removeFromScene(this.momentumArrow1);
    }
    if (this.momentumArrow2) {
      this.removeFromScene(this.momentumArrow2);
    }
    if (this.totalMomentumArrow) {
      this.removeFromScene(this.totalMomentumArrow);
    }

    const { body1, body2 } = this.collisionState;

    // Velocity arrows (yellow)
    const v1Length = body1.velocity.length() * this.VELOCITY_SCALE;
    const v2Length = body2.velocity.length() * this.VELOCITY_SCALE;

    if (v1Length > 0.01) {
      const v1Dir = body1.velocity.clone().normalize();
      this.velocityArrow1 = new THREE.ArrowHelper(
        v1Dir,
        body1.position.clone().add(new THREE.Vector3(0, body1.radius + 0.5, 0)),
        v1Length,
        0xffff00,
        0.5,
        0.3
      );
      this.addToScene(this.velocityArrow1);
    }

    if (v2Length > 0.01) {
      const v2Dir = body2.velocity.clone().normalize();
      this.velocityArrow2 = new THREE.ArrowHelper(
        v2Dir,
        body2.position.clone().add(new THREE.Vector3(0, body2.radius + 0.5, 0)),
        v2Length,
        0xffff00,
        0.5,
        0.3
      );
      this.addToScene(this.velocityArrow2);
    }

    // Momentum arrows (green for body 1, cyan for body 2)
    const p1 = body1.mass * body1.velocity.x;
    const p2 = body2.mass * body2.velocity.x;

    const p1Length = Math.abs(p1) * this.MOMENTUM_SCALE;
    const p2Length = Math.abs(p2) * this.MOMENTUM_SCALE;

    if (p1Length > 0.01) {
      const p1Dir = new THREE.Vector3(Math.sign(p1), 0, 0);
      this.momentumArrow1 = new THREE.ArrowHelper(
        p1Dir,
        body1.position.clone().add(new THREE.Vector3(0, body1.radius + 1.2, 0)),
        p1Length,
        0x00ff00,
        0.4,
        0.25
      );
      this.addToScene(this.momentumArrow1);
    }

    if (p2Length > 0.01) {
      const p2Dir = new THREE.Vector3(Math.sign(p2), 0, 0);
      this.momentumArrow2 = new THREE.ArrowHelper(
        p2Dir,
        body2.position.clone().add(new THREE.Vector3(0, body2.radius + 1.2, 0)),
        p2Length,
        0x00ffff,
        0.4,
        0.25
      );
      this.addToScene(this.momentumArrow2);
    }

    // Total momentum arrow (magenta)
    const totalP = p1 + p2;
    const totalPLength = Math.abs(totalP) * this.MOMENTUM_SCALE;

    if (totalPLength > 0.01) {
      const totalDir = new THREE.Vector3(Math.sign(totalP), 0, 0);
      const midpoint = body1.position.clone().add(body2.position).multiplyScalar(0.5);
      midpoint.y += 2;
      this.totalMomentumArrow = new THREE.ArrowHelper(
        totalDir,
        midpoint,
        totalPLength,
        0xff00ff,
        0.5,
        0.3
      );
      this.addToScene(this.totalMomentumArrow);
    }
  }

  private updateVectorArrows(): void {
    if (!this.collisionState || !this.showVectors) return;

    const { body1, body2 } = this.collisionState;

    // Update velocity arrows
    if (this.velocityArrow1) {
      this.velocityArrow1.position.copy(body1.position).add(new THREE.Vector3(0, body1.radius + 0.5, 0));
      const v1Length = body1.velocity.length() * this.VELOCITY_SCALE;
      if (v1Length > 0.01) {
        const dir = body1.velocity.clone().normalize();
        this.velocityArrow1.setDirection(dir);
        this.velocityArrow1.setLength(v1Length);
        this.velocityArrow1.visible = true;
      } else {
        this.velocityArrow1.visible = false;
      }
    }

    if (this.velocityArrow2) {
      this.velocityArrow2.position.copy(body2.position).add(new THREE.Vector3(0, body2.radius + 0.5, 0));
      const v2Length = body2.velocity.length() * this.VELOCITY_SCALE;
      if (v2Length > 0.01) {
        const dir = body2.velocity.clone().normalize();
        this.velocityArrow2.setDirection(dir);
        this.velocityArrow2.setLength(v2Length);
        this.velocityArrow2.visible = true;
      } else {
        this.velocityArrow2.visible = false;
      }
    }

    // Update momentum arrows
    const p1 = body1.mass * body1.velocity.x;
    const p2 = body2.mass * body2.velocity.x;

    if (this.momentumArrow1) {
      this.momentumArrow1.position.copy(body1.position).add(new THREE.Vector3(0, body1.radius + 1.2, 0));
      const p1Length = Math.abs(p1) * this.MOMENTUM_SCALE;
      if (p1Length > 0.01) {
        const dir = new THREE.Vector3(Math.sign(p1), 0, 0);
        this.momentumArrow1.setDirection(dir);
        this.momentumArrow1.setLength(p1Length);
        this.momentumArrow1.visible = true;
      } else {
        this.momentumArrow1.visible = false;
      }
    }

    if (this.momentumArrow2) {
      this.momentumArrow2.position.copy(body2.position).add(new THREE.Vector3(0, body2.radius + 1.2, 0));
      const p2Length = Math.abs(p2) * this.MOMENTUM_SCALE;
      if (p2Length > 0.01) {
        const dir = new THREE.Vector3(Math.sign(p2), 0, 0);
        this.momentumArrow2.setDirection(dir);
        this.momentumArrow2.setLength(p2Length);
        this.momentumArrow2.visible = true;
      } else {
        this.momentumArrow2.visible = false;
      }
    }

    // Update total momentum arrow
    const totalP = p1 + p2;
    if (this.totalMomentumArrow) {
      const midpoint = body1.position.clone().add(body2.position).multiplyScalar(0.5);
      midpoint.y += 2;
      this.totalMomentumArrow.position.copy(midpoint);
      const totalPLength = Math.abs(totalP) * this.MOMENTUM_SCALE;
      if (totalPLength > 0.01) {
        const dir = new THREE.Vector3(Math.sign(totalP), 0, 0);
        this.totalMomentumArrow.setDirection(dir);
        this.totalMomentumArrow.setLength(totalPLength);
        this.totalMomentumArrow.visible = true;
      } else {
        this.totalMomentumArrow.visible = false;
      }
    }
  }

  private createCollisionMarker(): void {
    if (!this.scene || !this.collisionState) return;

    // Remove old marker
    if (this.collisionMarker) {
      this.removeFromScene(this.collisionMarker);
    }

    const { body1, body2 } = this.collisionState;

    // Create collision point marker (yellow sphere)
    const markerGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8,
    });
    this.collisionMarker = new THREE.Mesh(markerGeometry, markerMaterial);

    // Position at collision point
    const collisionPoint = body1.position.clone().add(body2.position).multiplyScalar(0.5);
    this.collisionMarker.position.copy(collisionPoint);
    this.addToScene(this.collisionMarker);
  }

  private resetCollision(): void {
    const collisionType = this.getParameter('collisionType') as CollisionType;
    const body1Mass = this.getParameter('body1Mass') as number;
    const body2Mass = this.getParameter('body2Mass') as number;
    const body1Velocity = this.getParameter('body1Velocity') as number;
    const body2Velocity = this.getParameter('body2Velocity') as number;

    this.collisionState = createInitialState(
      body1Mass,
      body2Mass,
      body1Velocity,
      body2Velocity,
      collisionType
    );

    // Store initial energy for comparison
    this.preCollisionEnergy = calculateInitialEnergy(this.collisionState);
    this.hasCollided = false;
    this.energyLoss = 0;

    // Create 3D objects
    this.createBodyMeshes();
    this.createVectorArrows();

    // Remove old collision marker
    if (this.collisionMarker) {
      this.removeFromScene(this.collisionMarker);
      this.collisionMarker = null;
    }
  }

  private get showVectors(): boolean {
    return this.getParameter('showVectors') as boolean;
  }

  protected onStart(): void {
    this.resetCollision();
  }

  protected onReset(): void {
    this.resetCollision();
  }

  protected onParameterChange(key: string): void {
    if (['collisionType', 'body1Mass', 'body2Mass', 'body1Velocity', 'body2Velocity'].includes(key)) {
      // Reset experiment when parameters change
      this.resetCollision();
    } else if (key === 'showVectors') {
      // Update vector arrow display
      if (this.showVectors) {
        this.createVectorArrows();
      } else {
        if (this.velocityArrow1) {
          this.removeFromScene(this.velocityArrow1);
          this.velocityArrow1 = null;
        }
        if (this.velocityArrow2) {
          this.removeFromScene(this.velocityArrow2);
          this.velocityArrow2 = null;
        }
        if (this.momentumArrow1) {
          this.removeFromScene(this.momentumArrow1);
          this.momentumArrow1 = null;
        }
        if (this.momentumArrow2) {
          this.removeFromScene(this.momentumArrow2);
          this.momentumArrow2 = null;
        }
        if (this.totalMomentumArrow) {
          this.removeFromScene(this.totalMomentumArrow);
          this.totalMomentumArrow = null;
        }
      }
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.collisionState) return;

    // Check for collision
    if (!this.hasCollided && detectCollision(this.collisionState.body1, this.collisionState.body2)) {
      // Handle collision
      const collisionType = this.getParameter('collisionType') as CollisionType;
      const coefficientOfRestitution = this.getParameter('coefficientOfRestitution') as number;

      // Resolve collision and get energy loss
      const result = resolveCollision(this.collisionState, collisionType, coefficientOfRestitution);
      this.collisionState = result.state;
      this.energyLoss = result.energyLoss;
      this.hasCollided = true;

      // Adjust positions to eliminate overlap
      const { body1, body2 } = this.collisionState;
      const distance = body1.position.distanceTo(body2.position);
      const minDistance = body1.radius + body2.radius;

      if (distance < minDistance) {
        const overlap = minDistance - distance;
        // Calculate separation direction
        const direction = body2.position.clone()
          .sub(body1.position)
          .normalize();

        // Move each sphere half the overlap distance
        const separation = direction.clone().multiplyScalar(overlap / 2);
        body1.position.sub(separation);
        body2.position.add(separation);

        // Update 3D object positions
        if (this.body1Mesh) {
          this.body1Mesh.position.copy(body1.position);
        }
        if (this.body2Mesh) {
          this.body2Mesh.position.copy(body2.position);
        }
      }

      // Create collision marker
      this.createCollisionMarker();

      // Flash effect (brief color change)
      if (this.body1Mesh) {
        (this.body1Mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xffff00);
        setTimeout(() => {
          if (this.body1Mesh) {
            (this.body1Mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          }
        }, 100);
      }
      if (this.body2Mesh) {
        (this.body2Mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xffff00);
        setTimeout(() => {
          if (this.body2Mesh) {
            (this.body2Mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          }
        }, 100);
      }
    }

    // Update positions
    this.collisionState = updatePositions(this.collisionState, deltaTime);

    // Update mesh positions
    if (this.body1Mesh) {
      this.body1Mesh.position.copy(this.collisionState.body1.position);
    }
    if (this.body2Mesh) {
      this.body2Mesh.position.copy(this.collisionState.body2.position);
    }

    // Update vector arrows
    if (this.showVectors) {
      this.updateVectorArrows();
    }
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.collisionState) {
      return {};
    }

    const data = calculateCollisionData(this.collisionState);

    // Use actual energy loss from collision if available, otherwise use calculated value
    const displayEnergyLoss = this.hasCollided ? this.energyLoss : data.energyLoss;

    return {
      time: {
        label: 'Time',
        value: this.collisionState.time.toFixed(2),
        unit: 's',
      },
      body1Velocity: {
        label: 'Body 1 Velocity',
        value: data.velocityBody1.toFixed(2),
        unit: 'm/s',
      },
      body2Velocity: {
        label: 'Body 2 Velocity',
        value: data.velocityBody2.toFixed(2),
        unit: 'm/s',
      },
      totalMomentum: {
        label: 'Total Momentum',
        value: data.totalMomentum.toFixed(2),
        unit: 'kg·m/s',
      },
      momentumBody1: {
        label: 'Momentum Body 1',
        value: data.momentumBody1.toFixed(2),
        unit: 'kg·m/s',
      },
      momentumBody2: {
        label: 'Momentum Body 2',
        value: data.momentumBody2.toFixed(2),
        unit: 'kg·m/s',
      },
      totalKE: {
        label: 'Total Kinetic Energy',
        value: data.totalKE.toFixed(2),
        unit: 'J',
      },
      kineticEnergyBody1: {
        label: 'Kinetic Energy Body 1',
        value: data.kineticEnergyBody1.toFixed(2),
        unit: 'J',
      },
      kineticEnergyBody2: {
        label: 'Kinetic Energy Body 2',
        value: data.kineticEnergyBody2.toFixed(2),
        unit: 'J',
      },
      energyLoss: {
        label: 'Energy Loss',
        value: displayEnergyLoss.toFixed(2),
        unit: 'J',
      },
    };
  }

  dispose(): void {
    // Clean up vector arrows
    if (this.velocityArrow1) {
      this.removeFromScene(this.velocityArrow1);
      this.velocityArrow1 = null;
    }
    if (this.velocityArrow2) {
      this.removeFromScene(this.velocityArrow2);
      this.velocityArrow2 = null;
    }
    if (this.momentumArrow1) {
      this.removeFromScene(this.momentumArrow1);
      this.momentumArrow1 = null;
    }
    if (this.momentumArrow2) {
      this.removeFromScene(this.momentumArrow2);
      this.momentumArrow2 = null;
    }
    if (this.totalMomentumArrow) {
      this.removeFromScene(this.totalMomentumArrow);
      this.totalMomentumArrow = null;
    }

    // Clean up collision marker
    if (this.collisionMarker) {
      this.removeFromScene(this.collisionMarker);
      this.collisionMarker = null;
    }

    super.dispose();
  }
}
