import * as THREE from 'three';
import {
  ExperimentBase,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  calculateCentralMaximumWidth,
  calculateFringeSpacing,
  calculateInterferenceIntensity,
  estimateVisibleOrder,
  type InterferenceSetup,
} from './InterferencePhysics';
import { wavelengthToColor, wavelengthToLabel } from './WavelengthColor';

const SCREEN_WIDTH = 1.25;
const SCREEN_HEIGHT = 4.8;
const WAVE_LINE_COUNT = 10;
const WAVE_SEGMENTS = 72;
const WAVE_FRONT_SPEED = 1.4;
const WAVE_RADIUS_SPACING = 0.42;
const MAX_WAVE_RADIUS = 6;

const SOURCE_X = -4.8;
const BARRIER_X = -0.1;
const SCREEN_X = 4.8;

export class DoubleSlitInterference extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'double-slit-interference',
    name: 'Double-Slit Interference',
    category: ExperimentCategory.Optics,
    description: 'Observe fringe spacing and diffraction envelope from two coherent slits',
    difficulty: 'intermediate',
    duration: 22,
    keywords: ['double slit', 'interference', 'diffraction', 'fringe spacing', 'optics'],
    thumbnail: '/thumbnails/double-slit-interference.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      timestep: 1 / 60,
    },
    camera: {
      position: [8.6, 3.6, 8.2],
      target: [0.4, 0, 0],
      fov: 46,
    },
    parameters: [
      {
        key: 'wavelength',
        label: 'Wavelength',
        type: 'number',
        defaultValue: 550,
        min: 380,
        max: 780,
        step: 1,
        unit: 'nm',
      },
      {
        key: 'slitSeparation',
        label: 'Slit Separation',
        type: 'number',
        defaultValue: 0.5,
        min: 0.1,
        max: 2,
        step: 0.01,
        unit: 'mm',
      },
      {
        key: 'screenDistance',
        label: 'Screen Distance',
        type: 'number',
        defaultValue: 1,
        min: 0.5,
        max: 5,
        step: 0.05,
        unit: 'm',
      },
      {
        key: 'slitWidth',
        label: 'Slit Width',
        type: 'number',
        defaultValue: 0.1,
        min: 0.01,
        max: 0.5,
        step: 0.01,
        unit: 'mm',
      },
    ],
  };

  private sourceMesh: THREE.Mesh | null = null;
  private barrierGroup: THREE.Group | null = null;
  private screenMesh: THREE.Mesh | null = null;
  private screenTexture: THREE.CanvasTexture | null = null;
  private screenCanvas: HTMLCanvasElement | null = null;
  private screenContext: CanvasRenderingContext2D | null = null;

  private waveLinesUpper: THREE.Line[] = [];
  private waveLinesLower: THREE.Line[] = [];
  private phase = 0;

  protected async setupScene(): Promise<void> {
    this.createLights();
    this.createGround();
    this.createSource();
    this.createBarrier();
    this.createScreen();
    this.createWavefronts();
    this.refreshStaticVisuals();
  }

  protected onReset(): void {
    this.phase = 0;
    this.refreshStaticVisuals();
  }

  protected onParameterChange(): void {
    this.refreshStaticVisuals();
  }

  update(deltaTime: number): void {
    if (!this.isRunning) {
      return;
    }

    const dt = THREE.MathUtils.clamp(deltaTime, 0.001, 0.05);
    this.phase += dt * WAVE_FRONT_SPEED;
    this.updateWavefrontGeometry();
    this.renderFringeTexture();
  }

  getDisplayData(): Record<string, DisplayValue> {
    const setup = this.readSetup();
    const spacingM = calculateFringeSpacing(setup.wavelengthNm, setup.screenDistanceM, setup.slitSeparationMm);
    const centralWidthM = calculateCentralMaximumWidth(setup.wavelengthNm, setup.screenDistanceM, setup.slitWidthMm);
    const visibleOrder = estimateVisibleOrder(setup, SCREEN_HEIGHT * 0.5);

    return {
      wavelength: {
        label: 'Wavelength',
        value: this.round(setup.wavelengthNm, 0),
        unit: 'nm',
      },
      fringeSpacing: {
        label: 'Fringe Spacing',
        value: this.round(spacingM * 1000, 3),
        unit: 'mm',
      },
      centralWidth: {
        label: 'Central Bright Width',
        value: this.round(centralWidthM * 1000, 3),
        unit: 'mm',
      },
      visibleOrder: {
        label: 'Visible Order k',
        value: visibleOrder,
      },
      colorBand: {
        label: 'Color Band',
        value: wavelengthToLabel(setup.wavelengthNm),
      },
    };
  }

  getMonitorSchema() {
    return {
      title: 'Monitor',
      quantities: [
        { key: 'wavelength', label: 'Wavelength', unit: 'nm', color: '#22d3ee' },
        { key: 'fringeSpacing', label: 'Fringe Spacing', unit: 'mm', color: '#34d399' },
        { key: 'centralWidth', label: 'Central Bright Width', unit: 'mm', color: '#f59e0b' },
        { key: 'visibleOrder', label: 'Visible Order k', color: '#a78bfa' },
      ],
      defaultSelected: ['fringeSpacing', 'centralWidth', 'visibleOrder'],
      sampleIntervalMs: 100,
    };
  }

  dispose(): void {
    this.screenTexture?.dispose();
    this.screenTexture = null;
    this.screenCanvas = null;
    this.screenContext = null;

    this.waveLinesUpper.forEach((line) => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.waveLinesLower.forEach((line) => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.waveLinesUpper = [];
    this.waveLinesLower = [];

    if (this.barrierGroup) {
      this.barrierGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((item) => item.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    this.sourceMesh = null;
    this.barrierGroup = null;
    this.screenMesh = null;

    super.dispose();
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.48);
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(8, 10, 7);
    const fill = new THREE.DirectionalLight(0x9ecaff, 0.28);
    fill.position.set(-5, 4, -3);

    this.addToScene(ambient);
    this.addToScene(key);
    this.addToScene(fill);
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.92, metalness: 0.04 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.7;
    this.addToScene(ground);

    const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
    grid.position.y = -2.69;
    this.addToScene(grid);
  }

  private createSource(): void {
    this.sourceMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x84cc16, emissive: 0x84cc16, emissiveIntensity: 1.1, roughness: 0.25 }),
    );
    this.sourceMesh.position.set(SOURCE_X, 0, 0);
    this.addToScene(this.sourceMesh);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.18 }),
    );
    halo.position.copy(this.sourceMesh.position);
    this.addToScene(halo);
  }

  private createBarrier(): void {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.42 });

    const slitY = this.getSlitOffsetY();
    const slitHeight = this.getSlitWidthVisual();

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6 - slitY - slitHeight * 0.5, 2.6), material);
    top.position.set(BARRIER_X, (2.6 + slitY + slitHeight * 0.5) * 0.5, 0);
    group.add(top);

    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6 - slitY - slitHeight * 0.5, 2.6), material);
    bottom.position.set(BARRIER_X, -(2.6 + slitY + slitHeight * 0.5) * 0.5, 0);
    group.add(bottom);

    const centerBridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, Math.max(0.12, slitY * 2 - slitHeight), 2.6), material);
    centerBridge.position.set(BARRIER_X, 0, 0);
    group.add(centerBridge);

    this.barrierGroup = group;
    this.addToScene(group);
  }

  private createScreen(): void {
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 600;
    this.screenCanvas.height = 1400;
    this.screenContext = this.screenCanvas.getContext('2d');

    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.needsUpdate = true;

    this.screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT),
      new THREE.MeshBasicMaterial({ map: this.screenTexture, side: THREE.DoubleSide }),
    );
    this.screenMesh.position.set(SCREEN_X, 0, 0);
    this.screenMesh.rotation.y = -Math.PI / 2;
    this.addToScene(this.screenMesh);
  }

  private createWavefronts(): void {
    for (let i = 0; i < WAVE_LINE_COUNT; i += 1) {
      const opacity = THREE.MathUtils.lerp(0.12, 0.58, 1 - i / WAVE_LINE_COUNT);
      const materialUpper = new THREE.LineBasicMaterial({ color: 0xa3e635, transparent: true, opacity });
      const materialLower = new THREE.LineBasicMaterial({ color: 0xa3e635, transparent: true, opacity });

      const upper = new THREE.Line(this.createWaveGeometry(), materialUpper);
      const lower = new THREE.Line(this.createWaveGeometry(), materialLower);
      this.waveLinesUpper.push(upper);
      this.waveLinesLower.push(lower);
      this.addToScene(upper);
      this.addToScene(lower);
    }

    this.updateWavefrontGeometry();
  }

  private refreshStaticVisuals(): void {
    this.updateSourceColor();
    this.updateBarrierGeometry();
    this.phase = 0;
    this.updateWavefrontGeometry();
    this.renderFringeTexture();
  }

  private updateSourceColor(): void {
    if (!this.sourceMesh) {
      return;
    }

    const color = wavelengthToColor(this.getSafeNumber('wavelength', 550, 380, 780));
    const material = this.sourceMesh.material as THREE.MeshStandardMaterial;
    material.color.copy(color);
    material.emissive.copy(color);

    this.waveLinesUpper.forEach((line) => {
      (line.material as THREE.LineBasicMaterial).color.copy(color);
    });
    this.waveLinesLower.forEach((line) => {
      (line.material as THREE.LineBasicMaterial).color.copy(color);
    });
  }

  private updateBarrierGeometry(): void {
    if (!this.barrierGroup) {
      return;
    }

    const slitY = this.getSlitOffsetY();
    const slitHeight = this.getSlitWidthVisual();

    const top = this.barrierGroup.children[0] as THREE.Mesh;
    const bottom = this.barrierGroup.children[1] as THREE.Mesh;
    const centerBridge = this.barrierGroup.children[2] as THREE.Mesh;

    top.geometry.dispose();
    top.geometry = new THREE.BoxGeometry(0.22, 2.6 - slitY - slitHeight * 0.5, 2.6);
    top.position.set(BARRIER_X, (2.6 + slitY + slitHeight * 0.5) * 0.5, 0);

    bottom.geometry.dispose();
    bottom.geometry = new THREE.BoxGeometry(0.22, 2.6 - slitY - slitHeight * 0.5, 2.6);
    bottom.position.set(BARRIER_X, -(2.6 + slitY + slitHeight * 0.5) * 0.5, 0);

    centerBridge.geometry.dispose();
    centerBridge.geometry = new THREE.BoxGeometry(0.22, Math.max(0.12, slitY * 2 - slitHeight), 2.6);
    centerBridge.position.set(BARRIER_X, 0, 0);
  }

  private updateWavefrontGeometry(): void {
    const slitY = this.getSlitOffsetY();

    for (let i = 0; i < WAVE_LINE_COUNT; i += 1) {
      const radius = (this.phase + i * WAVE_RADIUS_SPACING) % MAX_WAVE_RADIUS;
      this.updateWaveLine(this.waveLinesUpper[i], BARRIER_X, slitY, radius);
      this.updateWaveLine(this.waveLinesLower[i], BARRIER_X, -slitY, radius);
    }
  }

  private updateWaveLine(line: THREE.Line, originX: number, originY: number, radius: number): void {
    const geometry = line.geometry as THREE.BufferGeometry;
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attribute) {
      return;
    }

    const positions = attribute.array as Float32Array;
    const startAngle = -0.75;
    const endAngle = 0.75;

    for (let i = 0; i <= WAVE_SEGMENTS; i += 1) {
      const t = i / WAVE_SEGMENTS;
      const angle = startAngle + (endAngle - startAngle) * t;
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      const index = i * 3;
      positions[index] = x;
      positions[index + 1] = y;
      positions[index + 2] = 0;
    }
    attribute.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  private renderFringeTexture(): void {
    if (!this.screenCanvas || !this.screenContext || !this.screenTexture) {
      return;
    }

    const ctx = this.screenContext;
    const width = this.screenCanvas.width;
    const height = this.screenCanvas.height;
    const setup = this.readSetup();
    const baseColor = wavelengthToColor(setup.wavelengthNm);
    const baseR = Math.round(baseColor.r * 255);
    const baseG = Math.round(baseColor.g * 255);
    const baseB = Math.round(baseColor.b * 255);

    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    const halfHeightWorld = SCREEN_HEIGHT * 0.5;
    const curvePoints: Array<{ x: number; y: number }> = [];

    for (let py = 0; py < height; py += 1) {
      const yNorm = 1 - py / (height - 1);
      const yWorld = (yNorm * 2 - 1) * halfHeightWorld;
      const shifted = yWorld + Math.sin(this.phase * 1.7) * 0.02;
      const intensity = calculateInterferenceIntensity(shifted, setup);
      const brightness = Math.max(0, Math.min(1, intensity));

      ctx.fillStyle = `rgb(${Math.round(baseR * brightness)}, ${Math.round(baseG * brightness)}, ${Math.round(baseB * brightness)})`;
      ctx.fillRect(0, py, width - 80, 1);

      curvePoints.push({
        x: width - 72 + brightness * 64,
        y: py,
      });
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    curvePoints.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(220, 235, 255, 0.84)';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('I(y)', width - 70, 42);

    this.screenTexture.needsUpdate = true;
  }

  private readSetup(): InterferenceSetup {
    return {
      wavelengthNm: this.getSafeNumber('wavelength', 550, 380, 780),
      slitSeparationMm: this.getSafeNumber('slitSeparation', 0.5, 0.1, 2),
      slitWidthMm: this.getSafeNumber('slitWidth', 0.1, 0.01, 0.5),
      screenDistanceM: this.getSafeNumber('screenDistance', 1, 0.5, 5),
    };
  }

  private getSlitOffsetY(): number {
    const separation = this.getSafeNumber('slitSeparation', 0.5, 0.1, 2);
    const normalized = (separation - 0.1) / (2 - 0.1);
    return THREE.MathUtils.lerp(0.25, 0.95, normalized);
  }

  private getSlitWidthVisual(): number {
    const slitWidth = this.getSafeNumber('slitWidth', 0.1, 0.01, 0.5);
    const normalized = (slitWidth - 0.01) / (0.5 - 0.01);
    return THREE.MathUtils.lerp(0.06, 0.26, normalized);
  }

  private round(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  private createWaveGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((WAVE_SEGMENTS + 1) * 3), 3));
    return geometry;
  }
}
