import * as THREE from 'three';
import {
  ExperimentBase,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
} from '@/experiments/base';
import { ExperimentCategory, EARTH_GRAVITY } from '@/utils/constants';
import {
  calculateProjectileEnergies,
  createInitialProjectileState,
  estimateProjectileKinematics,
  stepProjectile,
  type ProjectileLaunchParameters,
  type ProjectileState,
} from './ProjectilePhysics';

const PROJECTILE_RADIUS = 0.12;
const TRAJECTORY_MAX_POINTS = 400;

export class ProjectileMotion extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'projectile-motion',
    name: 'Projectile Motion Lab',
    category: ExperimentCategory.Mechanics,
    description: 'Investigate range, flight time, and energy conversion in 2D projectile motion',
    difficulty: 'basic',
    duration: 20,
    keywords: ['projectile', 'range', 'trajectory', 'kinematics', 'gravity'],
    thumbnail: '/thumbnails/projectile-motion.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      gravity: [0, -EARTH_GRAVITY, 0],
      timestep: 1 / 60,
    },
    camera: {
      position: [18, 9, 14],
      target: [10, 2, 0],
      fov: 48,
    },
    parameters: [
      {
        key: 'launchSpeed',
        label: 'Launch Speed',
        type: 'number',
        defaultValue: 20,
        min: 5,
        max: 60,
        step: 0.5,
        unit: 'm/s',
      },
      {
        key: 'launchAngle',
        label: 'Launch Angle',
        type: 'number',
        defaultValue: 45,
        min: 5,
        max: 85,
        step: 1,
        unit: '°',
      },
      {
        key: 'launchHeight',
        label: 'Launch Height',
        type: 'number',
        defaultValue: 1.2,
        min: 0.2,
        max: 12,
        step: 0.1,
        unit: 'm',
      },
      {
        key: 'mass',
        label: 'Projectile Mass',
        type: 'number',
        defaultValue: 0.2,
        min: 0.05,
        max: 2,
        step: 0.05,
        unit: 'kg',
      },
      {
        key: 'gravity',
        label: 'Gravity',
        type: 'number',
        defaultValue: EARTH_GRAVITY,
        min: 1.6,
        max: 15,
        step: 0.1,
        unit: 'm/s²',
      },
      {
        key: 'showTrajectory',
        label: 'Show Trajectory',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  private projectileState: ProjectileState | null = null;
  private trajectoryPoints: THREE.Vector3[] = [];

  private launcherBase: THREE.Mesh | null = null;
  private launcherTube: THREE.Mesh | null = null;
  private projectileMesh: THREE.Mesh | null = null;
  private trajectoryLine: THREE.Line | null = null;
  private landingMarker: THREE.Mesh | null = null;

  protected async setupScene(): Promise<void> {
    this.setupLights();
    this.createGround();
    this.createLauncher();
    this.createProjectileMesh();
    this.createTrajectoryLine();
    this.createLandingMarker();
    this.resetSimulationState();
  }

  protected onStart(): void {
    this.resetSimulationState();
  }

  protected onReset(): void {
    this.resetSimulationState();
  }

  protected onParameterChange(key: string, value: number | string | boolean): void {
    if (key === 'showTrajectory' && this.trajectoryLine) {
      this.trajectoryLine.visible = Boolean(value);
      return;
    }

    this.resetSimulationState();
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.projectileState) {
      return;
    }

    const gravity = this.getLaunchParameters().gravity;
    const clampedDelta = Math.min(deltaTime, 1 / 30);
    this.projectileState = stepProjectile(this.projectileState, clampedDelta, gravity, PROJECTILE_RADIUS);

    if (this.getParameter('showTrajectory') as boolean) {
      this.trajectoryPoints.push(this.projectileState.position.clone());
      if (this.trajectoryPoints.length > TRAJECTORY_MAX_POINTS) {
        this.trajectoryPoints.shift();
      }
    }

    this.updateVisualization();

    if (this.projectileState.hasLanded) {
      this.isRunning = false;
    }
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.projectileState) {
      return {};
    }

    const params = this.getLaunchParameters();
    const theoretical = estimateProjectileKinematics(params);
    const energies = calculateProjectileEnergies(this.projectileState, params.mass, params.gravity, PROJECTILE_RADIUS);

    return {
      status: {
        label: 'Status',
        value: this.projectileState.hasLanded ? 'Landed' : 'In Flight',
      },
      time: {
        label: 'Time',
        value: this.projectileState.time.toFixed(2),
        unit: 's',
      },
      horizontalDistance: {
        label: 'Horizontal Distance',
        value: this.projectileState.horizontalDistance.toFixed(2),
        unit: 'm',
      },
      height: {
        label: 'Current Height',
        value: Math.max(0, this.projectileState.position.y - PROJECTILE_RADIUS).toFixed(2),
        unit: 'm',
      },
      speed: {
        label: 'Speed',
        value: energies.speed.toFixed(2),
        unit: 'm/s',
      },
      gravity: {
        label: 'Gravity',
        value: params.gravity.toFixed(2),
        unit: 'm/s²',
      },
      mass: {
        label: 'Projectile Mass',
        value: params.mass.toFixed(2),
        unit: 'kg',
      },
      maxHeight: {
        label: 'Max Height',
        value: Math.max(0, this.projectileState.maxHeight - PROJECTILE_RADIUS).toFixed(2),
        unit: 'm',
      },
      theoreticalRange: {
        label: 'Theoretical Range',
        value: theoretical.range.toFixed(2),
        unit: 'm',
      },
      theoreticalFlightTime: {
        label: 'Theoretical Flight Time',
        value: theoretical.flightTime.toFixed(2),
        unit: 's',
      },
      kineticEnergy: {
        label: 'Kinetic Energy',
        value: energies.kineticEnergy.toFixed(2),
        unit: 'J',
      },
      potentialEnergy: {
        label: 'Potential Energy',
        value: energies.potentialEnergy.toFixed(2),
        unit: 'J',
      },
      totalEnergy: {
        label: 'Mechanical Energy',
        value: energies.mechanicalEnergy.toFixed(2),
        unit: 'J',
      },
    };
  }

  private getLaunchParameters(): ProjectileLaunchParameters {
    return {
      launchSpeed: this.getParameter('launchSpeed') as number,
      launchAngleDeg: this.getParameter('launchAngle') as number,
      launchHeight: this.getParameter('launchHeight') as number,
      mass: this.getParameter('mass') as number,
      gravity: this.getParameter('gravity') as number,
    };
  }

  private resetSimulationState(): void {
    const params = this.getLaunchParameters();
    this.projectileState = createInitialProjectileState(params);
    this.trajectoryPoints = [this.projectileState.position.clone()];
    this.updateLauncherPose();
    this.updateVisualization();
  }

  private updateVisualization(): void {
    if (!this.projectileState) {
      return;
    }

    if (this.projectileMesh) {
      this.projectileMesh.position.copy(this.projectileState.position);
    }

    if (this.trajectoryLine) {
      const showTrajectory = this.getParameter('showTrajectory') as boolean;
      this.trajectoryLine.visible = showTrajectory;
      this.trajectoryLine.geometry.setFromPoints(showTrajectory ? this.trajectoryPoints : []);
      this.trajectoryLine.geometry.attributes.position.needsUpdate = true;
    }

    if (this.landingMarker) {
      const showMarker = this.projectileState.hasLanded;
      this.landingMarker.visible = showMarker;
      this.landingMarker.position.set(this.projectileState.horizontalDistance, PROJECTILE_RADIUS * 0.5, 0);
    }
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.42);
    this.addToScene(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(14, 18, 10);
    this.addToScene(mainLight);
  }

  private createGround(): void {
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x101826,
      roughness: 0.95,
      metalness: 0.04,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 50), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.addToScene(ground);

    const grid = new THREE.GridHelper(120, 60, 0x334155, 0x1f2937);
    grid.position.y = 0.002;
    this.addToScene(grid);
  }

  private createLauncher(): void {
    this.launcherBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.55, 24),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.4 })
    );
    this.addToScene(this.launcherBase);

    this.launcherTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1.5, 20),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.35, metalness: 0.45 })
    );
    this.addToScene(this.launcherTube);
  }

  private createProjectileMesh(): void {
    this.projectileMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PROJECTILE_RADIUS, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.15 })
    );
    this.addToScene(this.projectileMesh);
  }

  private createTrajectoryLine(): void {
    this.trajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 })
    );
    this.addToScene(this.trajectoryLine);
  }

  private createLandingMarker(): void {
    this.landingMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.05, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x220808 })
    );
    this.landingMarker.rotation.x = Math.PI / 2;
    this.landingMarker.visible = false;
    this.addToScene(this.landingMarker);
  }

  private updateLauncherPose(): void {
    if (!this.launcherBase || !this.launcherTube) {
      return;
    }

    const launchAngle = this.getParameter('launchAngle') as number;
    const launchHeight = this.getParameter('launchHeight') as number;
    const clampedHeight = Math.max(0.2, launchHeight);

    this.launcherBase.position.set(-0.4, Math.max(0.275, clampedHeight - 0.6), 0);
    this.launcherTube.position.set(0, clampedHeight, 0);
    this.launcherTube.rotation.set(0, 0, THREE.MathUtils.degToRad(90 - launchAngle));
  }

  dispose(): void {
    if (this.trajectoryLine) {
      this.trajectoryLine.geometry.dispose();
      (this.trajectoryLine.material as THREE.Material).dispose();
      this.trajectoryLine = null;
    }

    this.projectileState = null;
    this.trajectoryPoints = [];
    this.launcherBase = null;
    this.launcherTube = null;
    this.projectileMesh = null;
    this.landingMarker = null;

    super.dispose();
  }
}
