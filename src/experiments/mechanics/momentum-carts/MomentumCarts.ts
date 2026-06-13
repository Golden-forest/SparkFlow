import * as THREE from 'three';
import {
  ExperimentBase,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  type CartState,
  type CollisionSnapshot,
  calculateCartKineticEnergy,
  calculateCartMomentum,
  calculateSystemKineticEnergy,
  calculateSystemMomentum,
  integrateCart,
  resolveCartCollision,
  resolveTrackBoundaryCollision,
} from './MomentumCollisionPhysics';

export class MomentumCarts extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'momentum-carts',
    name: 'Momentum Carts Collision',
    category: ExperimentCategory.Mechanics,
    description: 'Investigate one-dimensional two-cart collisions with adjustable mass, velocity, and restitution',
    difficulty: 'basic',
    duration: 15,
    keywords: ['momentum', 'collision', 'kinetic energy', 'restitution', 'mechanics'],
    thumbnail: '/thumbnails/momentum-carts.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      gravity: [0, 0, 0],
      timestep: 1 / 120,
      maxSubSteps: 10,
    },
    camera: {
      position: [0, 5.2, 11.5],
      target: [0, 0.9, 0],
      fov: 48,
    },
    parameters: [
      {
        key: 'cartAMass',
        label: 'Cart A Mass',
        type: 'number',
        defaultValue: 1.0,
        min: 0.5,
        max: 5.0,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'cartBMass',
        label: 'Cart B Mass',
        type: 'number',
        defaultValue: 2.0,
        min: 0.5,
        max: 5.0,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'cartAInitialVelocity',
        label: 'Cart A Initial Velocity',
        type: 'number',
        defaultValue: 2.0,
        min: -6.0,
        max: 6.0,
        step: 0.1,
        unit: 'm/s',
      },
      {
        key: 'cartBInitialVelocity',
        label: 'Cart B Initial Velocity',
        type: 'number',
        defaultValue: -1.0,
        min: -6.0,
        max: 6.0,
        step: 0.1,
        unit: 'm/s',
      },
      {
        key: 'restitution',
        label: 'Collision Restitution',
        type: 'number',
        defaultValue: 1.0,
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
  };

  private readonly trackHalfLength = 8;
  private readonly cartHalfLength = 0.6;
  private readonly cartWidth = 1.0;
  private readonly cartHeight = 0.7;
  private readonly cartPositionY = 0.72;
  private readonly fixedTimeStep = 1 / 120;
  private readonly maxSubSteps = 10;
  private readonly wallRestitution = 0.95;
  private readonly initialCenterSeparation = 6.4;

  private simulationTime = 0;
  private accumulator = 0;
  private collisionCount = 0;
  private lastCollision: CollisionSnapshot | null = null;

  private cartA: CartState = {
    mass: 1,
    position: -this.initialCenterSeparation / 2,
    velocity: 2,
    halfLength: this.cartHalfLength,
  };

  private cartB: CartState = {
    mass: 2,
    position: this.initialCenterSeparation / 2,
    velocity: -1,
    halfLength: this.cartHalfLength,
  };

  private cartAMesh: THREE.Mesh | null = null;
  private cartBMesh: THREE.Mesh | null = null;
  private cartATopStripe: THREE.Mesh | null = null;
  private cartBTopStripe: THREE.Mesh | null = null;

  protected async setupScene(): Promise<void> {
    if (!this.scene) return;

    // 添加星空背景
    this.addToScene(this.createStarfield());

    this.setupLights();
    this.createTrack();
    this.createCarts();
    this.resetSimulationState();
  }

  protected onStart(): void {
    this.resetSimulationState();
  }

  protected onReset(): void {
    this.resetSimulationState();
  }

  protected onParameterChange(key: string, value: number | string | boolean): void {
    void value;

    if (
      key === 'cartAMass' ||
      key === 'cartBMass' ||
      key === 'cartAInitialVelocity' ||
      key === 'cartBInitialVelocity' ||
      key === 'restitution'
    ) {
      this.resetSimulationState();
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning) return;

    const clampedDelta = Math.min(Math.max(deltaTime, 0), 0.1);
    this.accumulator = Math.min(
      this.accumulator + clampedDelta,
      this.fixedTimeStep * this.maxSubSteps
    );

    let steps = 0;
    while (this.accumulator >= this.fixedTimeStep && steps < this.maxSubSteps) {
      this.stepSimulation(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      steps++;
    }

    this.syncCartMeshes();
  }

  getDisplayData(): Record<string, DisplayValue> {
    const systemMomentum = calculateSystemMomentum(this.cartA, this.cartB);
    const systemKineticEnergy = calculateSystemKineticEnergy(this.cartA, this.cartB);
    const momentumDelta = this.lastCollision
      ? this.lastCollision.postMomentum - this.lastCollision.preMomentum
      : null;
    const kineticEnergyDelta = this.lastCollision
      ? this.lastCollision.postKineticEnergy - this.lastCollision.preKineticEnergy
      : null;

    return {
      time: {
        label: 'Time',
        value: this.simulationTime.toFixed(2),
        unit: 's',
      },
      collisions: {
        label: 'Collision Count',
        value: this.collisionCount,
      },
      cartAVelocity: {
        label: 'Cart A Velocity',
        value: this.cartA.velocity.toFixed(3),
        unit: 'm/s',
      },
      cartBVelocity: {
        label: 'Cart B Velocity',
        value: this.cartB.velocity.toFixed(3),
        unit: 'm/s',
      },
      cartAMomentum: {
        label: 'Cart A Momentum',
        value: calculateCartMomentum(this.cartA).toFixed(3),
        unit: 'kg*m/s',
      },
      cartBMomentum: {
        label: 'Cart B Momentum',
        value: calculateCartMomentum(this.cartB).toFixed(3),
        unit: 'kg*m/s',
      },
      systemMomentum: {
        label: 'System Momentum',
        value: systemMomentum.toFixed(3),
        unit: 'kg*m/s',
      },
      systemKineticEnergy: {
        label: 'System Kinetic Energy',
        value: systemKineticEnergy.toFixed(3),
        unit: 'J',
      },
      preCollisionMomentum: {
        label: 'Pre-Collision Momentum',
        value: this.lastCollision ? this.lastCollision.preMomentum.toFixed(3) : 'N/A',
        unit: 'kg*m/s',
      },
      postCollisionMomentum: {
        label: 'Post-Collision Momentum',
        value: this.lastCollision ? this.lastCollision.postMomentum.toFixed(3) : 'N/A',
        unit: 'kg*m/s',
      },
      preCollisionKineticEnergy: {
        label: 'Pre-Collision Kinetic Energy',
        value: this.lastCollision ? this.lastCollision.preKineticEnergy.toFixed(3) : 'N/A',
        unit: 'J',
      },
      postCollisionKineticEnergy: {
        label: 'Post-Collision Kinetic Energy',
        value: this.lastCollision ? this.lastCollision.postKineticEnergy.toFixed(3) : 'N/A',
        unit: 'J',
      },
      momentumChange: {
        label: 'Momentum Change',
        value: momentumDelta === null ? 'N/A' : momentumDelta.toExponential(2),
        unit: 'kg*m/s',
      },
      kineticEnergyChange: {
        label: 'Kinetic Energy Change',
        value: kineticEnergyDelta === null ? 'N/A' : kineticEnergyDelta.toFixed(3),
        unit: 'J',
      },
      cartAKineticEnergy: {
        label: 'Cart A Kinetic Energy',
        value: calculateCartKineticEnergy(this.cartA).toFixed(3),
        unit: 'J',
      },
      cartBKineticEnergy: {
        label: 'Cart B Kinetic Energy',
        value: calculateCartKineticEnergy(this.cartB).toFixed(3),
        unit: 'J',
      },
    };
  }

  dispose(): void {
    this.cartAMesh = null;
    this.cartBMesh = null;
    this.cartATopStripe = null;
    this.cartBTopStripe = null;
    this.lastCollision = null;
    super.dispose();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.addToScene(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(7, 10, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.addToScene(keyLight);

    const fillLight = new THREE.DirectionalLight(0x99bbff, 0.4);
    fillLight.position.set(-6, 5, -6);
    this.addToScene(fillLight);
  }

  private createTrack(): void {
    const trackLength = this.trackHalfLength * 2;

    const baseGeometry = new THREE.BoxGeometry(trackLength + 2.0, 0.35, 2.8);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.85,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.16;
    base.receiveShadow = true;
    this.addToScene(base);

    const laneGeometry = new THREE.BoxGeometry(trackLength + 0.1, 0.02, 0.2);
    const laneMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.4,
      metalness: 0.2,
    });
    const laneCenterLine = new THREE.Mesh(laneGeometry, laneMaterial);
    laneCenterLine.position.y = 0.35;
    this.addToScene(laneCenterLine);

    const railGeometry = new THREE.BoxGeometry(trackLength + 0.2, 0.22, 0.16);
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      roughness: 0.5,
      metalness: 0.6,
    });
    const nearRail = new THREE.Mesh(railGeometry, railMaterial);
    nearRail.position.set(0, 0.35, 1.15);
    this.addToScene(nearRail);

    const farRail = new THREE.Mesh(railGeometry, railMaterial);
    farRail.position.set(0, 0.35, -1.15);
    this.addToScene(farRail);

    const wallThickness = 0.24;
    const wallGeometry = new THREE.BoxGeometry(wallThickness, 0.92, 2.3);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b7280,
      roughness: 0.6,
      metalness: 0.2,
    });

    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-(this.trackHalfLength + wallThickness / 2), 0.58, 0);
    leftWall.castShadow = true;
    this.addToScene(leftWall);

    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(this.trackHalfLength + wallThickness / 2, 0.58, 0);
    rightWall.castShadow = true;
    this.addToScene(rightWall);

    // 添加统一的深青蓝网格
    const grid = this.createDefaultGrid(20, 20);
    this.addToScene(grid);
  }

  private createCarts(): void {
    const cartGeometry = new THREE.BoxGeometry(
      this.cartHalfLength * 2,
      this.cartHeight,
      this.cartWidth
    );

    const cartAMaterial = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.35,
      metalness: 0.4,
    });
    const cartBMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.35,
      metalness: 0.4,
    });

    this.cartAMesh = new THREE.Mesh(cartGeometry, cartAMaterial);
    this.cartAMesh.castShadow = true;
    this.cartAMesh.receiveShadow = true;
    this.addToScene(this.cartAMesh);

    this.cartBMesh = new THREE.Mesh(cartGeometry.clone(), cartBMaterial);
    this.cartBMesh.castShadow = true;
    this.cartBMesh.receiveShadow = true;
    this.addToScene(this.cartBMesh);

    const stripeGeometry = new THREE.BoxGeometry(this.cartHalfLength * 1.5, 0.08, this.cartWidth * 0.92);
    const stripeMaterialA = new THREE.MeshStandardMaterial({ color: 0xfee2e2, roughness: 0.5, metalness: 0.1 });
    const stripeMaterialB = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.5, metalness: 0.1 });

    this.cartATopStripe = new THREE.Mesh(stripeGeometry, stripeMaterialA);
    this.cartATopStripe.castShadow = true;
    this.addToScene(this.cartATopStripe);

    this.cartBTopStripe = new THREE.Mesh(stripeGeometry.clone(), stripeMaterialB);
    this.cartBTopStripe.castShadow = true;
    this.addToScene(this.cartBTopStripe);
  }

  private stepSimulation(stepTime: number): void {
    integrateCart(this.cartA, stepTime);
    integrateCart(this.cartB, stepTime);

    resolveTrackBoundaryCollision(
      this.cartA,
      -this.trackHalfLength,
      this.trackHalfLength,
      this.wallRestitution
    );
    resolveTrackBoundaryCollision(
      this.cartB,
      -this.trackHalfLength,
      this.trackHalfLength,
      this.wallRestitution
    );

    const collisionSnapshot = resolveCartCollision(
      this.cartA,
      this.cartB,
      this.getClampedRestitution()
    );

    if (collisionSnapshot) {
      this.lastCollision = collisionSnapshot;
      this.collisionCount += 1;
    }

    this.simulationTime += stepTime;
  }

  private resetSimulationState(): void {
    this.simulationTime = 0;
    this.accumulator = 0;
    this.collisionCount = 0;
    this.lastCollision = null;

    this.cartA = {
      mass: this.readPositiveNumberParameter('cartAMass', 1.0),
      position: -this.initialCenterSeparation / 2,
      velocity: this.readNumberParameter('cartAInitialVelocity', 2.0),
      halfLength: this.cartHalfLength,
    };

    this.cartB = {
      mass: this.readPositiveNumberParameter('cartBMass', 2.0),
      position: this.initialCenterSeparation / 2,
      velocity: this.readNumberParameter('cartBInitialVelocity', -1.0),
      halfLength: this.cartHalfLength,
    };

    this.syncCartMeshes();
  }

  private syncCartMeshes(): void {
    if (this.cartAMesh) {
      this.cartAMesh.position.set(this.cartA.position, this.cartPositionY, 0);
    }
    if (this.cartBMesh) {
      this.cartBMesh.position.set(this.cartB.position, this.cartPositionY, 0);
    }
    if (this.cartATopStripe) {
      this.cartATopStripe.position.set(this.cartA.position, this.cartPositionY + this.cartHeight * 0.42, 0);
    }
    if (this.cartBTopStripe) {
      this.cartBTopStripe.position.set(this.cartB.position, this.cartPositionY + this.cartHeight * 0.42, 0);
    }
  }

  private readNumberParameter(key: string, fallback: number): number {
    const value = this.getParameter(key);
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private readPositiveNumberParameter(key: string, fallback: number): number {
    return Math.max(0.05, this.readNumberParameter(key, fallback));
  }

  private getClampedRestitution(): number {
    return Math.min(1, Math.max(0, this.readNumberParameter('restitution', 1.0)));
  }
}
