import * as THREE from 'three';
import {
  ExperimentBase,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  calculateCentripetalDirection,
  calculateCircularMetrics,
  calculateTangentialDirection,
  createInitialCircularState,
  stepCircularMotion,
  toDirectionSign,
  type CircularMotionParameters,
  type CircularMotionState,
  type RotationDirection,
} from './CircularMotionPhysics';

export class UniformCircularMotion extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'uniform-circular-motion',
    name: 'Uniform Circular Motion Lab',
    category: ExperimentCategory.Mechanics,
    description: 'Study velocity direction and centripetal force in constant-speed circular motion',
    difficulty: 'basic',
    duration: 18,
    keywords: ['circular motion', 'centripetal force', 'period', 'angular speed'],
    thumbnail: '/thumbnails/uniform-circular-motion.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      timestep: 1 / 60,
    },
    camera: {
      position: [8, 7, 9],
      target: [0, 1.4, 0],
      fov: 52,
    },
    parameters: [
      {
        key: 'radius',
        label: 'Radius',
        type: 'number',
        defaultValue: 2,
        min: 0.5,
        max: 6,
        step: 0.1,
        unit: 'm',
      },
      {
        key: 'angularSpeed',
        label: 'Angular Speed',
        type: 'number',
        defaultValue: 2,
        min: 0.2,
        max: 8,
        step: 0.1,
        unit: 'rad/s',
      },
      {
        key: 'mass',
        label: 'Object Mass',
        type: 'number',
        defaultValue: 0.5,
        min: 0.1,
        max: 5,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'height',
        label: 'Motion Height',
        type: 'number',
        defaultValue: 1.2,
        min: 0.5,
        max: 3,
        step: 0.1,
        unit: 'm',
      },
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        defaultValue: 'counterclockwise',
        options: [
          { value: 'counterclockwise', label: 'Counterclockwise' },
          { value: 'clockwise', label: 'Clockwise' },
        ],
      },
      {
        key: 'showVectors',
        label: 'Show Vectors',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'showPath',
        label: 'Show Path',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  private motionState: CircularMotionState | null = null;

  private centerPost: THREE.Mesh | null = null;
  private armLine: THREE.Line | null = null;
  private pathLine: THREE.LineLoop | null = null;
  private orbitingMass: THREE.Mesh | null = null;
  private velocityArrow: THREE.ArrowHelper | null = null;
  private centripetalArrow: THREE.ArrowHelper | null = null;

  protected async setupScene(): Promise<void> {
    this.setupLights();
    this.createGround();
    this.createCenterPost();
    this.createArmLine();
    this.createPathLine();
    this.createOrbitingMass();
    this.createArrows();
    this.resetMotionState();
  }

  protected onStart(): void {
    this.resetMotionState();
  }

  protected onReset(): void {
    this.resetMotionState();
  }

  protected onParameterChange(key: string, value: number | string | boolean): void {
    if (key === 'showVectors') {
      const visible = Boolean(value);
      if (this.velocityArrow) {
        this.velocityArrow.visible = visible;
      }
      if (this.centripetalArrow) {
        this.centripetalArrow.visible = visible;
      }
      return;
    }

    if (key === 'showPath' && this.pathLine) {
      this.pathLine.visible = Boolean(value);
      return;
    }

    this.resetMotionState();
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.motionState) {
      return;
    }

    const direction = this.getParameter('direction') as RotationDirection;
    const directionSign = toDirectionSign(direction);
    const clampedDelta = Math.min(deltaTime, 1 / 30);
    this.motionState = stepCircularMotion(this.motionState, clampedDelta, directionSign);
    this.updateVisualization();
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.motionState) {
      return {};
    }

    const metrics = calculateCircularMetrics(this.motionState);
    const direction = this.getParameter('direction') as RotationDirection;
    const angleDeg = THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(this.motionState.angle), 360);

    return {
      time: {
        label: 'Time',
        value: this.motionState.time.toFixed(2),
        unit: 's',
      },
      direction: {
        label: 'Direction',
        value: direction === 'clockwise' ? 'Clockwise' : 'Counterclockwise',
      },
      angle: {
        label: 'Angle',
        value: angleDeg.toFixed(1),
        unit: '°',
      },
      revolutions: {
        label: 'Revolutions',
        value: this.motionState.revolutions.toFixed(2),
      },
      radius: {
        label: 'Radius',
        value: this.motionState.radius.toFixed(2),
        unit: 'm',
      },
      mass: {
        label: 'Object Mass',
        value: this.motionState.mass.toFixed(2),
        unit: 'kg',
      },
      height: {
        label: 'Motion Height',
        value: this.motionState.height.toFixed(2),
        unit: 'm',
      },
      angularSpeed: {
        label: 'Angular Speed',
        value: this.motionState.angularSpeed.toFixed(2),
        unit: 'rad/s',
      },
      period: {
        label: 'Period',
        value: metrics.period.toFixed(2),
        unit: 's',
      },
      frequency: {
        label: 'Frequency',
        value: metrics.frequency.toFixed(2),
        unit: 'Hz',
      },
      tangentialSpeed: {
        label: 'Tangential Speed',
        value: metrics.tangentialSpeed.toFixed(2),
        unit: 'm/s',
      },
      centripetalAcceleration: {
        label: 'Centripetal Acceleration',
        value: metrics.centripetalAcceleration.toFixed(2),
        unit: 'm/s²',
      },
      centripetalForce: {
        label: 'Centripetal Force',
        value: metrics.centripetalForce.toFixed(2),
        unit: 'N',
      },
    };
  }

  private getMotionParameters(): CircularMotionParameters {
    return {
      radius: this.getParameter('radius') as number,
      angularSpeed: this.getParameter('angularSpeed') as number,
      mass: this.getParameter('mass') as number,
      height: this.getParameter('height') as number,
      initialAngle: 0,
    };
  }

  private resetMotionState(): void {
    this.motionState = createInitialCircularState(this.getMotionParameters());
    this.updatePathGeometry();
    this.updateVisualization();
  }

  private updateVisualization(): void {
    if (!this.motionState) {
      return;
    }

    const center = new THREE.Vector3(0, this.motionState.height, 0);
    const direction = this.getParameter('direction') as RotationDirection;
    const directionSign = toDirectionSign(direction);

    if (this.orbitingMass) {
      this.orbitingMass.position.copy(this.motionState.position);
    }

    if (this.armLine) {
      this.armLine.geometry.setFromPoints([center, this.motionState.position]);
      this.armLine.geometry.attributes.position.needsUpdate = true;
    }

    this.updateVectors(directionSign);
  }

  private updateVectors(directionSign: 1 | -1): void {
    if (!this.motionState || !this.velocityArrow || !this.centripetalArrow) {
      return;
    }

    const showVectors = this.getParameter('showVectors') as boolean;
    this.velocityArrow.visible = showVectors;
    this.centripetalArrow.visible = showVectors;

    if (!showVectors) {
      return;
    }

    const metrics = calculateCircularMetrics(this.motionState);
    const velocityDirection = calculateTangentialDirection(this.motionState.angle, directionSign);
    const centripetalDirection = calculateCentripetalDirection(this.motionState.angle);
    const velocityLength = THREE.MathUtils.clamp(metrics.tangentialSpeed * 0.45, 0.4, 3.2);
    const centripetalLength = THREE.MathUtils.clamp(metrics.centripetalAcceleration * 0.16, 0.4, 3.2);

    this.velocityArrow.position.copy(this.motionState.position);
    this.velocityArrow.setDirection(velocityDirection);
    this.velocityArrow.setLength(velocityLength, velocityLength * 0.24, velocityLength * 0.14);

    this.centripetalArrow.position.copy(this.motionState.position);
    this.centripetalArrow.setDirection(centripetalDirection);
    this.centripetalArrow.setLength(centripetalLength, centripetalLength * 0.24, centripetalLength * 0.14);
  }

  private updatePathGeometry(): void {
    if (!this.motionState || !this.pathLine) {
      return;
    }

    const segments = 96;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i += 1) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          this.motionState.radius * Math.cos(theta),
          this.motionState.height,
          this.motionState.radius * Math.sin(theta)
        )
      );
    }

    this.pathLine.geometry.dispose();
    this.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.pathLine.visible = this.getParameter('showPath') as boolean;
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.addToScene(ambientLight);

    const directional = new THREE.DirectionalLight(0xffffff, 0.85);
    directional.position.set(8, 14, 8);
    this.addToScene(directional);
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.95,
        metalness: 0.06,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    this.addToScene(ground);

    const grid = new THREE.GridHelper(30, 30, 0x334155, 0x1e293b);
    grid.position.y = 0.001;
    this.addToScene(grid);
  }

  private createCenterPost(): void {
    this.centerPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 3.2, 20),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.45,
        metalness: 0.45,
      })
    );
    this.centerPost.position.set(0, 1.6, 0);
    this.addToScene(this.centerPost);
  }

  private createArmLine(): void {
    this.armLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 2 })
    );
    this.addToScene(this.armLine);
  }

  private createPathLine(): void {
    this.pathLine = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.8,
      })
    );
    this.addToScene(this.pathLine);
  }

  private createOrbitingMass(): void {
    this.orbitingMass = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.35,
        metalness: 0.2,
      })
    );
    this.addToScene(this.orbitingMass);
  }

  private createArrows(): void {
    const origin = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3(1, 0, 0);

    this.velocityArrow = new THREE.ArrowHelper(direction, origin, 1, 0x22c55e, 0.25, 0.15);
    this.centripetalArrow = new THREE.ArrowHelper(direction, origin, 1, 0xef4444, 0.25, 0.15);
    this.addToScene(this.velocityArrow);
    this.addToScene(this.centripetalArrow);
  }

  dispose(): void {
    this.disposeLine(this.armLine);
    this.disposeLine(this.pathLine);
    this.disposeArrow(this.velocityArrow);
    this.disposeArrow(this.centripetalArrow);

    this.motionState = null;
    this.centerPost = null;
    this.armLine = null;
    this.pathLine = null;
    this.orbitingMass = null;
    this.velocityArrow = null;
    this.centripetalArrow = null;

    super.dispose();
  }

  private disposeLine(line: THREE.Line | THREE.LineLoop | null): void {
    if (!line) {
      return;
    }

    line.geometry.dispose();
    if (Array.isArray(line.material)) {
      line.material.forEach((material) => material.dispose());
    } else {
      line.material.dispose();
    }
  }

  private disposeArrow(arrow: THREE.ArrowHelper | null): void {
    if (!arrow) {
      return;
    }

    arrow.line.geometry.dispose();
    if (Array.isArray(arrow.line.material)) {
      arrow.line.material.forEach((material) => material.dispose());
    } else {
      arrow.line.material.dispose();
    }

    arrow.cone.geometry.dispose();
    if (Array.isArray(arrow.cone.material)) {
      arrow.cone.material.forEach((material) => material.dispose());
    } else {
      arrow.cone.material.dispose();
    }
  }
}
