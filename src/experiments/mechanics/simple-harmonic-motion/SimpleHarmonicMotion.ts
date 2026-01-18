import * as THREE from 'three';
import { ExperimentBase, type ExperimentMetadata, type ExperimentConfig, type DisplayValue } from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  createInitialSHM,
  updateSHM,
  calculateSHMData,
  calculateSpringPosition,
  calculatePendulumPosition,
  calculateSHMVelocityVector,
  calculateSHMAccelerationVector,
  type SHMState,
  type SHMData,
} from './SHMPhysics';

/**
 * Simple Harmonic Motion Laboratory
 *
 * Covers: Spring Oscillator, Simple Pendulum
 *
 * Core Features:
 * - Adjustable oscillator type, mass, spring constant/length, amplitude
 * - Real-time monitoring of displacement, velocity, acceleration, period, frequency, energy
 * - Vector visualization (velocity and acceleration arrows)
 * - Motion trajectory display
 * - Energy conservation verification
 *
 * Physical Model: Ideal simple harmonic motion (friction and resistance ignored)
 */
export class SimpleHarmonicMotion extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'simple-harmonic-motion',
    name: 'Simple Harmonic Motion Lab',
    category: ExperimentCategory.Mechanics,
    description: 'Explore spring oscillators and pendulums, understand period, frequency, and energy conservation in SHM',
    difficulty: 'basic',
    duration: 15,
    keywords: ['harmonic', 'motion', 'oscillator', 'pendulum', 'spring', 'energy'],
    thumbnail: '/thumbnails/simple-harmonic-motion.png',
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
        key: 'oscillatorType',
        label: 'Oscillator Type',
        type: 'select',
        defaultValue: 'spring',
        options: [
          { value: 'spring', label: 'Spring Oscillator' },
          { value: 'pendulum', label: 'Pendulum' },
        ],
      },
      {
        key: 'mass',
        label: 'Mass',
        type: 'number',
        defaultValue: 1.0,
        min: 0.1,
        max: 10,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'springConstant',
        label: 'Spring Constant',
        type: 'number',
        defaultValue: 10.0,
        min: 1,
        max: 100,
        step: 1,
        unit: 'N/m',
      },
      {
        key: 'pendulumLength',
        label: 'Pendulum Length',
        type: 'number',
        defaultValue: 2.0,
        min: 0.5,
        max: 10,
        step: 0.1,
        unit: 'm',
      },
      {
        key: 'amplitude',
        label: 'Amplitude',
        type: 'number',
        defaultValue: 2.0,
        min: 0.5,
        max: 5,
        step: 0.1,
        unit: 'm',
      },
      {
        key: 'showVectors',
        label: 'Show Vectors',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'showTrajectory',
        label: 'Show Trajectory',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  // State
  private shmState: SHMState | null = null;
  private shmDataHistory: SHMData[] = [];
  private trajectoryHistory: THREE.Vector3[] = [];
  private lastTrajectoryTime = 0;
  private readonly TRAJECTORY_INTERVAL = 0.05;
  private readonly maxTrajectoryPoints = 200;
  private readonly MAX_DATA_HISTORY = 1000;

  // Vector arrow scale factors
  private readonly VELOCITY_SCALE = 0.5;
  private readonly ACCELERATION_SCALE = 0.3;

  // 3D object references
  private groundPlane: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private oscillatorMesh: THREE.Mesh | null = null;
  private springLine: THREE.Line | null = null;
  private pendulumLine: THREE.Line | null = null;
  private pivotPoint: THREE.Mesh | null = null;
  private equilibriumLine: THREE.Line | null = null;
  private velocityArrow: THREE.ArrowHelper | null = null;
  private accelerationArrow: THREE.ArrowHelper | null = null;
  private trajectoryLine: THREE.Line | null = null;

  protected async setupScene(): Promise<void> {
    if (!this.scene) return;

    // 1. 创建地面
    this.createGround();

    // 2. 创建网格辅助线
    this.createGrid();

    // 3. 初始化简谐运动
    this.resetSHM();
  }

  private createGround(): void {
    if (!this.scene) return;

    // 地面平面
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.1;
    this.groundPlane.receiveShadow = true;
    this.addToScene(this.groundPlane);

    // 地面网格
    this.gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
    this.gridHelper.position.y = 0;
    this.addToScene(this.gridHelper);
  }

  private createGrid(): void {
    if (!this.scene) return;

    // 添加坐标轴辅助线
    this.axesHelper = new THREE.AxesHelper(5);
    this.axesHelper.position.set(0, 0, 0);
    this.addToScene(this.axesHelper);
  }

  private createEquilibriumLine(): void {
    if (!this.scene) return;

    // 移除旧线
    if (this.equilibriumLine) {
      this.removeFromScene(this.equilibriumLine);
      this.equilibriumLine.geometry.dispose();
      if (this.equilibriumLine.material instanceof THREE.Material) {
        this.equilibriumLine.material.dispose();
      }
    }

    // 创建平衡位置标记（虚线）
    const points = [
      new THREE.Vector3(0, -3, 0),
      new THREE.Vector3(0, 3, 0),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: 0x666666,
      dashSize: 0.2,
      gapSize: 0.1,
    });
    this.equilibriumLine = new THREE.Line(geometry, material);
    this.equilibriumLine.computeLineDistances();
    this.addToScene(this.equilibriumLine);
  }

  private createOscillatorMesh(): void {
    if (!this.scene) return;

    // 移除旧网格
    if (this.oscillatorMesh) {
      this.removeFromScene(this.oscillatorMesh);
    }

    // 创建振动物体（球体）
    const radius = 0.5;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff9ff3,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.oscillatorMesh = new THREE.Mesh(geometry, material);
    this.oscillatorMesh.castShadow = true;
    this.oscillatorMesh.receiveShadow = true;

    if (this.shmState) {
      const position = this.shmState.oscillatorType === 'spring'
        ? calculateSpringPosition(this.shmState)
        : calculatePendulumPosition(this.shmState);
      this.oscillatorMesh.position.copy(position);
    }

    this.addToScene(this.oscillatorMesh);
  }

  private createSpringVisualization(): void {
    if (!this.scene || !this.shmState || this.shmState.oscillatorType !== 'spring') return;

    // Remove old spring
    if (this.springLine) {
      this.removeFromScene(this.springLine);
      this.springLine.geometry.dispose();
      if (this.springLine.material instanceof THREE.Material) {
        this.springLine.material.dispose();
      }
      this.springLine = null;
    }

    // Create spring (simplified as spiral line)
    const position = calculateSpringPosition(this.shmState);
    const coils = 10;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const x = -5 + t * (5 + position.x); // From -5 to current position
      const angle = t * coils * 2 * Math.PI;
      const y = Math.sin(angle) * 0.3;
      const z = Math.cos(angle) * 0.3;
      points.push(new THREE.Vector3(x, y, z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x00d2d3,
      linewidth: 2,
    });
    this.springLine = new THREE.Line(geometry, material);
    this.addToScene(this.springLine);
  }

  private updateSpringVisualization(): void {
    if (!this.springLine || !this.shmState) return;

    const position = calculateSpringPosition(this.shmState);
    const positions = this.springLine.geometry.attributes.position.array as Float32Array;

    const coils = 10;
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const x = -5 + t * (5 + position.x);
      const angle = t * coils * 2 * Math.PI;

      positions[i * 3] = x;
      positions[i * 3 + 1] = Math.sin(angle) * 0.3;
      positions[i * 3 + 2] = Math.cos(angle) * 0.3;
    }

    this.springLine.geometry.attributes.position.needsUpdate = true;
  }

  private createPendulumVisualization(): void {
    if (!this.scene || !this.shmState || this.shmState.oscillatorType !== 'pendulum') return;

    // Remove old pendulum line
    if (this.pendulumLine) {
      this.removeFromScene(this.pendulumLine);
      this.pendulumLine.geometry.dispose();
      if (this.pendulumLine.material instanceof THREE.Material) {
        this.pendulumLine.material.dispose();
      }
      this.pendulumLine = null;
    }

    // Create pivot point
    if (!this.pivotPoint) {
      const pivotGeometry = new THREE.SphereGeometry(0.2, 16, 16);
      const pivotMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.5,
        metalness: 0.5,
      });
      this.pivotPoint = new THREE.Mesh(pivotGeometry, pivotMaterial);
      this.pivotPoint.position.set(0, 0, 0);
      this.addToScene(this.pivotPoint);
    }

    // Create pendulum line
    const position = calculatePendulumPosition(this.shmState);
    const points = [
      new THREE.Vector3(0, 0, 0),
      position,
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x00d2d3,
      linewidth: 2,
    });
    this.pendulumLine = new THREE.Line(geometry, material);
    this.addToScene(this.pendulumLine);
  }

  private updatePendulumVisualization(): void {
    if (!this.pendulumLine || !this.shmState) return;

    const position = calculatePendulumPosition(this.shmState);
    const positions = this.pendulumLine.geometry.attributes.position.array as Float32Array;

    // Update start point (pivot)
    positions[0] = 0;
    positions[1] = 0;
    positions[2] = 0;

    // Update end point (pendulum bob position)
    positions[3] = position.x;
    positions[4] = position.y;
    positions[5] = position.z;

    this.pendulumLine.geometry.attributes.position.needsUpdate = true;
  }

  private createVectorArrows(): void {
    if (!this.scene || !this.shmState) return;

    // Remove old arrows
    if (this.velocityArrow) {
      this.removeFromScene(this.velocityArrow);
    }
    if (this.accelerationArrow) {
      this.removeFromScene(this.accelerationArrow);
    }

    const position = this.shmState.oscillatorType === 'spring'
      ? calculateSpringPosition(this.shmState)
      : calculatePendulumPosition(this.shmState);
    const velocityVector = calculateSHMVelocityVector(this.shmState);
    const accelerationVector = calculateSHMAccelerationVector(this.shmState);

    // Velocity arrow (green)
    const velocityLength = velocityVector.length();
    if (velocityLength > 0.01) {
      const velocityDir = velocityVector.clone().normalize();
      this.velocityArrow = new THREE.ArrowHelper(
        velocityDir,
        position,
        velocityLength * this.VELOCITY_SCALE,
        0x00ff00,
        0.5,
        0.3
      );
      this.addToScene(this.velocityArrow);
    }

    // Acceleration arrow (red)
    const accelerationLength = accelerationVector.length();
    if (accelerationLength > 0.01) {
      const accelerationDir = accelerationVector.clone().normalize();
      this.accelerationArrow = new THREE.ArrowHelper(
        accelerationDir,
        position,
        accelerationLength * this.ACCELERATION_SCALE,
        0xff0000,
        0.5,
        0.3
      );
      this.addToScene(this.accelerationArrow);
    }
  }

  private updateVectorArrows(): void {
    if (!this.shmState || !this.oscillatorMesh) return;

    const position = this.oscillatorMesh.position.clone();
    const velocityVector = calculateSHMVelocityVector(this.shmState);
    const accelerationVector = calculateSHMAccelerationVector(this.shmState);

    // Update velocity arrow
    if (this.velocityArrow) {
      this.velocityArrow.position.copy(position);
      const dir = velocityVector.clone().normalize();
      const length = velocityVector.length() * this.VELOCITY_SCALE;
      if (length > 0.01) {
        this.velocityArrow.setDirection(dir);
        this.velocityArrow.setLength(length);
        this.velocityArrow.visible = true;
      } else {
        this.velocityArrow.visible = false;
      }
    }

    // Update acceleration arrow
    if (this.accelerationArrow) {
      this.accelerationArrow.position.copy(position);
      const dir = accelerationVector.clone().normalize();
      const length = accelerationVector.length() * this.ACCELERATION_SCALE;
      if (length > 0.01) {
        this.accelerationArrow.setDirection(dir);
        this.accelerationArrow.setLength(length);
        this.accelerationArrow.visible = true;
      } else {
        this.accelerationArrow.visible = false;
      }
    }
  }

  private updateTrajectoryLine(): void {
    const showTrajectory = this.getParameter('showTrajectory') as boolean;
    if (!showTrajectory || this.trajectoryHistory.length < 2) {
      return;
    }

    // Reuse geometry and material, only update vertices
    if (!this.trajectoryLine) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.6,
      });
      this.trajectoryLine = new THREE.Line(geometry, material);
      this.addToScene(this.trajectoryLine);
    }

    // Limit trajectory length for performance
    if (this.trajectoryHistory.length > this.maxTrajectoryPoints) {
      this.trajectoryHistory = this.trajectoryHistory.slice(-this.maxTrajectoryPoints);
    }

    // Update only vertex positions
    this.trajectoryLine.geometry.setFromPoints(this.trajectoryHistory);
    this.trajectoryLine.geometry.attributes.position.needsUpdate = true;
  }

  private resetSHM(): void {
    const oscillatorType = this.getParameter('oscillatorType') as 'spring' | 'pendulum';
    const mass = this.getParameter('mass') as number;
    const amplitude = this.getParameter('amplitude') as number;

    let parameter: number;
    if (oscillatorType === 'spring') {
      parameter = this.getParameter('springConstant') as number;
    } else {
      parameter = this.getParameter('pendulumLength') as number;
    }

    this.shmState = createInitialSHM(oscillatorType, mass, parameter, amplitude);
    this.shmDataHistory = [calculateSHMData(this.shmState)];
    this.trajectoryHistory = [];
    this.lastTrajectoryTime = 0;

    // Create or update 3D objects
    this.createEquilibriumLine();
    this.createOscillatorMesh();

    if (oscillatorType === 'spring') {
      this.createSpringVisualization();
      // Clear pendulum-related objects
      if (this.pendulumLine) {
        this.removeFromScene(this.pendulumLine);
        this.pendulumLine = null;
      }
    } else {
      this.createPendulumVisualization();
      // Clear spring-related objects
      if (this.springLine) {
        this.removeFromScene(this.springLine);
        this.springLine = null;
      }
    }

    // Clear old trajectory line
    if (this.trajectoryLine) {
      this.removeFromScene(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      if (this.trajectoryLine.material instanceof THREE.Material) {
        this.trajectoryLine.material.dispose();
      }
      this.trajectoryLine = null;
    }

    // Create vector arrows
    if (this.showVectors) {
      this.createVectorArrows();
    }
  }

  private get showVectors(): boolean {
    return this.getParameter('showVectors') as boolean;
  }

  private get showTrajectory(): boolean {
    return this.getParameter('showTrajectory') as boolean;
  }

  protected onStart(): void {
    this.resetSHM();
  }

  protected onReset(): void {
    this.resetSHM();
  }

  protected onParameterChange(key: string): void {
    if (['oscillatorType', 'mass', 'springConstant', 'pendulumLength', 'amplitude'].includes(key)) {
      // Reset experiment when parameters change
      this.resetSHM();
    } else if (key === 'showVectors') {
      // Update vector arrow display
      if (this.showVectors) {
        this.createVectorArrows();
      } else {
        if (this.velocityArrow) {
          this.removeFromScene(this.velocityArrow);
          this.velocityArrow = null;
        }
        if (this.accelerationArrow) {
          this.removeFromScene(this.accelerationArrow);
          this.accelerationArrow = null;
        }
      }
    } else if (key === 'showTrajectory') {
      // Update trajectory display
      if (!this.showTrajectory && this.trajectoryLine) {
        this.removeFromScene(this.trajectoryLine);
        this.trajectoryLine = null;
      }
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.shmState) return;

    // Update physics state
    this.shmState = updateSHM(this.shmState, deltaTime);
    this.shmDataHistory.push(calculateSHMData(this.shmState));

    // Limit data history to prevent memory leak
    if (this.shmDataHistory.length > this.MAX_DATA_HISTORY) {
      this.shmDataHistory.shift();
    }

    // Calculate current position
    const position = this.shmState.oscillatorType === 'spring'
      ? calculateSpringPosition(this.shmState)
      : calculatePendulumPosition(this.shmState);

    // Update 3D object position
    if (this.oscillatorMesh) {
      this.oscillatorMesh.position.copy(position);
    }

    // Update spring or pendulum visualization (reuse existing geometry)
    if (this.shmState.oscillatorType === 'spring') {
      this.updateSpringVisualization();
    } else {
      this.updatePendulumVisualization();
    }

    // Record trajectory
    if (this.showTrajectory) {
      if (this.shmState.time - this.lastTrajectoryTime >= this.TRAJECTORY_INTERVAL) {
        this.trajectoryHistory.push(position);
        if (this.trajectoryHistory.length > this.maxTrajectoryPoints) {
          this.trajectoryHistory.shift();
        }
        this.lastTrajectoryTime = this.shmState.time;
      }
      this.updateTrajectoryLine();
    }

    // Update vector arrows (reuse existing arrows)
    if (this.showVectors) {
      this.updateVectorArrows();
    }
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.shmState) {
      return {};
    }

    const data = calculateSHMData(this.shmState);

    return {
      time: {
        label: 'Time',
        value: this.shmState.time.toFixed(2),
        unit: 's',
      },
      displacement: {
        label: 'Displacement',
        value: data.displacement.toFixed(2),
        unit: 'm',
      },
      velocity: {
        label: 'Velocity',
        value: data.velocity.toFixed(2),
        unit: 'm/s',
      },
      acceleration: {
        label: 'Acceleration',
        value: data.acceleration.toFixed(2),
        unit: 'm/s²',
      },
      period: {
        label: 'Period',
        value: data.period.toFixed(2),
        unit: 's',
      },
      frequency: {
        label: 'Frequency',
        value: data.frequency.toFixed(2),
        unit: 'Hz',
      },
      angularFrequency: {
        label: 'Angular Frequency',
        value: data.angularFrequency.toFixed(2),
        unit: 'rad/s',
      },
      kineticEnergy: {
        label: 'Kinetic Energy',
        value: data.kineticEnergy.toFixed(2),
        unit: 'J',
      },
      potentialEnergy: {
        label: 'Potential Energy',
        value: data.potentialEnergy.toFixed(2),
        unit: 'J',
      },
      mechanicalEnergy: {
        label: 'Mechanical Energy',
        value: data.mechanicalEnergy.toFixed(2),
        unit: 'J',
      },
    };
  }

  dispose(): void {
    // Clean up resources
    this.shmDataHistory = [];
    this.trajectoryHistory = [];

    // Clean up vector arrows
    if (this.velocityArrow) {
      this.removeFromScene(this.velocityArrow);
      this.velocityArrow = null;
    }
    if (this.accelerationArrow) {
      this.removeFromScene(this.accelerationArrow);
      this.accelerationArrow = null;
    }

    // Clean up trajectory line
    if (this.trajectoryLine) {
      this.removeFromScene(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      if (this.trajectoryLine.material instanceof THREE.Material) {
        this.trajectoryLine.material.dispose();
      }
      this.trajectoryLine = null;
    }

    // Clean up equilibrium line
    if (this.equilibriumLine) {
      this.removeFromScene(this.equilibriumLine);
      this.equilibriumLine.geometry.dispose();
      if (this.equilibriumLine.material instanceof THREE.Material) {
        this.equilibriumLine.material.dispose();
      }
      this.equilibriumLine = null;
    }

    // Clean up spring line
    if (this.springLine) {
      this.removeFromScene(this.springLine);
      this.springLine.geometry.dispose();
      if (this.springLine.material instanceof THREE.Material) {
        this.springLine.material.dispose();
      }
      this.springLine = null;
    }

    // Clean up pendulum line
    if (this.pendulumLine) {
      this.removeFromScene(this.pendulumLine);
      this.pendulumLine.geometry.dispose();
      if (this.pendulumLine.material instanceof THREE.Material) {
        this.pendulumLine.material.dispose();
      }
      this.pendulumLine = null;
    }

    // Clean up pivot point
    if (this.pivotPoint) {
      this.removeFromScene(this.pivotPoint);
      this.pivotPoint = null;
    }

    super.dispose();
  }
}
