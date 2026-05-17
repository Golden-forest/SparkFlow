import * as THREE from 'three';
import {
  calculateCyclotronRadius,
  calculateLorentzForce,
  createChargedParticleState,
  stepChargedParticle,
  type ChargedParticleState,
  type FieldParameters,
} from './LorentzPhysics';
import { createTextSprite } from './SynchrotronAnnotations';

export interface MicroViewParameters {
  electricFieldStrength: number;
  magneticFieldStrength: number;
  charge: number;
  mass: number;
  initialSpeed: number;
  showVectors: boolean;
}

export interface MicroViewMetrics {
  speed: number;
  forceMagnitude: number;
  kineticEnergy: number;
  cyclotronRadius: number;
  time: number;
}

const MAX_TRAJECTORY_POINTS = 320;

export class ElectromagneticFieldView {
  readonly group = new THREE.Group();

  private parameters: MicroViewParameters;
  private fields: FieldParameters;
  private state: ChargedParticleState;
  private trajectoryGeometry = new THREE.BufferGeometry();
  private trajectoryPositions = new Float32Array(MAX_TRAJECTORY_POINTS * 3);
  private particleGroup = new THREE.Group();
  private electricFieldArrows: THREE.ArrowHelper[] = [];
  private magneticFieldArrows: THREE.ArrowHelper[] = [];
  private velocityArrow: THREE.ArrowHelper;
  private magneticArrow: THREE.ArrowHelper;
  private forceArrow: THREE.ArrowHelper;
  private velocityLabel: THREE.Sprite;
  private magneticLabel: THREE.Sprite;
  private forceLabel: THREE.Sprite;

  constructor(parameters: MicroViewParameters) {
    this.parameters = { ...parameters };
    this.fields = this.createFields(this.parameters);
    this.state = this.createInitialState(this.parameters.initialSpeed);
    this.group.name = 'Local electromagnetic field particle view';

    this.createStage();
    this.createFieldArrows();
    this.createParticle();
    this.createTrajectory();

    this.velocityArrow = this.createVectorArrow(0x34d399);
    this.magneticArrow = this.createVectorArrow(0x38bdf8);
    this.forceArrow = this.createVectorArrow(0xf97316);
    this.group.add(this.velocityArrow);
    this.group.add(this.magneticArrow);
    this.group.add(this.forceArrow);

    this.velocityLabel = createTextSprite('v', { color: '#BBF7D0', scale: 0.0085, fontSize: 50 });
    this.magneticLabel = createTextSprite('B', { color: '#BAE6FD', scale: 0.0085, fontSize: 50 });
    this.forceLabel = createTextSprite('F', { color: '#FED7AA', scale: 0.0085, fontSize: 50 });
    this.group.add(this.velocityLabel);
    this.group.add(this.magneticLabel);
    this.group.add(this.forceLabel);

    this.updateFieldVisuals();
    this.updateParticleVisuals();
  }

  setParameters(parameters: MicroViewParameters): void {
    const speedChanged = Math.abs(parameters.initialSpeed - this.parameters.initialSpeed) > 0.001;
    this.parameters = { ...parameters };
    this.fields = this.createFields(parameters);
    this.updateFieldVisuals();
    this.setVectorVisibility(parameters.showVectors);

    if (speedChanged) {
      const currentDirection = this.state.velocity.lengthSq() > 0.0001
        ? this.state.velocity.clone().normalize()
        : new THREE.Vector3(1, 0.24, 0);
      this.state.velocity.copy(currentDirection.multiplyScalar(parameters.initialSpeed));
    }

    this.updateParticleVisuals();
  }

  resetParticle(): void {
    this.state = this.createInitialState(this.parameters.initialSpeed);
    this.clearTrajectory();
    this.updateParticleVisuals();
  }

  update(deltaTime: number): void {
    const steps = Math.max(1, Math.ceil(deltaTime / (1 / 90)));
    const stepDelta = Math.min(deltaTime / steps, 1 / 60);

    for (let index = 0; index < steps; index += 1) {
      this.state = stepChargedParticle(this.state, this.fields, stepDelta);
      if (this.isOutOfBounds()) {
        this.resetParticle();
        break;
      }
    }

    this.updateParticleVisuals();
  }

  getMetrics(): MicroViewMetrics {
    const force = calculateLorentzForce(this.state.velocity, this.fields);
    const speed = this.state.velocity.length();
    return {
      speed,
      forceMagnitude: force.length(),
      kineticEnergy: 0.5 * Math.max(0.01, this.parameters.mass) * speed * speed,
      cyclotronRadius: calculateCyclotronRadius(
        this.state.velocity,
        this.fields.magneticField,
        this.parameters.charge,
        this.parameters.mass,
      ),
      time: this.state.time,
    };
  }

  private createFields(parameters: MicroViewParameters): FieldParameters {
    return {
      electricField: new THREE.Vector3(parameters.electricFieldStrength, 0, 0),
      magneticField: new THREE.Vector3(0, parameters.magneticFieldStrength, 0),
      charge: parameters.charge,
      mass: Math.max(0.05, parameters.mass),
    };
  }

  private createInitialState(initialSpeed: number): ChargedParticleState {
    return createChargedParticleState({
      position: new THREE.Vector3(-3.2, 0.05, -1.25),
      velocity: new THREE.Vector3(initialSpeed, initialSpeed * 0.22, 0.18),
    });
  }

  private createStage(): void {
    const grid = new THREE.GridHelper(7.4, 18, 0x164e63, 0x1e293b);
    grid.position.y = -0.5;
    this.group.add(grid);

    const fieldSheet = new THREE.Mesh(
      new THREE.PlaneGeometry(7.4, 4.4),
      new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      }),
    );
    fieldSheet.rotation.x = -Math.PI / 2;
    fieldSheet.position.y = -0.52;
    this.group.add(fieldSheet);

    const eLabel = createTextSprite('Electric Field E accelerates charge', {
      color: '#FED7AA',
      border: 'rgba(251, 146, 60, 0.58)',
      scale: 0.0064,
    });
    eLabel.position.set(-1.5, 1.75, -2.15);
    this.group.add(eLabel);

    const bLabel = createTextSprite('Magnetic Field B bends trajectory', {
      color: '#BAE6FD',
      border: 'rgba(56, 189, 248, 0.58)',
      scale: 0.0064,
    });
    bLabel.position.set(1.25, 1.75, 2.0);
    this.group.add(bLabel);

    const forceLabel = createTextSprite('Lorentz Force: F = q(E + v x B)', {
      color: '#E0F2FE',
      scale: 0.0067,
    });
    forceLabel.position.set(0, -0.02, 2.72);
    this.group.add(forceLabel);
  }

  private createFieldArrows(): void {
    for (let zIndex = -2; zIndex <= 2; zIndex += 1) {
      for (let xIndex = -2; xIndex <= 2; xIndex += 1) {
        const origin = new THREE.Vector3(xIndex * 1.25, -0.18, zIndex * 0.82);
        const eArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, 0.55, 0xf97316, 0.16, 0.08);
        this.electricFieldArrows.push(eArrow);
        this.group.add(eArrow);

        const bArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, 0.5, 0x38bdf8, 0.15, 0.08);
        this.magneticFieldArrows.push(bArrow);
        this.group.add(bArrow);
      }
    }
  }

  private createParticle(): void {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.3,
        roughness: 0.18,
      }),
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.particleGroup.add(glow);
    this.particleGroup.add(core);
    this.group.add(this.particleGroup);
  }

  private createTrajectory(): void {
    this.trajectoryGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.trajectoryPositions, 3),
    );
    this.trajectoryGeometry.setDrawRange(0, 0);

    const trajectory = new THREE.Line(
      this.trajectoryGeometry,
      new THREE.LineBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
      }),
    );
    trajectory.name = 'Charged particle trajectory';
    this.group.add(trajectory);
  }

  private createVectorArrow(color: number): THREE.ArrowHelper {
    return new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      0.8,
      color,
      0.18,
      0.1,
    );
  }

  private updateFieldVisuals(): void {
    const eStrength = this.parameters.electricFieldStrength;
    const bStrength = this.parameters.magneticFieldStrength;
    const eDirection = eStrength >= 0 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-1, 0, 0);
    const bDirection = bStrength >= 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, -1, 0);
    const eLength = 0.28 + Math.min(Math.abs(eStrength), 3) * 0.18;
    const bLength = 0.25 + Math.min(Math.abs(bStrength), 3) * 0.18;

    this.electricFieldArrows.forEach((arrow) => {
      arrow.visible = Math.abs(eStrength) > 0.01;
      arrow.setDirection(eDirection);
      arrow.setLength(eLength, 0.16, 0.08);
    });

    this.magneticFieldArrows.forEach((arrow) => {
      arrow.visible = Math.abs(bStrength) > 0.01;
      arrow.setDirection(bDirection);
      arrow.setLength(bLength, 0.15, 0.08);
    });
  }

  private updateParticleVisuals(): void {
    this.particleGroup.position.copy(this.state.position);
    this.updateTrajectoryLine();
    this.updateVectorArrows();
  }

  private updateTrajectoryLine(): void {
    const points = this.state.trajectory.slice(-MAX_TRAJECTORY_POINTS);
    this.trajectoryPositions.fill(0);
    points.forEach((point, index) => {
      this.trajectoryPositions[index * 3] = point.x;
      this.trajectoryPositions[index * 3 + 1] = point.y;
      this.trajectoryPositions[index * 3 + 2] = point.z;
    });

    const position = this.trajectoryGeometry.getAttribute('position') as THREE.BufferAttribute;
    position.needsUpdate = true;
    this.trajectoryGeometry.setDrawRange(0, points.length);
    this.trajectoryGeometry.computeBoundingSphere();
  }

  private updateVectorArrows(): void {
    const particlePosition = this.state.position.clone();
    const force = calculateLorentzForce(this.state.velocity, this.fields);
    this.setArrowFromVector(this.velocityArrow, particlePosition, this.state.velocity, 1.05, 0.34);
    this.setArrowFromVector(
      this.magneticArrow,
      particlePosition.clone().add(new THREE.Vector3(0.34, 0.12, 0)),
      this.fields.magneticField,
      0.88,
      0.3,
    );
    this.setArrowFromVector(
      this.forceArrow,
      particlePosition.clone().add(new THREE.Vector3(0, 0.18, 0.28)),
      force,
      1.05,
      0.32,
    );

    this.velocityLabel.position.copy(this.velocityArrow.position).add(this.normalizedOrFallback(this.state.velocity).multiplyScalar(1.15));
    this.magneticLabel.position.copy(this.magneticArrow.position).add(this.normalizedOrFallback(this.fields.magneticField).multiplyScalar(0.96));
    this.forceLabel.position.copy(this.forceArrow.position).add(this.normalizedOrFallback(force).multiplyScalar(1.13));
    this.setVectorVisibility(this.parameters.showVectors);
  }

  private setArrowFromVector(
    arrow: THREE.ArrowHelper,
    origin: THREE.Vector3,
    vector: THREE.Vector3,
    maxLength: number,
    minLength: number,
  ): void {
    arrow.position.copy(origin);
    if (vector.lengthSq() < 0.0001) {
      arrow.visible = false;
      return;
    }

    arrow.visible = true;
    arrow.setDirection(vector.clone().normalize());
    const length = THREE.MathUtils.clamp(vector.length() * 0.42, minLength, maxLength);
    arrow.setLength(length, 0.18, 0.1);
  }

  private normalizedOrFallback(vector: THREE.Vector3): THREE.Vector3 {
    if (vector.lengthSq() < 0.0001) {
      return new THREE.Vector3(0, 1, 0);
    }
    return vector.clone().normalize();
  }

  private setVectorVisibility(visible: boolean): void {
    this.velocityArrow.visible = visible && this.velocityArrow.visible;
    this.magneticArrow.visible = visible && this.magneticArrow.visible;
    this.forceArrow.visible = visible && this.forceArrow.visible;
    this.velocityLabel.visible = visible;
    this.magneticLabel.visible = visible;
    this.forceLabel.visible = visible;
  }

  private clearTrajectory(): void {
    this.state.trajectory = [this.state.position.clone()];
    this.trajectoryPositions.fill(0);
    this.trajectoryGeometry.setDrawRange(0, 1);
  }

  private isOutOfBounds(): boolean {
    const position = this.state.position;
    return Math.abs(position.x) > 4.0 || Math.abs(position.y) > 2.8 || Math.abs(position.z) > 2.85;
  }
}
