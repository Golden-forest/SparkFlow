import * as THREE from 'three';
import {
  ExperimentBase,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import { GasMolecules, type GasMoleculeBounds } from './GasMolecules';

export class BoyleLaw extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'boyle-law',
    name: "Boyle's Law Lab",
    category: ExperimentCategory.Thermodynamics,
    description: 'Explore how pressure changes with volume at constant temperature using the ideal gas law',
    difficulty: 'basic',
    duration: 18,
    keywords: ['boyle law', 'ideal gas', 'pressure', 'volume', 'thermodynamics'],
    thumbnail: '/thumbnails/boyle-law.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      timestep: 1 / 60,
    },
    camera: {
      position: [5.5, 4.8, 7.2],
      target: [0, 1.8, 0],
      fov: 50,
    },
    parameters: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        defaultValue: 5,
        min: 0.5,
        max: 10,
        step: 0.1,
        unit: 'L',
      },
      {
        key: 'amount',
        label: 'Amount of Gas',
        type: 'select',
        defaultValue: '1',
        options: [
          { value: '1', label: '1 mol' },
          { value: '2', label: '2 mol' },
          { value: '3', label: '3 mol' },
        ],
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 300,
        min: 200,
        max: 500,
        step: 5,
        unit: 'K',
      },
    ],
  };

  private readonly idealGasConstant = 8.314; // kPa*L/(mol*K)
  private readonly minVolumeL = 0.5;
  private readonly maxVolumeL = 10;
  private readonly moleculesPerMol = 40;
  private readonly maxMoleculeCount = 120;

  private readonly cylinderRadius = 1.35;
  private readonly innerRadius = 1.16;
  private readonly chamberBottomY = 0.18;
  private readonly pistonThickness = 0.2;
  private readonly pistonMinY = 0.85;
  private readonly pistonMaxY = 3.5;

  private piston: THREE.Mesh | null = null;
  private weightBlocks: THREE.Mesh[] = [];
  private gasMolecules: GasMolecules | null = null;

  protected async setupScene(): Promise<void> {
    this.createLights();
    this.createGround();
    this.createChamber();
    this.createPiston();
    this.createWeightBlocks();
    this.createGasMolecules();
    this.syncSceneFromParameters(true);
  }

  protected onReset(): void {
    this.syncSceneFromParameters(true);
  }

  protected onParameterChange(key: string): void {
    this.syncSceneFromParameters(key === 'amount');
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.gasMolecules) {
      return;
    }

    const dt = THREE.MathUtils.clamp(deltaTime, 0.001, 0.05);
    this.gasMolecules.setBounds(this.getGasBounds());
    this.gasMolecules.update(dt);
  }

  getDisplayData(): Record<string, DisplayValue> {
    const volume = this.getVolumeLiters();
    const amount = this.getAmountMoles();
    const temperature = this.getTemperatureKelvin();
    const pressure = this.calculatePressureKPa(volume, amount, temperature);
    const pv = pressure * volume;

    return {
      pressure: {
        label: 'Pressure',
        value: this.round(pressure, 2),
        unit: 'kPa',
      },
      volume: {
        label: 'Volume',
        value: this.round(volume, 2),
        unit: 'L',
      },
      pv: {
        label: 'PV Product',
        value: this.round(pv, 3),
        unit: 'kPa*L',
      },
      temperature: {
        label: 'Temperature',
        value: this.round(temperature, 1),
        unit: 'K',
      },
    };
  }

  getMonitorSchema() {
    return {
      title: 'Monitor',
      quantities: [
        { key: 'pressure', label: 'Pressure', unit: 'kPa', color: '#22d3ee' },
        { key: 'volume', label: 'Volume', unit: 'L', color: '#34d399' },
        { key: 'pv', label: 'PV Product', unit: 'kPa*L', color: '#f59e0b' },
        { key: 'temperature', label: 'Temperature', unit: 'K', color: '#f97316' },
      ],
      defaultSelected: ['pressure', 'volume', 'pv'],
      sampleIntervalMs: 100,
    };
  }

  dispose(): void {
    this.gasMolecules?.dispose();
    this.gasMolecules = null;
    this.piston = null;
    this.weightBlocks = [];
    super.dispose();
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.addToScene(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(6, 9, 7);
    this.addToScene(key);

    const fill = new THREE.DirectionalLight(0x9ecaff, 0.35);
    fill.position.set(-5, 5, -4);
    this.addToScene(fill);
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.92,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.addToScene(ground);

    const grid = new THREE.GridHelper(18, 18, 0x334155, 0x1e293b);
    grid.position.y = 0.002;
    this.addToScene(grid);
  }

  private createChamber(): void {
    const chamberHeight = this.pistonMaxY - this.chamberBottomY + 0.35;

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(this.cylinderRadius, this.cylinderRadius, chamberHeight, 48, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        transmission: 0.92,
        transparent: true,
        opacity: 0.32,
        roughness: 0.06,
        metalness: 0.04,
        thickness: 0.15,
      }),
    );
    wall.position.y = this.chamberBottomY + chamberHeight / 2;
    this.addToScene(wall);

    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(this.innerRadius, this.innerRadius, 0.12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.4,
        metalness: 0.35,
      }),
    );
    bottom.position.y = this.chamberBottomY - 0.06;
    this.addToScene(bottom);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(this.cylinderRadius, 0.05, 16, 64),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.35,
        metalness: 0.45,
      }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = this.pistonMaxY + 0.08;
    this.addToScene(rim);
  }

  private createPiston(): void {
    this.piston = new THREE.Mesh(
      new THREE.CylinderGeometry(this.innerRadius * 0.98, this.innerRadius * 0.98, this.pistonThickness, 48),
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.3,
        metalness: 0.5,
      }),
    );
    this.addToScene(this.piston);
  }

  private createWeightBlocks(): void {
    for (let i = 0; i < 10; i += 1) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.18, 0.34),
        new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.4,
          metalness: 0.25,
        }),
      );
      block.visible = false;
      this.weightBlocks.push(block);
      this.addToScene(block);
    }
  }

  private createGasMolecules(): void {
    const amount = this.getAmountMoles();
    this.gasMolecules = new GasMolecules({
      count: amount * this.moleculesPerMol,
      maxCount: this.maxMoleculeCount,
      bounds: this.getGasBounds(),
      temperature: this.getTemperatureKelvin(),
      particleRadius: 0.04,
      color: 0x22d3ee,
    });

    const moleculeMesh = this.gasMolecules.getObject();
    if (moleculeMesh) {
      this.addToScene(moleculeMesh);
    }
  }

  private syncSceneFromParameters(reseedMolecules: boolean): void {
    const volume = this.getVolumeLiters();
    const temperature = this.getTemperatureKelvin();

    this.updatePistonPosition(volume);

    if (this.gasMolecules) {
      if (reseedMolecules) {
        this.gasMolecules.setCount(this.getAmountMoles() * this.moleculesPerMol);
      }
      this.gasMolecules.setTemperature(temperature);
      this.gasMolecules.setBounds(this.getGasBounds());
    }

    this.updateWeightVisualization();
  }

  private updatePistonPosition(volumeLiters: number): void {
    if (!this.piston) {
      return;
    }
    this.piston.position.set(0, this.volumeToPistonY(volumeLiters), 0);
  }

  private updateWeightVisualization(): void {
    if (!this.piston) {
      return;
    }

    const pressure = this.calculatePressureKPa(
      this.getVolumeLiters(),
      this.getAmountMoles(),
      this.getTemperatureKelvin(),
    );

    const normalized = THREE.MathUtils.clamp(
      (Math.log10(Math.max(pressure, 50)) - Math.log10(100)) / (Math.log10(9000) - Math.log10(100)),
      0,
      1,
    );
    const visibleCount = Math.max(1, Math.round(1 + normalized * (this.weightBlocks.length - 1)));
    const pistonTop = this.piston.position.y + this.pistonThickness / 2;

    this.weightBlocks.forEach((block, index) => {
      block.visible = index < visibleCount;
      if (!block.visible) {
        return;
      }

      const layer = Math.floor(index / 2);
      const sideOffset = index % 2 === 0 ? -0.11 : 0.11;
      const depthOffset = index % 2 === 0 ? 0.08 : -0.08;
      block.position.set(sideOffset, pistonTop + 0.12 + layer * 0.2, depthOffset);
    });
  }

  private volumeToPistonY(volumeLiters: number): number {
    const ratio =
      (THREE.MathUtils.clamp(volumeLiters, this.minVolumeL, this.maxVolumeL) - this.minVolumeL) /
      (this.maxVolumeL - this.minVolumeL);
    return this.pistonMinY + ratio * (this.pistonMaxY - this.pistonMinY);
  }

  private getGasBounds(): GasMoleculeBounds {
    const pistonY = this.piston?.position.y ?? this.volumeToPistonY(this.getVolumeLiters());
    return {
      radius: this.innerRadius * 0.95,
      minY: this.chamberBottomY + 0.05,
      maxY: pistonY - this.pistonThickness / 2 - 0.05,
    };
  }

  private getVolumeLiters(): number {
    return this.getSafeNumber('volume', 5, this.minVolumeL, this.maxVolumeL);
  }

  private getTemperatureKelvin(): number {
    return this.getSafeNumber('temperature', 300, 200, 500);
  }

  private getAmountMoles(): number {
    const value = this.getParameter('amount');
    if (typeof value === 'number' && Number.isFinite(value)) {
      return THREE.MathUtils.clamp(Math.round(value), 1, 3);
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return THREE.MathUtils.clamp(Math.round(parsed), 1, 3);
      }
    }
    return 1;
  }

  private calculatePressureKPa(volumeLiters: number, amountMoles: number, temperatureKelvin: number): number {
    return (amountMoles * this.idealGasConstant * temperatureKelvin) / volumeLiters;
  }

  private round(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }
}
