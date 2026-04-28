import * as THREE from 'three';
import {
  ExperimentBase,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
} from '@/experiments/base';
import { EARTH_GRAVITY, ExperimentCategory } from '@/utils/constants';

type MotionState = 'Static' | 'Sliding Down' | 'Moving Up' | 'Reached Bottom';

interface InclinedPlaneState {
  time: number;
  distance: number; // Distance from top of the ramp (m)
  velocity: number; // Positive direction is down the ramp (m/s)
  acceleration: number; // Along ramp, positive down the ramp (m/s²)
  normalForce: number; // N
  gravityComponent: number; // N
  frictionForce: number; // Magnitude, N
  motionState: MotionState;
}

export class InclinedPlaneFriction extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'inclined-plane-friction',
    name: 'Inclined Plane Friction Lab',
    category: ExperimentCategory.Mechanics,
    description: 'Investigate static and kinetic friction for a block sliding on an inclined plane',
    difficulty: 'basic',
    duration: 18,
    keywords: ['inclined plane', 'friction', 'newton laws', 'force decomposition'],
    thumbnail: '/thumbnails/inclined-plane-friction.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      gravity: [0, -EARTH_GRAVITY, 0],
      timestep: 1 / 60,
    },
    camera: {
      position: [6, 4.5, 8],
      target: [0, 1.2, 0],
      fov: 50,
    },
    parameters: [
      {
        key: 'angle',
        label: 'Ramp Angle',
        type: 'number',
        defaultValue: 25,
        min: 5,
        max: 50,
        step: 1,
        unit: '°',
      },
      {
        key: 'mass',
        label: 'Block Mass',
        type: 'number',
        defaultValue: 1.2,
        min: 0.2,
        max: 5,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'staticFriction',
        label: 'Static Friction Coefficient',
        type: 'number',
        defaultValue: 0.45,
        min: 0,
        max: 1.2,
        step: 0.05,
      },
      {
        key: 'kineticFriction',
        label: 'Kinetic Friction Coefficient',
        type: 'number',
        defaultValue: 0.32,
        min: 0,
        max: 1.2,
        step: 0.05,
      },
      {
        key: 'releaseDistance',
        label: 'Release Distance',
        type: 'number',
        defaultValue: 0.8,
        min: 0,
        max: 5,
        step: 0.1,
        unit: 'm',
      },
    ],
  };

  private readonly rampLength = 5;
  private readonly rampWidth = 1.8;
  private readonly rampThickness = 0.2;
  private readonly blockSize = new THREE.Vector3(0.5, 0.35, 0.45);

  private rampMesh: THREE.Mesh | null = null;
  private blockMesh: THREE.Mesh | null = null;
  private stopMesh: THREE.Mesh | null = null;
  private rampCenter = new THREE.Vector3();
  private state: InclinedPlaneState | null = null;

  protected async setupScene(): Promise<void> {
    this.createLights();
    this.createGround();
    this.createRamp();
    this.createBlock();
    this.createStopBlock();
    this.resetSimulation();
  }

  protected onStart(): void {
    this.resetSimulation();
  }

  protected onReset(): void {
    this.resetSimulation();
  }

  protected onParameterChange(key: string): void {
    if (
      key === 'angle' ||
      key === 'mass' ||
      key === 'staticFriction' ||
      key === 'kineticFriction' ||
      key === 'releaseDistance'
    ) {
      this.resetSimulation();
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.state) {
      return;
    }

    const dt = Math.min(Math.max(deltaTime, 0.001), 0.05);
    this.simulateStep(dt);
    this.updateBlockPosition();
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.state) {
      return {};
    }

    const mass = this.getSafeNumber('mass', 1.2, 0.2, 5);
    const angleRad = this.getAngleRad();
    const height = Math.max(0, (this.rampLength - this.state.distance) * Math.sin(angleRad));
    const kineticEnergy = 0.5 * mass * this.state.velocity * this.state.velocity;
    const potentialEnergy = mass * EARTH_GRAVITY * height;

    return {
      time: { label: 'Time', value: this.state.time.toFixed(2), unit: 's' },
      motionState: { label: 'Motion State', value: this.state.motionState },
      angle: {
        label: 'Ramp Angle',
        value: (this.getAngleRad() * 180 / Math.PI).toFixed(1),
        unit: '°',
      },
      distance: {
        label: 'Distance from Top',
        value: this.state.distance.toFixed(2),
        unit: 'm',
      },
      velocity: {
        label: 'Velocity (Down Ramp +)',
        value: this.state.velocity.toFixed(3),
        unit: 'm/s',
      },
      acceleration: {
        label: 'Acceleration (Down Ramp +)',
        value: this.state.acceleration.toFixed(3),
        unit: 'm/s²',
      },
      gravityComponent: {
        label: 'Gravity Component Along Ramp',
        value: this.state.gravityComponent.toFixed(2),
        unit: 'N',
      },
      frictionForce: {
        label: 'Friction Force Magnitude',
        value: this.state.frictionForce.toFixed(2),
        unit: 'N',
      },
      normalForce: {
        label: 'Normal Force',
        value: this.state.normalForce.toFixed(2),
        unit: 'N',
      },
      kineticEnergy: {
        label: 'Kinetic Energy',
        value: kineticEnergy.toFixed(3),
        unit: 'J',
      },
      potentialEnergy: {
        label: 'Potential Energy',
        value: potentialEnergy.toFixed(3),
        unit: 'J',
      },
      totalEnergy: {
        label: 'Mechanical Energy',
        value: (kineticEnergy + potentialEnergy).toFixed(3),
        unit: 'J',
      },
    };
  }

  dispose(): void {
    this.state = null;
    this.rampMesh = null;
    this.blockMesh = null;
    this.stopMesh = null;
    super.dispose();
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.addToScene(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.9);
    directional.position.set(6, 8, 5);
    directional.castShadow = true;
    this.addToScene(directional);
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.9,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.addToScene(ground);
  }

  private createRamp(): void {
    this.rampMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.rampLength, this.rampThickness, this.rampWidth),
      new THREE.MeshStandardMaterial({
        color: 0x7c5f43,
        roughness: 0.75,
        metalness: 0.15,
      }),
    );
    this.rampMesh.castShadow = true;
    this.rampMesh.receiveShadow = true;
    this.addToScene(this.rampMesh);
  }

  private createBlock(): void {
    this.blockMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.blockSize.x, this.blockSize.y, this.blockSize.z),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        roughness: 0.4,
        metalness: 0.2,
      }),
    );
    this.blockMesh.castShadow = true;
    this.blockMesh.receiveShadow = true;
    this.addToScene(this.blockMesh);
  }

  private createStopBlock(): void {
    this.stopMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.45, this.rampWidth + 0.1),
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.45,
        metalness: 0.25,
      }),
    );
    this.stopMesh.castShadow = true;
    this.stopMesh.receiveShadow = true;
    this.addToScene(this.stopMesh);
  }

  private resetSimulation(): void {
    const angle = this.getSafeNumber('angle', 25, 5, 50);
    const mass = this.getSafeNumber('mass', 1.2, 0.2, 5);
    const staticFriction = this.getSafeNumber('staticFriction', 0.45, 0, 1.2);
    const clampedKinetic = this.getSafeNumber('kineticFriction', 0.32, 0, 1.2);
    const kineticFriction = Math.min(clampedKinetic, staticFriction);
    const releaseDistance = this.getSafeNumber('releaseDistance', 0.8, 0, this.rampLength);

    this.parameters.set('kineticFriction', kineticFriction);
    this.updateRampTransform(angle);

    const angleRad = (angle * Math.PI) / 180;
    const normalForce = mass * EARTH_GRAVITY * Math.cos(angleRad);
    const gravityComponent = mass * EARTH_GRAVITY * Math.sin(angleRad);

    this.state = {
      time: 0,
      distance: releaseDistance,
      velocity: 0,
      acceleration: 0,
      normalForce,
      gravityComponent,
      frictionForce: Math.min(gravityComponent, staticFriction * normalForce),
      motionState: gravityComponent <= staticFriction * normalForce ? 'Static' : 'Sliding Down',
    };

    this.updateBlockPosition();
  }

  private updateRampTransform(angleDeg: number): void {
    if (!this.rampMesh || !this.stopMesh) {
      return;
    }

    const angleRad = (angleDeg * Math.PI) / 180;
    const halfLength = this.rampLength * 0.5;
    const bottomX = 2;
    const bottomY = this.rampThickness * 0.5;

    this.rampCenter.set(
      bottomX - halfLength * Math.cos(angleRad),
      bottomY + halfLength * Math.sin(angleRad),
      0,
    );

    this.rampMesh.position.copy(this.rampCenter);
    this.rampMesh.rotation.set(0, 0, -angleRad);

    this.stopMesh.position.set(bottomX + 0.08, bottomY + 0.18, 0);
  }

  private updateBlockPosition(): void {
    if (!this.blockMesh || !this.state) {
      return;
    }

    const angleRad = this.getAngleRad();
    const xLocal = -this.rampLength * 0.5 + this.state.distance;
    const yLocal = this.rampThickness * 0.5 + this.blockSize.y * 0.5 + 0.03;
    const localPos = new THREE.Vector3(xLocal, yLocal, 0);
    const worldPos = localPos
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), -angleRad)
      .add(this.rampCenter);

    this.blockMesh.position.copy(worldPos);
    this.blockMesh.rotation.set(0, 0, -angleRad);
  }

  private simulateStep(deltaTime: number): void {
    if (!this.state) {
      return;
    }

    const mass = this.getSafeNumber('mass', 1.2, 0.2, 5);
    const staticFriction = this.getSafeNumber('staticFriction', 0.45, 0, 1.2);
    const kineticFriction = this.getSafeNumber('kineticFriction', 0.32, 0, staticFriction);
    const angleRad = this.getAngleRad();

    const normalForce = mass * EARTH_GRAVITY * Math.cos(angleRad);
    const gravityComponent = mass * EARTH_GRAVITY * Math.sin(angleRad);
    const maxStaticFriction = staticFriction * normalForce;
    const kineticFrictionForce = kineticFriction * normalForce;
    const velocityThreshold = 1e-4;

    let acceleration = 0;
    let frictionForce = 0;
    let motionState: MotionState = 'Static';

    if (Math.abs(this.state.velocity) < velocityThreshold) {
      if (gravityComponent <= maxStaticFriction + 1e-6) {
        acceleration = 0;
        frictionForce = gravityComponent;
        motionState = 'Static';
        this.state.velocity = 0;
      } else {
        acceleration = (gravityComponent - kineticFrictionForce) / mass;
        frictionForce = kineticFrictionForce;
        motionState = 'Sliding Down';
      }
    } else {
      const direction = Math.sign(this.state.velocity);
      const signedFriction = -kineticFrictionForce * direction;
      acceleration = (gravityComponent + signedFriction) / mass;
      frictionForce = Math.abs(signedFriction);
      motionState = direction > 0 ? 'Sliding Down' : 'Moving Up';
    }

    let velocity = this.state.velocity + acceleration * deltaTime;
    let distance = this.state.distance + velocity * deltaTime;

    if (distance <= 0) {
      distance = 0;
      if (velocity < 0) {
        velocity = 0;
      }
    }

    if (distance >= this.rampLength) {
      distance = this.rampLength;
      velocity = 0;
      acceleration = 0;
      frictionForce = 0;
      motionState = 'Reached Bottom';
      this.isRunning = false;
    }

    if (Math.abs(velocity) < velocityThreshold && motionState !== 'Reached Bottom') {
      if (gravityComponent <= maxStaticFriction + 1e-6) {
        velocity = 0;
        acceleration = 0;
        frictionForce = gravityComponent;
        motionState = 'Static';
      }
    }

    this.state = {
      time: this.state.time + deltaTime,
      distance,
      velocity,
      acceleration,
      normalForce,
      gravityComponent,
      frictionForce,
      motionState,
    };
  }

  private getAngleRad(): number {
    const angleDeg = this.getSafeNumber('angle', 25, 5, 50);
    return (angleDeg * Math.PI) / 180;
  }
}
