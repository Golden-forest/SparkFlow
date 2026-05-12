# Electrochemical Cell Simulation - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified galvanic/electrolytic cell simulation with 3D apparatus, particle flow animation, and chemical equation display using the existing ExperimentBase plugin architecture.

**Architecture:** Standard ExperimentBase plugin in new `electrochemistry` category. Single 3D scene overlays macro apparatus with microscopic particle animations. Mode switching (galvanic ↔ electrolytic) via clickable device on wire. Physics calculations in separate pure-function module.

**Tech Stack:** Three.js (LatheGeometry, TubeGeometry, InstancedMesh), React Three Fiber, Zustand, existing ExperimentBase/ExperimentRegistry infrastructure.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/experiments/electrochemistry/index.ts` | Module exports |
| Create | `src/experiments/electrochemistry/ElectrochemistryPhysics.ts` | Pure physics calculations (Nernst, Faraday, Ohm) |
| Create | `src/experiments/electrochemistry/ParticleFlowSystem.ts` | InstancedMesh particle animation along paths |
| Create | `src/experiments/electrochemistry/GalvanicCell.ts` | Main experiment class extending ExperimentBase |
| Modify | `src/utils/constants.ts:22-29` | Add `Electrochemistry` category |
| Modify | `src/experiments/index.ts` | Register new experiment |
| Modify | `src/pages/Home.tsx` | Add experiment card with SVG diagram |

---

### Task 1: Add Electrochemistry Category to Constants

**Files:**
- Modify: `src/utils/constants.ts:22-29`

- [ ] **Step 1: Add the new category to ExperimentCategory**

In `src/utils/constants.ts`, add `Electrochemistry` to the `ExperimentCategory` object after line 28 (`Celestial: 'celestial',`):

```typescript
export const ExperimentCategory = {
    Mechanics: 'mechanics',
    Electromagnetism: 'electromagnetism',
    Optics: 'optics',
    AtomicPhysics: 'atomic',
    Thermodynamics: 'thermodynamics',
    Celestial: 'celestial',
    Electrochemistry: 'electrochemistry',
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/constants.ts
git commit -m "feat(constants): add Electrochemistry experiment category"
```

---

### Task 2: Create ElectrochemistryPhysics Module

**Files:**
- Create: `src/experiments/electrochemistry/ElectrochemistryPhysics.ts`

- [ ] **Step 1: Create the physics calculation module**

Create `src/experiments/electrochemistry/ElectrochemistryPhysics.ts`:

```typescript
/**
 * Electrochemistry Physics - Pure calculation functions
 *
 * Provides Nernst equation, Ohm's law, and Faraday's law calculations
 * for galvanic cell and electrolytic cell simulations.
 */

/** Physical constants used in electrochemistry */
const R = 8.314;        // Gas constant (J/(mol·K))
const F = 96485;        // Faraday constant (C/mol)
const E0_ZnCu = 1.10;   // Standard EMF for Zn|Cu cell (V)

/** Cell mode determines reaction direction and labeling */
export type CellMode = 'galvanic' | 'electrolytic';

/** Electrode reaction data for display */
export interface ElectrodeReactions {
    anodeReaction: string;
    cathodeReaction: string;
    totalReaction: string;
    anodeLabel: string;
    cathodeLabel: string;
    anodeProcess: string;   // 'oxidation' | 'reduction'
    cathodeProcess: string; // 'oxidation' | 'reduction'
}

/** Computed electrochemical data */
export interface ElectrochemistryData {
    emf: number;                // Cell EMF (V)
    current: number;            // Current (A)
    electronFlowRate: number;   // Electrons per second
    znConcentration: number;    // Zn²⁺ concentration (mol/L)
    cuDepositedMass: number;    // Cu deposited (mg)
    decompositionVoltage: number; // Min voltage for electrolysis (V)
}

/** Parameters needed for calculations */
export interface CalculationParams {
    mode: CellMode;
    concentration: number;     // CuSO₄ concentration (mol/L)
    temperature: number;       // Temperature (°C)
    electrodeSpacing: number;  // Distance between electrodes (cm)
    externalResistance: number; // External resistance (Ω), galvanic only
    appliedVoltage: number;    // Applied voltage (V), electrolytic only
    elapsedTime: number;       // Total elapsed time (s)
}

/**
 * Calculate cell EMF using Nernst equation
 * E = E° - (RT / nF) * ln(Q)
 * For Zn|Cu: Q = [Zn²⁺] / [Cu²⁺], n = 2
 */
export function calculateEMF(
    cuConcentration: number,
    temperatureCelsius: number,
): number {
    const T = temperatureCelsius + 273.15; // Convert to Kelvin
    const n = 2; // electrons transferred
    // Assume Zn²⁺ concentration starts at 0.1 and increases over time
    const znConcentration = 0.1;
    const Q = znConcentration / Math.max(cuConcentration, 0.001);
    const emf = E0_ZnCu - (R * T / (n * F)) * Math.log(Q);
    return Math.max(0, emf);
}

/**
 * Estimate internal resistance based on electrode spacing
 * Simplified model: R_internal = k * d / (conductivity * A)
 * Using approximate values for CuSO₄ solution
 */
export function calculateInternalResistance(
    electrodeSpacingCm: number,
    concentration: number,
): number {
    // Simplified: higher concentration = lower resistance
    const conductivity = 0.5 + concentration * 2.0; // S/m (approximate)
    const distance = electrodeSpacingCm / 100; // Convert to meters
    const area = 0.001; // Approximate electrode area (m²)
    return Math.max(0.1, distance / (conductivity * area));
}

/**
 * Calculate current flowing through the circuit
 * Galvanic: I = E / (R_internal + R_external)
 * Electrolytic: I = (V_applied - V_decomposition) / R_total
 */
export function calculateCurrent(params: CalculationParams): number {
    const rInternal = calculateInternalResistance(params.electrodeSpacing, params.concentration);

    if (params.mode === 'galvanic') {
        const emf = calculateEMF(params.concentration, params.temperature);
        const totalResistance = rInternal + Math.max(params.externalResistance, 0.1);
        return emf / totalResistance;
    } else {
        // Electrolytic mode
        const vDecomp = calculateDecompositionVoltage(params.concentration, params.temperature);
        const netVoltage = Math.max(0, params.appliedVoltage - vDecomp);
        return netVoltage / (rInternal + 1.0); // +1Ω for wiring resistance
    }
}

/**
 * Calculate minimum decomposition voltage for electrolysis
 * V_decomp = E°(cell) + overpotentials (simplified)
 */
export function calculateDecompositionVoltage(
    concentration: number,
    temperatureCelsius: number,
): number {
    const emf = calculateEMF(concentration, temperatureCelsius);
    // Add overpotential (simplified: ~0.3V for gas evolution on electrodes)
    return emf + 0.3;
}

/**
 * Calculate mass deposited using Faraday's law
 * m = (M * I * t) / (n * F)
 * For Cu: M = 63.546 g/mol, n = 2
 */
export function calculateMassDeposited(
    current: number,
    elapsedTime: number,
): number {
    const M_Cu = 63.546; // g/mol
    const n = 2;
    const massGrams = (M_Cu * current * elapsedTime) / (n * F);
    return massGrams * 1000; // Convert to mg
}

/**
 * Calculate electron flow rate
 * rate = I / e where e is elementary charge
 */
export function calculateElectronFlowRate(current: number): number {
    const e = 1.602176634e-19; // Elementary charge (C)
    return current / e;
}

/**
 * Update Zn²⁺ concentration based on current and time
 * Δ[Zn²⁺] = (I * t) / (n * F * V_solution)
 */
export function updateZnConcentration(
    initialConcentration: number,
    current: number,
    deltaTime: number,
    solutionVolumeL: number = 0.5,
): number {
    const n = 2;
    const molesProduced = (current * deltaTime) / (n * F);
    const deltaConcentration = molesProduced / solutionVolumeL;
    return initialConcentration + deltaConcentration;
}

/**
 * Get all electrochemical data as a single object
 */
export function calculateAllData(params: CalculationParams): ElectrochemistryData {
    const emf = calculateEMF(params.concentration, params.temperature);
    const current = calculateCurrent(params);
    const electronFlowRate = calculateElectronFlowRate(current);
    const cuDepositedMass = calculateMassDeposited(current, params.elapsedTime);
    const decompositionVoltage = calculateDecompositionVoltage(
        params.concentration,
        params.temperature,
    );

    // Calculate Zn²⁺ concentration accumulated over time
    const znConcentration = 0.1 + (current * params.elapsedTime) / (2 * F * 0.5);

    return {
        emf,
        current,
        electronFlowRate,
        znConcentration,
        cuDepositedMass,
        decompositionVoltage,
    };
}

/**
 * Get electrode reactions based on cell mode
 */
export function getReactions(mode: CellMode): ElectrodeReactions {
    if (mode === 'galvanic') {
        return {
            anodeReaction: 'Zn \u2192 Zn\u00B2\u207A + 2e\u207B',
            cathodeReaction: 'Cu\u00B2\u207A + 2e\u207B \u2192 Cu',
            totalReaction: 'Zn + Cu\u00B2\u207A \u2192 Zn\u00B2\u207A + Cu',
            anodeLabel: 'Zn (\u2212)',
            cathodeLabel: 'Cu (+)',
            anodeProcess: 'oxidation',
            cathodeProcess: 'reduction',
        };
    } else {
        return {
            anodeReaction: 'Cu \u2192 Cu\u00B2\u207A + 2e\u207B',
            cathodeReaction: 'Cu\u00B2\u207A + 2e\u207B \u2192 Cu',
            totalReaction: 'Cu (anode) \u2192 Cu\u00B2\u207A \u2192 Cu (cathode)',
            anodeLabel: 'Cu (+)',
            cathodeLabel: 'Zn (\u2212)',
            anodeProcess: 'oxidation',
            cathodeProcess: 'reduction',
        };
    }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/experiments/electrochemistry/ElectrochemistryPhysics.ts
git commit -m "feat(electrochemistry): add physics calculation module with Nernst, Faraday, Ohm"
```

---

### Task 3: Create ParticleFlowSystem Module

**Files:**
- Create: `src/experiments/electrochemistry/ParticleFlowSystem.ts`

- [ ] **Step 1: Create the particle animation system**

Create `src/experiments/electrochemistry/ParticleFlowSystem.ts`:

```typescript
import * as THREE from 'three';

/**
 * ParticleFlowSystem - Manages animated particles along predefined paths
 *
 * Uses InstancedMesh for efficient rendering of electrons, cations, and anions.
 * Particles follow spline curves and loop continuously.
 */

/** Dopamine palette colors */
const COLORS = {
    electron: new THREE.Color('#00FF41'),   // Green
    cation: new THREE.Color('#FFD166'),     // Yellow-Gold
    anion: new THREE.Color('#38BDF8'),      // Sky Blue
} as const;

const PARTICLE_RADIUS = 0.04;
const PARTICLE_SEGMENTS = 8;

export type ParticleType = 'electron' | 'cation' | 'anion';

interface ParticlePath {
    curve: THREE.CatmullRomCurve3;
    type: ParticleType;
    count: number;
    /** Each particle's progress along the curve [0, 1) */
    offsets: number[];
}

export class ParticleFlowSystem {
    private paths: ParticlePath[] = [];
    private meshes: Map<ParticleType, THREE.InstancedMesh> = new Map();
    private speed: number = 1.0;
    private direction: number = 1; // 1 = forward, -1 = reverse
    private scene: THREE.Scene | null = null;

    /** Temporary objects reused each frame to avoid GC pressure */
    private readonly _matrix = new THREE.Matrix4();
    private readonly _position = new THREE.Vector3();
    private readonly _quaternion = new THREE.Quaternion();
    private readonly _scale = new THREE.Vector3(1, 1, 1);

    /**
     * Initialize the particle system with paths and create InstancedMeshes
     */
    init(
        scene: THREE.Scene,
        wirePath: THREE.Vector3[],
        solutionPaths: { cation: THREE.Vector3[]; anion: THREE.Vector3[] },
        electronCount: number = 12,
        cationCount: number = 8,
        anionCount: number = 6,
    ): void {
        this.scene = scene;

        // Create wire path for electrons
        const electronCurve = new THREE.CatmullRomCurve3(wirePath, false, 'catmullrom', 0.5);
        const electronOffsets = this.createDistributedOffsets(electronCount);
        this.paths.push({ curve: electronCurve, type: 'electron', count: electronCount, offsets: electronOffsets });

        // Create solution paths for ions
        const cationCurve = new THREE.CatmullRomCurve3(solutionPaths.cation, false, 'catmullrom', 0.5);
        const cationOffsets = this.createDistributedOffsets(cationCount);
        this.paths.push({ curve: cationCurve, type: 'cation', count: cationCount, offsets: cationOffsets });

        const anionCurve = new THREE.CatmullRomCurve3(solutionPaths.anion, false, 'catmullrom', 0.5);
        const anionOffsets = this.createDistributedOffsets(anionCount);
        this.paths.push({ curve: anionCurve, type: 'anion', count: anionCount, offsets: anionOffsets });

        // Create InstancedMesh for each particle type
        this.createInstancedMesh('electron', electronCount, COLORS.electron);
        this.createInstancedMesh('cation', cationCount, COLORS.cation);
        this.createInstancedMesh('anion', anionCount, COLORS.anion);
    }

    /**
     * Create evenly distributed starting offsets [0, 1)
     */
    private createDistributedOffsets(count: number): number[] {
        const offsets: number[] = [];
        for (let i = 0; i < count; i++) {
            offsets.push(i / count);
        }
        return offsets;
    }

    /**
     * Create an InstancedMesh for a particle type
     */
    private createInstancedMesh(type: ParticleType, count: number, color: THREE.Color): void {
        if (!this.scene) return;

        const geometry = new THREE.SphereGeometry(PARTICLE_RADIUS, PARTICLE_SEGMENTS, PARTICLE_SEGMENTS);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
        });

        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Initialize all instances at origin
        for (let i = 0; i < count; i++) {
            mesh.setMatrixAt(i, this._matrix.identity());
        }
        mesh.instanceMatrix.needsUpdate = true;

        this.scene.add(mesh);
        this.meshes.set(type, mesh);
    }

    /**
     * Update particle positions each frame
     * @param deltaTime - Time since last frame (seconds)
     * @param currentMagnitude - Current magnitude (affects speed), 0 to ~1
     */
    update(deltaTime: number, currentMagnitude: number = 1.0): void {
        const baseSpeed = 0.15; // Base speed: traverse 15% of path per second

        for (const path of this.paths) {
            const mesh = this.meshes.get(path.type);
            if (!mesh) continue;

            for (let i = 0; i < path.count; i++) {
                // Advance offset along curve
                path.offsets[i] += baseSpeed * currentMagnitude * this.speed * this.direction * deltaTime;

                // Wrap around [0, 1)
                if (path.offsets[i] > 1) path.offsets[i] -= 1;
                if (path.offsets[i] < 0) path.offsets[i] += 1;

                // Get position on curve
                const point = path.curve.getPoint(path.offsets[i]);
                this._position.copy(point);

                this._matrix.compose(this._position, this._quaternion, this._scale);
                mesh.setMatrixAt(i, this._matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        }
    }

    /**
     * Set particle speed multiplier
     */
    setSpeed(speed: number): void {
        this.speed = Math.max(0, speed);
    }

    /**
     * Set direction: 1 for forward (galvanic), -1 for reverse (electrolytic)
     */
    setDirection(direction: number): void {
        this.direction = direction >= 0 ? 1 : -1;
    }

    /**
     * Toggle visibility of all particles
     */
    setVisible(visible: boolean): void {
        for (const mesh of this.meshes.values()) {
            mesh.visible = visible;
        }
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        for (const mesh of this.meshes.values()) {
            this.scene?.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
        }
        this.meshes.clear();
        this.paths = [];
        this.scene = null;
    }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/experiments/electrochemistry/ParticleFlowSystem.ts
git commit -m "feat(electrochemistry): add particle flow system with InstancedMesh"
```

---

### Task 4: Create GalvanicCell Main Experiment Class

**Files:**
- Create: `src/experiments/electrochemistry/GalvanicCell.ts`

This is the largest task. It creates the main experiment class with all 3D scene setup, update loop, control schema, and mode switching logic.

- [ ] **Step 1: Create the main experiment class**

Create `src/experiments/electrochemistry/GalvanicCell.ts`:

```typescript
import * as THREE from 'three';
import {
    ExperimentBase,
    type ExperimentMetadata,
    type ExperimentConfig,
    type DisplayValue,
    type ControlSchema,
    type MonitorSchema,
    type ActionDefinition,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import { ParticleFlowSystem } from './ParticleFlowSystem';
import {
    calculateAllData,
    getReactions,
    type CellMode,
    type CalculationParams,
    type ElectrodeReactions,
} from './ElectrochemistryPhysics';

/** Dopamine palette */
const COLORS = {
    zinc: 0x94a3b8,         // Silver-gray
    copper: 0xF97316,       // Orange
    solution: 0x38BDF8,     // Sky blue
    wire: 0xFACC15,         // Golden
    beakerGlass: 0x94a3b8,  // Neutral gray
    electron: '#00FF41',     // Green (not used in mesh, for labels)
    oxidation: '#F87171',    // Red
    reduction: '#22D3EE',    // Cyan
} as const;

export class GalvanicCell extends ExperimentBase {
    readonly metadata: ExperimentMetadata = {
        id: 'galvanic-cell',
        name: 'Electrochemical Cell',
        category: ExperimentCategory.Electrochemistry,
        description: 'Explore galvanic and electrolytic cells with particle flow visualization and real-time electrochemical calculations',
        difficulty: 'intermediate',
        duration: 25,
        keywords: ['electrochemistry', 'galvanic', 'electrolytic', 'cell', 'battery', 'redox'],
        thumbnail: '/thumbnails/galvanic-cell.png',
    };

    readonly config: ExperimentConfig = {
        physics: { timestep: 1 / 60 },
        camera: {
            position: [0, 4, 8],
            target: [0, 1, 0],
            fov: 50,
        },
        parameters: [
            {
                key: 'mode',
                label: 'Cell Mode',
                type: 'select',
                defaultValue: 'galvanic',
                options: [
                    { value: 'galvanic', label: 'Galvanic Cell' },
                    { value: 'electrolytic', label: 'Electrolytic Cell' },
                ],
            },
            {
                key: 'electrolyteConcentration',
                label: 'CuSO₄ Concentration',
                type: 'number',
                defaultValue: 1.0,
                min: 0.1,
                max: 2.0,
                step: 0.1,
                unit: 'mol/L',
            },
            {
                key: 'temperature',
                label: 'Temperature',
                type: 'number',
                defaultValue: 25,
                min: 0,
                max: 100,
                step: 5,
                unit: '°C',
            },
            {
                key: 'electrodeSpacing',
                label: 'Electrode Spacing',
                type: 'number',
                defaultValue: 5,
                min: 2,
                max: 10,
                step: 0.5,
                unit: 'cm',
            },
            {
                key: 'externalResistance',
                label: 'External Resistance',
                type: 'number',
                defaultValue: 10,
                min: 1,
                max: 100,
                step: 1,
                unit: 'Ω',
            },
            {
                key: 'appliedVoltage',
                label: 'Applied Voltage',
                type: 'number',
                defaultValue: 3.0,
                min: 0,
                max: 12,
                step: 0.5,
                unit: 'V',
            },
            {
                key: 'showParticles',
                label: 'Show Particles',
                type: 'boolean',
                defaultValue: true,
            },
            {
                key: 'showEquations',
                label: 'Show Equations',
                type: 'boolean',
                defaultValue: true,
            },
        ],
    };

    // State
    private elapsedTime = 0;
    private znConcentration = 0.1;
    private particleSystem: ParticleFlowSystem | null = null;

    // 3D object references
    private deviceMesh: THREE.Mesh | null = null;
    private znElectrode: THREE.Mesh | null = null;
    private cuElectrode: THREE.Mesh | null = null;
    private znLabel: THREE.Sprite | null = null;
    private cuLabel: THREE.Sprite | null = null;
    private znPolarityLabel: THREE.Sprite | null = null;
    private cuPolarityLabel: THREE.Sprite | null = null;
    private equationGroup: THREE.Group | null = null;

    protected async setupScene(): Promise<void> {
        if (!this.scene) return;

        this.setupLights();
        this.createBeaker();
        this.createSolution();
        this.createElectrodes();
        this.createWire();
        this.createExternalDevice();
        this.createElectrodeLabels();
        this.initParticleSystem();
    }

    private setupLights(): void {
        if (!this.scene) return;

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.addToScene(ambient);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 10, 7);
        this.addToScene(mainLight);

        const fillLight = new THREE.PointLight(0x38BDF8, 0.3, 20);
        fillLight.position.set(-3, 3, 2);
        this.addToScene(fillLight);
    }

    private createBeaker(): void {
        if (!this.scene) return;

        // Create beaker profile using LatheGeometry
        const points: THREE.Vector2[] = [];
        const height = 3.0;
        const bottomRadius = 1.4;
        const topRadius = 1.6;
        const segments = 20;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const radius = bottomRadius + (topRadius - bottomRadius) * t;
            const y = t * height;
            points.push(new THREE.Vector2(radius, y));
        }

        const geometry = new THREE.LatheGeometry(points, 48);
        const material = new THREE.MeshPhysicalMaterial({
            color: COLORS.beakerGlass,
            transparent: true,
            opacity: 0.2,
            roughness: 0.1,
            metalness: 0.0,
            side: THREE.DoubleSide,
        });

        const beaker = new THREE.Mesh(geometry, material);
        beaker.position.set(0, 0, 0);
        this.addToScene(beaker);
    }

    private createSolution(): void {
        if (!this.scene) return;

        const fillHeight = 2.2;
        const avgRadius = 1.5;
        const geometry = new THREE.CylinderGeometry(avgRadius, avgRadius - 0.1, fillHeight, 48);
        const material = new THREE.MeshStandardMaterial({
            color: COLORS.solution,
            transparent: true,
            opacity: 0.25,
            roughness: 0.3,
            metalness: 0.1,
        });

        const solution = new THREE.Mesh(geometry, material);
        solution.position.set(0, fillHeight / 2, 0);
        this.addToScene(solution);
    }

    private createElectrodes(): void {
        if (!this.scene) return;

        const electrodeWidth = 0.15;
        const electrodeHeight = 3.5;
        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = (spacing / 10) * 0.8; // Convert cm to scene units

        // Zn electrode (left)
        const znGeom = new THREE.BoxGeometry(electrodeWidth, electrodeHeight, 0.8);
        const znMat = new THREE.MeshStandardMaterial({
            color: COLORS.zinc,
            roughness: 0.4,
            metalness: 0.7,
        });
        this.znElectrode = new THREE.Mesh(znGeom, znMat);
        this.znElectrode.position.set(-halfSpacing, electrodeHeight / 2 - 0.3, 0);
        this.addToScene(this.znElectrode);

        // Cu electrode (right)
        const cuGeom = new THREE.BoxGeometry(electrodeWidth, electrodeHeight, 0.8);
        const cuMat = new THREE.MeshStandardMaterial({
            color: COLORS.copper,
            roughness: 0.4,
            metalness: 0.7,
        });
        this.cuElectrode = new THREE.Mesh(cuGeom, cuMat);
        this.cuElectrode.position.set(halfSpacing, electrodeHeight / 2 - 0.3, 0);
        this.addToScene(this.cuElectrode);
    }

    private createWire(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = (spacing / 10) * 0.8;

        // Wire path: left electrode top -> up -> across -> down -> right electrode top
        const wireHeight = 4.5;
        const points = [
            new THREE.Vector3(-halfSpacing, 3.0, 0),
            new THREE.Vector3(-halfSpacing, wireHeight, 0),
            new THREE.Vector3(-halfSpacing - 0.5, wireHeight + 0.3, 0), // Bend to device
            new THREE.Vector3(-halfSpacing - 1.5, wireHeight + 0.3, 0), // Device location
            new THREE.Vector3(-halfSpacing - 2.5, wireHeight + 0.3, 0), // Past device
            new THREE.Vector3(0, wireHeight, 0), // Center top
            new THREE.Vector3(halfSpacing + 2.5, wireHeight + 0.3, 0),
            new THREE.Vector3(halfSpacing + 1.5, wireHeight + 0.3, 0),
            new THREE.Vector3(halfSpacing + 0.5, wireHeight + 0.3, 0),
            new THREE.Vector3(halfSpacing, wireHeight, 0),
            new THREE.Vector3(halfSpacing, 3.0, 0),
        ];

        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
        const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.03, 8, false);
        const wireMaterial = new THREE.MeshStandardMaterial({
            color: COLORS.wire,
            roughness: 0.3,
            metalness: 0.8,
        });

        const wire = new THREE.Mesh(tubeGeometry, wireMaterial);
        this.addToScene(wire);
    }

    private createExternalDevice(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = (spacing / 10) * 0.8;
        const deviceX = -halfSpacing - 1.5;
        const deviceY = 4.8 + 0.3;

        // Device box
        const geometry = new THREE.BoxGeometry(0.8, 0.5, 0.4);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.5,
            metalness: 0.3,
        });

        this.deviceMesh = new THREE.Mesh(geometry, material);
        this.deviceMesh.position.set(deviceX, deviceY, 0);

        // Add mode indicator canvas as texture
        this.updateDeviceTexture();

        this.addToScene(this.deviceMesh);
    }

    /**
     * Update the device texture to show current mode (voltmeter or power supply)
     */
    private updateDeviceTexture(): void {
        if (!this.deviceMesh) return;

        const mode = this.getParameter('mode') as CellMode;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 256, 128);

        // Border
        ctx.strokeStyle = mode === 'galvanic' ? '#FACC15' : '#F97316';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 124);

        // Text
        ctx.fillStyle = '#f0f6fc';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (mode === 'galvanic') {
            ctx.fillText('V', 128, 50);
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Voltmeter', 128, 90);
        } else {
            ctx.fillText('DC', 128, 50);
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Power Supply', 128, 90);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // Dispose old texture
        const oldMaterial = this.deviceMesh.material as THREE.MeshStandardMaterial;
        const oldMap = oldMaterial.map;
        oldMaterial.map = texture;
        oldMaterial.needsUpdate = true;
        oldMap?.dispose();
    }

    /**
     * Create text sprite for labels
     */
    private createTextSprite(text: string, color: string, fontSize: number = 48): THREE.Sprite {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context not available');

        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.8, 0.4, 1);
        return sprite;
    }

    private createElectrodeLabels(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = (spacing / 10) * 0.8;

        // Element name labels
        this.znLabel = this.createTextSprite('Zn', '#94a3b8', 56);
        this.znLabel.position.set(-halfSpacing, 3.8, 0);
        this.addToScene(this.znLabel);

        this.cuLabel = this.createTextSprite('Cu', '#F97316', 56);
        this.cuLabel.position.set(halfSpacing, 3.8, 0);
        this.addToScene(this.cuLabel);

        // Polarity labels (updated on mode change)
        this.updatePolarityLabels();
    }

    /**
     * Update polarity labels based on current mode
     */
    private updatePolarityLabels(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = (spacing / 10) * 0.8;
        const mode = this.getParameter('mode') as CellMode;
        const reactions = getReactions(mode);

        // Remove old labels
        if (this.znPolarityLabel) {
            this.removeFromScene(this.znPolarityLabel);
            this.znPolarityLabel.material.map?.dispose();
            (this.znPolarityLabel.material as THREE.SpriteMaterial).dispose();
        }
        if (this.cuPolarityLabel) {
            this.removeFromScene(this.cuPolarityLabel);
            this.cuPolarityLabel.material.map?.dispose();
            (this.cuPolarityLabel.material as THREE.SpriteMaterial).dispose();
        }

        // Create new labels
        this.znPolarityLabel = this.createTextSprite(reactions.anodeLabel, '#F87171', 36);
        this.znPolarityLabel.position.set(-halfSpacing, -0.3, 0.6);
        this.addToScene(this.znPolarityLabel);

        this.cuPolarityLabel = this.createTextSprite(reactions.cathodeLabel, '#22D3EE', 36);
        this.cuPolarityLabel.position.set(halfSpacing, -0.3, 0.6);
        this.addToScene(this.cuPolarityLabel);
    }

    /**
     * Build wire path points for particle system (electrons on wire)
     */
    private getWireParticlePath(): THREE.Vector3[] {
        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = (spacing / 10) * 0.8;

        return [
            new THREE.Vector3(-halfSpacing, 2.5, 0),
            new THREE.Vector3(-halfSpacing, 4.5, 0),
            new THREE.Vector3(0, 5.1, 0),
            new THREE.Vector3(halfSpacing, 4.5, 0),
            new THREE.Vector3(halfSpacing, 2.5, 0),
        ];
    }

    /**
     * Build solution paths for ion particles
     */
    private getSolutionPaths(): { cation: THREE.Vector3[]; anion: THREE.Vector3[] } {
        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = (spacing / 10) * 0.8;

        return {
            cation: [
                new THREE.Vector3(-halfSpacing + 0.2, 0.5, 0),
                new THREE.Vector3(-halfSpacing + 0.2, 2.0, 0.3),
                new THREE.Vector3(0, 2.2, 0.2),
                new THREE.Vector3(halfSpacing - 0.2, 2.0, -0.2),
                new THREE.Vector3(halfSpacing - 0.2, 0.5, 0),
            ],
            anion: [
                new THREE.Vector3(halfSpacing - 0.2, 0.5, 0),
                new THREE.Vector3(halfSpacing - 0.2, 1.5, -0.3),
                new THREE.Vector3(0, 1.8, -0.2),
                new THREE.Vector3(-halfSpacing + 0.2, 1.5, 0.2),
                new THREE.Vector3(-halfSpacing + 0.2, 0.5, 0),
            ],
        };
    }

    private initParticleSystem(): void {
        if (!this.scene) return;

        this.particleSystem = new ParticleFlowSystem();
        this.particleSystem.init(
            this.scene,
            this.getWireParticlePath(),
            this.getSolutionPaths(),
        );

        // Set initial direction based on mode
        const mode = this.getParameter('mode') as CellMode;
        this.particleSystem.setDirection(mode === 'galvanic' ? 1 : -1);

        const showParticles = this.getParameter('showParticles') as boolean;
        this.particleSystem.setVisible(showParticles);
    }

    protected onParameterChange(key: string, value: number | string | boolean): void {
        if (key === 'mode') {
            const mode = value as CellMode;
            this.updateDeviceTexture();
            this.updatePolarityLabels();
            this.particleSystem?.setDirection(mode === 'galvanic' ? 1 : -1);
            this.elapsedTime = 0;
            this.znConcentration = 0.1;
        }

        if (key === 'showParticles') {
            this.particleSystem?.setVisible(value as boolean);
        }

        if (key === 'electrodeSpacing') {
            // Rebuild would be complex, just reset for now
            this.onReset();
        }

        if (['electrolyteConcentration', 'temperature', 'externalResistance', 'appliedVoltage'].includes(key)) {
            this.elapsedTime = 0;
            this.znConcentration = 0.1;
        }
    }

    protected onReset(): void {
        this.elapsedTime = 0;
        this.znConcentration = 0.1;

        // Rebuild particle system with updated paths
        this.particleSystem?.dispose();
        this.initParticleSystem();
    }

    update(deltaTime: number): void {
        if (!this.isRunning) return;

        this.elapsedTime += deltaTime;

        // Calculate physics
        const mode = this.getParameter('mode') as CellMode;
        const concentration = this.getSafeNumber('electrolyteConcentration', 1.0, 0.1, 2.0);
        const temperature = this.getSafeNumber('temperature', 25, 0, 100);
        const spacing = this.getSafeNumber('electrodeSpacing', 5, 2, 10);
        const externalR = this.getSafeNumber('externalResistance', 10, 1, 100);
        const appliedV = this.getSafeNumber('appliedVoltage', 3.0, 0, 12);

        const params: CalculationParams = {
            mode,
            concentration,
            temperature,
            electrodeSpacing: spacing,
            externalResistance: externalR,
            appliedVoltage: appliedV,
            elapsedTime: this.elapsedTime,
        };

        const data = calculateAllData(params);

        // Normalize current for particle speed (0 to 1 range)
        const maxExpectedCurrent = 0.5; // A
        const normalizedCurrent = Math.min(data.current / maxExpectedCurrent, 1.0);

        // Update particles
        this.particleSystem?.update(deltaTime, normalizedCurrent);
    }

    getDisplayData(): Record<string, DisplayValue> {
        const mode = this.getParameter('mode') as CellMode;
        const concentration = this.getSafeNumber('electrolyteConcentration', 1.0, 0.1, 2.0);
        const temperature = this.getSafeNumber('temperature', 25, 0, 100);
        const spacing = this.getSafeNumber('electrodeSpacing', 5, 2, 10);
        const externalR = this.getSafeNumber('externalResistance', 10, 1, 100);
        const appliedV = this.getSafeNumber('appliedVoltage', 3.0, 0, 12);

        const params: CalculationParams = {
            mode,
            concentration,
            temperature,
            electrodeSpacing: spacing,
            externalResistance: externalR,
            appliedVoltage: appliedV,
            elapsedTime: this.elapsedTime,
        };

        const data = calculateAllData(params);
        const reactions = getReactions(mode);

        return {
            mode: {
                label: 'Mode',
                value: mode === 'galvanic' ? 'Galvanic Cell' : 'Electrolytic Cell',
            },
            emf: {
                label: 'EMF',
                value: data.emf.toFixed(3),
                unit: 'V',
            },
            current: {
                label: 'Current',
                value: (data.current * 1000).toFixed(2),
                unit: 'mA',
            },
            znConc: {
                label: 'Zn\u00B2\u207A Conc.',
                value: data.znConcentration.toFixed(3),
                unit: 'mol/L',
            },
            cuDeposited: {
                label: 'Cu Deposited',
                value: data.cuDepositedMass.toFixed(2),
                unit: 'mg',
            },
            anodeReaction: {
                label: reactions.anodeProcess === 'oxidation' ? 'Anode (Oxidation)' : 'Cathode (Reduction)',
                value: reactions.anodeReaction,
            },
            cathodeReaction: {
                label: reactions.cathodeProcess === 'reduction' ? 'Cathode (Reduction)' : 'Anode (Oxidation)',
                value: reactions.cathodeReaction,
            },
            totalReaction: {
                label: 'Total',
                value: reactions.totalReaction,
            },
            elapsedTime: {
                label: 'Time',
                value: this.elapsedTime.toFixed(1),
                unit: 's',
            },
        };
    }

    /**
     * Dynamic control schema: hide irrelevant parameters based on mode
     */
    getControlSchema(): ControlSchema {
        const mode = this.getParameter('mode') as CellMode;
        const allParams = this.config.parameters;

        // Filter: show externalResistance only in galvanic, appliedVoltage only in electrolytic
        const filteredParams = allParams.filter((param) => {
            if (param.key === 'externalResistance' && mode !== 'galvanic') return false;
            if (param.key === 'appliedVoltage' && mode !== 'electrolytic') return false;
            return true;
        });

        const actions: ActionDefinition[] = [
            { key: 'resetElectrodes', label: 'Reset Electrodes', variant: 'secondary' },
        ];

        return {
            title: 'Controls',
            parameters: filteredParams,
            actions,
        };
    }

    getMonitorSchema(): MonitorSchema {
        return {
            title: 'Monitor',
            quantities: [
                { key: 'emf', label: 'EMF', unit: 'V', color: '#22d3ee' },
                { key: 'current', label: 'Current', unit: 'mA', color: '#f59e0b' },
                { key: 'znConc', label: 'Zn\u00B2\u207A', unit: 'mol/L', color: '#FFD166' },
                { key: 'cuDeposited', label: 'Cu Deposited', unit: 'mg', color: '#F97316' },
            ],
            defaultSelected: ['emf', 'current'],
            sampleIntervalMs: 100,
        };
    }

    triggerAction(key: string): void {
        if (key === 'resetElectrodes') {
            this.onReset();
        }
    }

    dispose(): void {
        this.particleSystem?.dispose();
        this.particleSystem = null;
        super.dispose();
    }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/experiments/electrochemistry/GalvanicCell.ts
git commit -m "feat(electrochemistry): add GalvanicCell experiment with 3D scene and particle system"
```

---

### Task 5: Create Module Index and Register Experiment

**Files:**
- Create: `src/experiments/electrochemistry/index.ts`
- Modify: `src/experiments/index.ts`

- [ ] **Step 1: Create module index file**

Create `src/experiments/electrochemistry/index.ts`:

```typescript
/**
 * Electrochemistry Experiments
 */
export { GalvanicCell } from './GalvanicCell';
export {
    calculateEMF,
    calculateCurrent,
    calculateMassDeposited,
    calculateAllData,
    getReactions,
    type CellMode,
    type CalculationParams,
    type ElectrochemistryData,
    type ElectrodeReactions,
} from './ElectrochemistryPhysics';
export { ParticleFlowSystem } from './ParticleFlowSystem';
```

- [ ] **Step 2: Register the experiment in the central index**

Add to `src/experiments/index.ts`:

Add import after line 15 (`import { BoyleLaw } from './thermodynamics/boyle-law';`):
```typescript
import { GalvanicCell } from './electrochemistry';
```

Add registration after line 30 (`ExperimentRegistry.register('boyle-law', BoyleLaw);`):
```typescript
ExperimentRegistry.register('galvanic-cell', GalvanicCell);
```

Add export after line 45 (`export { BoyleLaw } from './thermodynamics/boyle-law';`):
```typescript
export { GalvanicCell } from './electrochemistry';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/experiments/electrochemistry/index.ts src/experiments/index.ts
git commit -m "feat(electrochemistry): register GalvanicCell experiment in registry"
```

---

### Task 6: Add Home Page Card with SVG Diagram

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Add the SVG diagram component**

In `src/pages/Home.tsx`, add the following component after the `MomentumCartsDiagram` component (after line 389):

```tsx
const ElectrochemicalCellDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-78">
            {/* Beaker outline */}
            <path d="M 60 40 L 60 110 Q 60 118 68 118 L 172 118 Q 180 118 180 110 L 180 40" fill="none" stroke="#475569" strokeWidth="2" />
            <line x1="56" y1="40" x2="184" y2="40" stroke="#475569" strokeWidth="2" />
            {/* Solution */}
            <rect x="62" y="58" width="116" height="58" rx="2" fill="#38BDF8" opacity="0.15" />
            {/* Zn electrode (left) */}
            <rect x="78" y="24" width="8" height="74" rx="1" fill="#94A3B8" />
            {/* Cu electrode (right) */}
            <rect x="154" y="24" width="8" height="74" rx="1" fill="#F97316" />
            {/* Wire */}
            <path d="M 82 24 L 82 16 L 46 16 L 46 10" stroke="#FACC15" strokeWidth="2" fill="none" />
            <path d="M 158 24 L 158 16 L 194 16 L 194 10" stroke="#FACC15" strokeWidth="2" fill="none" />
            <line x1="46" y1="10" x2="194" y2="10" stroke="#FACC15" strokeWidth="2" />
            {/* Voltmeter */}
            <circle cx="120" cy="10" r="8" fill="#1E293B" stroke="#FACC15" strokeWidth="1.5" />
            <text x="120" y="13" textAnchor="middle" fill="#F0F6FC" fontSize="10" fontWeight="bold">V</text>
            {/* Electrons on wire */}
            <circle cx="90" cy="10" r="2.5" fill="#00FF41">
                <animate attributeName="cx" values="60;180;60" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="140" cy="10" r="2.5" fill="#00FF41">
                <animate attributeName="cx" values="180;60;180" dur="2.5s" repeatCount="indefinite" />
            </circle>
            {/* Cations in solution */}
            <circle cx="95" cy="80" r="3" fill="#FFD166">
                <animate attributeName="cx" values="90;146;90" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="130" cy="90" r="3" fill="#FFD166">
                <animate attributeName="cx" values="140;96;140" dur="3.5s" repeatCount="indefinite" />
            </circle>
            {/* Anions in solution */}
            <circle cx="140" cy="75" r="2.5" fill="#38BDF8">
                <animate attributeName="cx" values="146;90;146" dur="2.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="100" r="2.5" fill="#38BDF8">
                <animate attributeName="cx" values="96;140;96" dur="3.2s" repeatCount="indefinite" />
            </circle>
            {/* Labels */}
            <text x="72" y="22" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="bold">Zn</text>
            <text x="168" y="22" textAnchor="middle" fill="#F97316" fontSize="9" fontWeight="bold">Cu</text>
        </svg>
    </div>
);
```

- [ ] **Step 2: Add the experiment card to the experiments array**

In `src/pages/Home.tsx`, add to the `experiments` array (after the `momentum-carts` entry, before the closing `];`):

```typescript
    {
        id: 'galvanic-cell',
        title: 'Electrochemical Cell',
        diagram: <ElectrochemicalCellDiagram />,
        gradient: 'from-amber-900/20 via-yellow-900/10 to-orange-900/20',
    },
```

- [ ] **Step 3: Verify the app compiles and renders**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat(home): add Electrochemical Cell experiment card with SVG diagram"
```

---

### Task 7: Verify and Polish

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no warnings

- [ ] **Step 3: Start dev server and visually verify**

Run: `npm run dev`

Open browser to `http://localhost:5173` and verify:
1. The Electrochemical Cell card appears on the home page with SVG animation
2. Clicking the card navigates to `/experiment/galvanic-cell`
3. The 3D scene loads with beaker, electrodes, wire, and device
4. Control panel shows all parameters
5. Start button triggers particle animation
6. Switching mode to Electrolytic Cell changes device texture and particle direction
7. Monitor tab shows EMF, Current, Zn²⁺ concentration, Cu deposited

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix(electrochemistry): polish and fix issues from visual verification"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| Unified apparatus (galvanic + electrolytic) | Task 4 (mode parameter) |
| Single container, dual electrodes | Task 4 (createBeaker, createElectrodes) |
| Click device to switch mode | Task 4 (updateDeviceTexture on mode change) |
| Particle flow animation (electrons + ions) | Task 3 + Task 4 (ParticleFlowSystem) |
| Chemical equation display | Task 4 (getDisplayData) |
| Dopamine color palette | Task 3 + Task 4 (COLORS constants) |
| Nernst equation EMF calculation | Task 2 (calculateEMF) |
| Faraday's law mass calculation | Task 2 (calculateMassDeposited) |
| Dynamic control schema (conditional params) | Task 4 (getControlSchema) |
| Monitor panel with real-time data | Task 4 (getMonitorSchema) |
| Home page card with SVG | Task 6 |
| Registration in ExperimentRegistry | Task 5 |

### Placeholder Scan

No TBD, TODO, or placeholder patterns found.

### Type Consistency

- `CellMode` type used consistently across `ElectrochemistryPhysics.ts`, `GalvanicCell.ts`, and `ParticleFlowSystem.ts`
- `CalculationParams` interface matches between definition and usage
- All `ParameterDefinition` entries use correct types matching `IExperiment` interface
- `DisplayValue` fields match the interface from `IExperiment.ts`
