import * as THREE from 'three';
import {
  ExperimentBase,
  type ControlSchema,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
  type MonitorSchema,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import { AcceleratorRing } from './AcceleratorRing';
import { ParticleBeamSystem } from './ParticleBeamSystem';
import { SynchrotronMicroMechanismView } from './SynchrotronMicroMechanismView';
import type { SynchrotronMechanism, SynchrotronMicroSettings } from './SynchrotronMicroPhysics';
import { disposeObject3D } from './SynchrotronAnnotations';

type ViewMode = 'macro' | 'micro';

export class SynchrotronExperiment extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'synchrotron-em-fields',
    name: 'Synchrotron and Lorentz Force',
    category: ExperimentCategory.Electromagnetism,
    description: 'Visualize a synchrotron ring and charged particle motion under combined electric and magnetic fields',
    difficulty: 'intermediate',
    duration: 18,
    keywords: ['synchrotron', 'charged particle', 'electric field', 'magnetic field', 'lorentz force'],
    thumbnail: '/thumbnails/synchrotron-em-fields.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      gravity: [0, 0, 0],
      timestep: 1 / 60,
    },
    camera: {
      position: [8.2, 6.2, 8.8],
      target: [0, 0.2, 0],
      fov: 48,
    },
    parameters: [
      {
        key: 'viewMode',
        label: 'View Mode',
        type: 'select',
        defaultValue: 'macro',
        options: [
          { value: 'macro', label: 'Synchrotron Ring' },
          { value: 'micro', label: 'E/B Field Motion' },
        ],
      },
      {
        key: 'mechanism',
        label: 'Micro Mechanism',
        type: 'select',
        defaultValue: 'rf',
        options: [
          { value: 'rf', label: 'RF Acceleration' },
          { value: 'bending', label: 'Magnetic Bending' },
          { value: 'synchronized', label: 'Synchronized Orbit' },
          { value: 'collision', label: 'Collision Point' },
        ],
      },
      {
        key: 'electricFieldStrength',
        label: 'Electric Field E',
        type: 'number',
        defaultValue: 1.1,
        min: -3,
        max: 3,
        step: 0.1,
        unit: 'N/C',
      },
      {
        key: 'magneticFieldStrength',
        label: 'Magnetic Field B',
        type: 'number',
        defaultValue: 1.35,
        min: -3,
        max: 3,
        step: 0.1,
        unit: 'T',
      },
      {
        key: 'charge',
        label: 'Particle Charge q',
        type: 'number',
        defaultValue: 1,
        min: -2,
        max: 2,
        step: 0.1,
        unit: 'C',
      },
      {
        key: 'mass',
        label: 'Particle Mass m',
        type: 'number',
        defaultValue: 1,
        min: 0.2,
        max: 5,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'initialSpeed',
        label: 'Initial Speed',
        type: 'number',
        defaultValue: 1.8,
        min: 0.3,
        max: 4,
        step: 0.1,
        unit: 'm/s',
      },
      {
        key: 'showVectors',
        label: 'Show v, E, B, F Vectors',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'showLabels',
        label: 'Show Scene Labels',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  };

  private root = new THREE.Group();
  private ring: AcceleratorRing | null = null;
  private beams: ParticleBeamSystem | null = null;
  private microView: SynchrotronMicroMechanismView | null = null;
  private elapsedTime = 0;

  protected async setupScene(): Promise<void> {
    this.root.name = 'Synchrotron electromagnetic fields scene';
    this.addToScene(this.root);

    this.setupSceneLighting();
    this.createBackground();

    this.ring = new AcceleratorRing(4.25);
    this.beams = new ParticleBeamSystem(this.ring.radius);
    this.microView = new SynchrotronMicroMechanismView(this.getMicroParameters());

    this.root.add(this.ring.group);
    this.root.add(this.beams.group);
    this.root.add(this.microView.group);

    this.applyViewMode();
  }

  protected onStart(): void {
    this.elapsedTime = 0;
  }

  protected onReset(): void {
    this.elapsedTime = 0;
    this.beams?.reset();
    this.microView?.reset();
    this.syncMicroParameters();
    this.applyViewMode();
  }

  protected onParameterChange(key: string): void {
    if (key === 'viewMode') {
      this.applyViewMode();
      return;
    }
    this.syncMicroParameters();
  }

  update(deltaTime: number): void {
    if (!this.isRunning) {
      return;
    }

    const clampedDelta = Math.min(deltaTime, 1 / 30);
    this.elapsedTime += clampedDelta;
    const speed = this.getSafeNumber('initialSpeed', 1.8, 0.3, 4);
    this.ring?.update(this.elapsedTime);
    this.beams?.update(clampedDelta, speed);
    this.microView?.update(clampedDelta);
  }

  getControlSchema(): ControlSchema {
    return {
      title: 'Controls',
      parameters: this.config.parameters,
      actions: [
        { key: 'resetParticleTrack', label: 'Reset Micro Track', variant: 'secondary' },
      ],
    };
  }

  triggerAction(key: string): void {
    if (key === 'resetParticleTrack') {
      this.microView?.reset();
    }
  }

  getMonitorSchema(): MonitorSchema {
    return {
      title: 'Field Monitor',
      quantities: [
        { key: 'speed', label: 'Particle Speed', unit: 'm/s', color: '#38bdf8' },
        { key: 'force', label: 'Lorentz Force', unit: 'N', color: '#f97316' },
        { key: 'separation', label: 'Beam Separation', unit: 'm', color: '#34d399' },
        { key: 'kineticEnergy', label: 'Kinetic Energy', unit: 'J', color: '#f59e0b' },
      ],
      defaultSelected: ['speed', 'force', 'separation'],
      sampleIntervalMs: 80,
    };
  }

  getDisplayData(): Record<string, DisplayValue> {
    const metrics = this.getMetrics();
    const viewMode = this.getParameter('viewMode') as ViewMode;
    const mechanism = this.getParameter('mechanism') as SynchrotronMechanism;

    return {
      viewMode: {
        label: 'View Mode',
        value: viewMode === 'macro' ? 'Synchrotron Ring' : 'E/B Field Motion',
      },
      mechanism: {
        label: 'Micro Mechanism',
        value: mechanism === 'rf'
          ? 'RF Acceleration'
          : mechanism === 'bending'
            ? 'Magnetic Bending'
            : mechanism === 'synchronized'
              ? 'Synchronized Orbit'
              : 'Collision Point',
      },
      speed: {
        label: 'Particle Speed',
        value: metrics.speed.toFixed(2),
        unit: 'm/s',
      },
      force: {
        label: 'Lorentz Force',
        value: metrics.forceMagnitude.toFixed(2),
        unit: 'N',
      },
      separation: {
        label: 'Beam Separation',
        value: metrics.separation.toFixed(2),
        unit: 'm',
      },
      kineticEnergy: {
        label: 'Kinetic Energy',
        value: metrics.kineticEnergy.toFixed(2),
        unit: 'J',
      },
      time: {
        label: 'Particle Time',
        value: this.elapsedTime.toFixed(2),
        unit: 's',
      },
    };
  }

  dispose(): void {
    disposeObject3D(this.root);
    super.dispose();
    this.root = new THREE.Group();
    this.ring = null;
    this.beams = null;
    this.microView = null;
  }

  private setupSceneLighting(): void {
    const cyanKey = new THREE.PointLight(0x38bdf8, 2.1, 16);
    cyanKey.position.set(-4, 4.6, 3.8);
    this.root.add(cyanKey);

    const orangeKick = new THREE.PointLight(0xf97316, 1.5, 12);
    orangeKick.position.set(4.6, 2.3, -2.6);
    this.root.add(orangeKick);

    const detectorLight = new THREE.PointLight(0xffffff, 1.4, 7);
    detectorLight.position.set(4.25, 0.8, 0);
    this.root.add(detectorLight);
  }

  private createBackground(): void {
    const particleCount = 520;
    const positions = new Float32Array(particleCount * 3);

    for (let index = 0; index < particleCount; index += 1) {
      const radius = 8 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[index * 3 + 1] = Math.cos(phi) * radius * 0.7 + 2;
      positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0x7dd3fc,
        size: 0.025,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
    );
    stars.name = 'Dark laboratory star field';
    this.root.add(stars);
  }

  private syncMicroParameters(): void {
    this.microView?.setParameters(this.getMicroParameters());
  }

  private getMicroParameters(): SynchrotronMicroSettings & { showVectors: boolean; showLabels: boolean } {
    return {
      mechanism: this.getParameter('mechanism') as SynchrotronMechanism,
      electricFieldStrength: this.getSafeNumber('electricFieldStrength', 1.1, -3, 3),
      magneticFieldStrength: this.getSafeNumber('magneticFieldStrength', 1.35, -3, 3),
      charge: this.getSafeNumber('charge', 1, -2, 2),
      mass: this.getSafeNumber('mass', 1, 0.2, 5),
      initialSpeed: this.getSafeNumber('initialSpeed', 1.8, 0.3, 4),
      showVectors: Boolean(this.getParameter('showVectors')),
      showLabels: Boolean(this.getParameter('showLabels')),
    };
  }

  private applyViewMode(): void {
    const viewMode = this.getParameter('viewMode') as ViewMode;
    const showMacro = viewMode !== 'micro';

    if (this.ring) {
      this.ring.group.visible = showMacro;
    }
    if (this.beams) {
      this.beams.group.visible = showMacro;
    }
    if (this.microView) {
      this.microView.group.visible = !showMacro;
    }
  }

  private getMetrics() {
    return this.microView?.getDisplayData() ?? {
      speed: 0,
      forceMagnitude: 0,
      kineticEnergy: 0,
      separation: 0,
      collisionAge: 0,
      collisionEnergy: 0,
    };
  }
}
