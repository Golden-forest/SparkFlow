import * as THREE from 'three';
import {
  ExperimentBase,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';

interface SpringState {
  time: number;
  displacement: number; // m, relative to equilibrium
  velocity: number; // m/s
  acceleration: number; // m/s²
}

export class SpringOscillation extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'spring-oscillation',
    name: 'Spring Oscillation Lab',
    category: ExperimentCategory.Mechanics,
    description: 'Observe damped simple harmonic motion and compare displacement, velocity, and energy',
    difficulty: 'basic',
    duration: 20,
    keywords: ['spring', 'oscillation', 'harmonic motion', 'damping', 'energy'],
    thumbnail: '/thumbnails/spring-oscillation.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      timestep: 1 / 60,
    },
    camera: {
      position: [0, 3.4, 9.5],
      target: [0, 1.1, 0],
      fov: 48,
    },
    parameters: [
      {
        key: 'mass',
        label: 'Mass',
        type: 'number',
        defaultValue: 0.8,
        min: 0.2,
        max: 3,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'springConstant',
        label: 'Spring Constant',
        type: 'number',
        defaultValue: 22,
        min: 5,
        max: 70,
        step: 1,
        unit: 'N/m',
      },
      {
        key: 'damping',
        label: 'Damping Coefficient',
        type: 'number',
        defaultValue: 0.6,
        min: 0,
        max: 8,
        step: 0.1,
        unit: 'N·s/m',
      },
      {
        key: 'initialDisplacement',
        label: 'Initial Displacement',
        type: 'number',
        defaultValue: 1.1,
        min: -1.8,
        max: 1.8,
        step: 0.05,
        unit: 'm',
      },
      {
        key: 'initialVelocity',
        label: 'Initial Velocity',
        type: 'number',
        defaultValue: 0,
        min: -3,
        max: 3,
        step: 0.1,
        unit: 'm/s',
      },
      {
        key: 'showEquilibrium',
        label: 'Show Equilibrium Marker',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  private readonly railY = 0.75;
  private readonly anchorX = -3.8;
  private readonly equilibriumX = -0.2;
  private readonly massSize = new THREE.Vector3(0.7, 0.55, 0.65);

  private wallMesh: THREE.Mesh | null = null;
  private railMesh: THREE.Mesh | null = null;
  private massMesh: THREE.Mesh | null = null;
  private springLine: THREE.Line | null = null;
  private equilibriumMarker: THREE.Line | null = null;

  private state: SpringState | null = null;

  protected async setupScene(): Promise<void> {
    this.createLights();
    this.createGround();
    this.createRail();
    this.createWall();
    this.createMass();
    this.createSpring();
    this.createEquilibriumMarker();
    this.resetSimulation();
  }

  protected onStart(): void {
    this.resetSimulation();
  }

  protected onReset(): void {
    this.resetSimulation();
  }

  protected onParameterChange(key: string, value: number | string | boolean): void {
    if (key === 'showEquilibrium') {
      if (this.equilibriumMarker) {
        this.equilibriumMarker.visible = Boolean(value);
      }
      return;
    }

    this.resetSimulation();
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.state) {
      return;
    }

    const dt = Math.min(Math.max(deltaTime, 0.001), 0.05);
    this.stepOscillator(dt);
    this.updateVisualization();
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.state) {
      return {};
    }

    const mass = this.getSafeNumber('mass', 0.8, 0.2, 3);
    const springConstant = this.getSafeNumber('springConstant', 22, 5, 70);
    const damping = this.getSafeNumber('damping', 0.6, 0, 8);
    const omega0 = Math.sqrt(springConstant / mass);
    const period = (2 * Math.PI) / omega0;
    const dampingRatio = damping / (2 * Math.sqrt(springConstant * mass));
    const springForce = -springConstant * this.state.displacement;
    const dampingForce = -damping * this.state.velocity;
    const kineticEnergy = 0.5 * mass * this.state.velocity * this.state.velocity;
    const potentialEnergy = 0.5 * springConstant * this.state.displacement * this.state.displacement;

    return {
      time: { label: 'Time', value: this.state.time.toFixed(2), unit: 's' },
      displacement: {
        label: 'Displacement',
        value: this.state.displacement.toFixed(3),
        unit: 'm',
      },
      velocity: {
        label: 'Velocity',
        value: this.state.velocity.toFixed(3),
        unit: 'm/s',
      },
      acceleration: {
        label: 'Acceleration',
        value: this.state.acceleration.toFixed(3),
        unit: 'm/s²',
      },
      springForce: {
        label: 'Spring Force',
        value: springForce.toFixed(2),
        unit: 'N',
      },
      dampingForce: {
        label: 'Damping Force',
        value: dampingForce.toFixed(2),
        unit: 'N',
      },
      period: {
        label: 'Natural Period',
        value: period.toFixed(3),
        unit: 's',
      },
      frequency: {
        label: 'Natural Frequency',
        value: (1 / period).toFixed(3),
        unit: 'Hz',
      },
      dampingRatio: {
        label: 'Damping Ratio',
        value: dampingRatio.toFixed(3),
      },
      kineticEnergy: {
        label: 'Kinetic Energy',
        value: kineticEnergy.toFixed(3),
        unit: 'J',
      },
      potentialEnergy: {
        label: 'Spring Potential Energy',
        value: potentialEnergy.toFixed(3),
        unit: 'J',
      },
      totalEnergy: {
        label: 'Total Mechanical Energy',
        value: (kineticEnergy + potentialEnergy).toFixed(3),
        unit: 'J',
      },
    };
  }

  dispose(): void {
    this.state = null;
    this.wallMesh = null;
    this.railMesh = null;
    this.massMesh = null;
    this.springLine = null;
    this.equilibriumMarker = null;
    super.dispose();
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.addToScene(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(4, 7, 6);
    key.castShadow = true;
    this.addToScene(key);
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 16),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.92,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.addToScene(ground);
  }

  private createRail(): void {
    this.railMesh = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.22, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.45,
        metalness: 0.35,
      }),
    );
    this.railMesh.position.set(0.2, this.railY, 0);
    this.railMesh.castShadow = true;
    this.railMesh.receiveShadow = true;
    this.addToScene(this.railMesh);
  }

  private createWall(): void {
    this.wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 2.6, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.4,
        metalness: 0.3,
      }),
    );
    this.wallMesh.position.set(this.anchorX - 0.18, this.railY + 1.3, 0);
    this.wallMesh.castShadow = true;
    this.wallMesh.receiveShadow = true;
    this.addToScene(this.wallMesh);
  }

  private createMass(): void {
    this.massMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.massSize.x, this.massSize.y, this.massSize.z),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        roughness: 0.35,
        metalness: 0.15,
      }),
    );
    this.massMesh.castShadow = true;
    this.massMesh.receiveShadow = true;
    this.addToScene(this.massMesh);
  }

  private createSpring(): void {
    this.springLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xf59e0b,
      }),
    );
    this.addToScene(this.springLine);
  }

  private createEquilibriumMarker(): void {
    const markerGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(this.equilibriumX, this.railY + 0.2, 0),
      new THREE.Vector3(this.equilibriumX, this.railY + 1.5, 0),
    ]);

    this.equilibriumMarker = new THREE.Line(
      markerGeometry,
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
      }),
    );

    this.equilibriumMarker.visible = Boolean(this.getParameter('showEquilibrium'));
    this.addToScene(this.equilibriumMarker);
  }

  private resetSimulation(): void {
    const displacement = this.getSafeNumber('initialDisplacement', 1.1, -1.8, 1.8);
    const velocity = this.getSafeNumber('initialVelocity', 0, -3, 3);
    const acceleration = this.calculateAcceleration(displacement, velocity);

    this.state = {
      time: 0,
      displacement,
      velocity,
      acceleration,
    };

    if (this.equilibriumMarker) {
      this.equilibriumMarker.visible = Boolean(this.getParameter('showEquilibrium'));
    }

    this.updateVisualization();
  }

  private stepOscillator(deltaTime: number): void {
    if (!this.state) {
      return;
    }

    const acceleration = this.calculateAcceleration(this.state.displacement, this.state.velocity);
    let velocity = this.state.velocity + acceleration * deltaTime;
    let displacement = this.state.displacement + velocity * deltaTime;
    let nextAcceleration = this.calculateAcceleration(displacement, velocity);

    if (Math.abs(displacement) > 2.2) {
      displacement = Math.sign(displacement) * 2.2;
      velocity *= -0.2;
      nextAcceleration = this.calculateAcceleration(displacement, velocity);
    }

    const damping = this.getSafeNumber('damping', 0.6, 0, 8);
    if (damping > 0 && Math.abs(displacement) < 0.0001 && Math.abs(velocity) < 0.0001) {
      displacement = 0;
      velocity = 0;
      nextAcceleration = 0;
    }

    this.state = {
      time: this.state.time + deltaTime,
      displacement,
      velocity,
      acceleration: nextAcceleration,
    };
  }

  private updateVisualization(): void {
    if (!this.state || !this.massMesh || !this.springLine) {
      return;
    }

    const massCenter = new THREE.Vector3(
      this.equilibriumX + this.state.displacement,
      this.railY + this.massSize.y * 0.5 + 0.12,
      0,
    );

    this.massMesh.position.copy(massCenter);

    const springStart = new THREE.Vector3(
      this.anchorX,
      this.railY + this.massSize.y * 0.5 + 0.12,
      0,
    );
    const springEnd = new THREE.Vector3(
      massCenter.x - this.massSize.x * 0.5,
      massCenter.y,
      0,
    );

    const springPoints = this.generateSpringPoints(springStart, springEnd, 16, 0.16);
    this.springLine.geometry.setFromPoints(springPoints);
    this.springLine.geometry.attributes.position.needsUpdate = true;
  }

  private generateSpringPoints(
    start: THREE.Vector3,
    end: THREE.Vector3,
    coilCount: number,
    amplitude: number,
  ): THREE.Vector3[] {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();

    if (length < 1e-4) {
      return [start.clone(), end.clone()];
    }

    const unit = direction.clone().normalize();
    const normal = new THREE.Vector3(0, 1, 0);
    const points: THREE.Vector3[] = [];
    const segmentCount = Math.max(coilCount * 2, 24);

    for (let i = 0; i <= segmentCount; i += 1) {
      const t = i / segmentCount;
      const base = start.clone().add(unit.clone().multiplyScalar(length * t));
      const wave = Math.sin(t * Math.PI * coilCount * 2);
      const offsetScale = i === 0 || i === segmentCount ? 0 : wave * amplitude;
      points.push(base.add(normal.clone().multiplyScalar(offsetScale)));
    }

    return points;
  }

  private calculateAcceleration(displacement: number, velocity: number): number {
    const mass = this.getSafeNumber('mass', 0.8, 0.2, 3);
    const springConstant = this.getSafeNumber('springConstant', 22, 5, 70);
    const damping = this.getSafeNumber('damping', 0.6, 0, 8);

    return (-springConstant * displacement - damping * velocity) / mass;
  }
}
