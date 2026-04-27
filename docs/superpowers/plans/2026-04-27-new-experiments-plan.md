# New Physics Experiments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 new virtual simulation experiments — Light Refraction, Boyle's Law, and Double-Slit Interference — covering optics and thermodynamics domains.

**Architecture:** Each experiment extends `ExperimentBase`, implements `setupScene()`, `update()`, `getDisplayData()`, `getControlSchema()`, and `getMonitorSchema()`. All experiments are registered in `src/experiments/index.ts` and get cards on the home page. Scene objects are managed via `addToScene()` / `removeFromScene()` for automatic cleanup.

**Tech Stack:** Three.js (imperative), React Three Fiber (scene container), TypeScript, recharts (monitoring), Zustand (state), Tailwind CSS

**Design Spec:** `docs/superpowers/specs/2026-04-27-new-experiments-design.md`

---

## File Structure Overview

### New files to create:

```
src/experiments/optics/light-refraction/
    LightRefraction.ts
    RefractionPhysics.ts
    shapes/MediumShapes.ts
    index.ts

src/experiments/thermodynamics/boyle-law/
    BoyleLaw.ts
    GasMolecules.ts
    index.ts

src/experiments/optics/double-slit-interference/
    DoubleSlitInterference.ts
    InterferencePhysics.ts
    WavelengthColor.ts
    index.ts

src/experiments/optics/index.ts
src/experiments/thermodynamics/index.ts
```

### Existing files to modify:

```
src/experiments/index.ts           — register 3 new experiments
src/pages/Home.tsx                  — add 3 new cards with SVG diagrams
```

---

## Task 1: Shared Infrastructure — Category Index Files

**Files:**
- Create: `src/experiments/optics/index.ts`
- Create: `src/experiments/thermodynamics/index.ts`

- [ ] **Step 1: Create optics index file**

```typescript
// src/experiments/optics/index.ts
export { LightRefraction } from './light-refraction';
export { DoubleSlitInterference } from './double-slit-interference';
```

- [ ] **Step 2: Create thermodynamics index file**

```typescript
// src/experiments/thermodynamics/index.ts
export { BoyleLaw } from './boyle-law';
```

- [ ] **Step 3: Commit**

```bash
git add src/experiments/optics/index.ts src/experiments/thermodynamics/index.ts
git commit -m "chore: add category index files for optics and thermodynamics"
```

---

## Task 2: Experiment 1 — Light Refraction Physics Engine

**Files:**
- Create: `src/experiments/optics/light-refraction/RefractionPhysics.ts`

- [ ] **Step 1: Create the refraction physics module**

This file contains pure functions for Snell's law calculations. No Three.js dependencies.

```typescript
// src/experiments/optics/light-refraction/RefractionPhysics.ts

/**
 * Refraction and reflection physics for light passing through medium interfaces.
 * Implements Snell's law, Fresnel equations, and total internal reflection detection.
 */

export interface MediumPreset {
  name: string;
  refractiveIndex: number;
}

export const MEDIA_PRESETS: MediumPreset[] = [
  { name: 'Air', refractiveIndex: 1.0003 },
  { name: 'Water', refractiveIndex: 1.333 },
  { name: 'Glass', refractiveIndex: 1.5 },
  { name: 'Diamond', refractiveIndex: 2.42 },
];

export type MediumShape = 'rectangle' | 'prism' | 'semicircle' | 'hemisphere';

export interface RaySegment {
  origin: [number, number, number];  // start point
  direction: [number, number, number]; // normalized direction
  length: number;
}

export interface RefractionResult {
  incidentRay: RaySegment;
  reflectedRay: RaySegment;
  refractedRay: RaySegment | null;   // null when total internal reflection occurs
  incidentAngleDeg: number;
  refractedAngleDeg: number | null;  // null when total internal reflection
  criticalAngleDeg: number | null;   // null when n1 <= n2
  isTotalReflection: boolean;
  reflectance: number; // 0..1
  transmittance: number; // 0..1
}

/**
 * Calculate critical angle for total internal reflection.
 * Returns null if n1 <= n2 (total internal reflection impossible).
 */
export function calculateCriticalAngle(n1: number, n2: number): number | null {
  if (n1 <= n2) return null;
  const sinC = n2 / n1;
  if (sinC > 1) return null;
  return (Math.asin(sinC) * 180) / Math.PI;
}

/**
 * Snell's law: n1 * sin(theta1) = n2 * sin(theta2)
 * Returns refracted angle in degrees, or null if total internal reflection.
 */
export function snellsLaw(
  incidentAngleDeg: number,
  n1: number,
  n2: number
): { refractedAngleDeg: number | null; isTotalReflection: boolean } {
  const theta1 = (incidentAngleDeg * Math.PI) / 180;
  const sinTheta2 = (n1 / n2) * Math.sin(theta1);

  if (Math.abs(sinTheta2) > 1) {
    return { refractedAngleDeg: null, isTotalReflection: true };
  }

  const theta2 = Math.asin(sinTheta2);
  return {
    refractedAngleDeg: (theta2 * 180) / Math.PI,
    isTotalReflection: false,
  };
}

/**
 * Fresnel equations for unpolarized light reflectance.
 * Rs = ((n1 cos θi - n2 cos θt) / (n1 cos θi + n2 cos θt))²
 * Rp = ((n2 cos θi - n1 cos θt) / (n2 cos θi + n1 cos θt))²
 * R = (Rs + Rp) / 2
 */
export function fresnelReflectance(
  incidentAngleDeg: number,
  n1: number,
  n2: number
): number {
  const theta1 = (incidentAngleDeg * Math.PI) / 180;
  const result = snellsLaw(incidentAngleDeg, n1, n2);

  if (result.isTotalReflection) return 1.0;

  const theta2 = (result.refractedAngleDeg! * Math.PI) / 180;
  const cos1 = Math.cos(theta1);
  const cos2 = Math.cos(theta2);

  const rs = Math.pow(
    (n1 * cos1 - n2 * cos2) / (n1 * cos1 + n2 * cos2),
    2
  );
  const rp = Math.pow(
    (n2 * cos1 - n1 * cos2) / (n2 * cos1 + n1 * cos2),
    2
  );

  return (rs + rp) / 2;
}

/**
 * Full refraction calculation for a ray hitting a flat interface.
 * The interface is horizontal (y=0 plane), with medium 1 above and medium 2 below.
 * Incident ray comes from above.
 */
export function calculateRefraction(
  incidentAngleDeg: number,
  n1: number,
  n2: number,
  hitPoint: [number, number, number] = [0, 0, 0],
  rayLength: number = 5
): RefractionResult {
  const theta1Rad = (incidentAngleDeg * Math.PI) / 180;
  const result = snellsLaw(incidentAngleDeg, n1, n2);
  const reflectance = fresnelReflectance(incidentAngleDeg, n1, n2);
  const criticalAngle = calculateCriticalAngle(n1, n2);

  // Incident ray: comes from upper-left, hits hitPoint
  const incidentOrigin: [number, number, number] = [
    hitPoint[0] - rayLength * Math.sin(theta1Rad),
    hitPoint[1] + rayLength * Math.cos(theta1Rad),
    hitPoint[2],
  ];
  const incidentDir: [number, number, number] = [
    Math.sin(theta1Rad),
    -Math.cos(theta1Rad),
    0,
  ];

  // Reflected ray: mirror of incident about normal (y-axis)
  const reflectedDir: [number, number, number] = [
    Math.sin(theta1Rad),
    Math.cos(theta1Rad),
    0,
  ];
  const reflectedRay: RaySegment = {
    origin: hitPoint,
    direction: reflectedDir,
    length: rayLength,
  };

  // Refracted ray
  let refractedRay: RaySegment | null = null;
  let refractedAngleDeg: number | null = null;

  if (!result.isTotalReflection) {
    const theta2Rad = (result.refractedAngleDeg! * Math.PI) / 180;
    refractedAngleDeg = result.refractedAngleDeg;
    refractedRay = {
      origin: hitPoint,
      direction: [
        Math.sin(theta2Rad),
        -Math.cos(theta2Rad),
        0,
      ],
      length: rayLength,
    };
  }

  return {
    incidentRay: {
      origin: incidentOrigin,
      direction: incidentDir,
      length: rayLength,
    },
    reflectedRay,
    refractedRay,
    incidentAngleDeg,
    refractedAngleDeg,
    criticalAngleDeg: criticalAngle,
    isTotalReflection: result.isTotalReflection,
    reflectance,
    transmittance: 1 - reflectance,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/experiments/optics/light-refraction/RefractionPhysics.ts
git commit -m "feat(light-refraction): add Snell's law physics engine with Fresnel equations"
```

---

## Task 3: Experiment 1 — Light Refraction Scene Shapes

**Files:**
- Create: `src/experiments/optics/light-refraction/shapes/MediumShapes.ts`

- [ ] **Step 1: Create medium shape generators**

Each function returns a THREE.Group containing the medium block geometry. All shapes are centered at origin, oriented so the top surface is the entry interface.

```typescript
// src/experiments/optics/light-refraction/shapes/MediumShapes.ts
import * as THREE from 'three';
import type { MediumShape } from '../RefractionPhysics';

/**
 * Creates a semi-transparent medium block for refraction visualization.
 * All shapes have their top surface at y=0 (the interface plane).
 */
export function createMediumShape(
  shape: MediumShape,
  refractiveIndex: number,
): THREE.Group {
  const group = new THREE.Group();

  // Material properties scale with refractive index for visual distinction
  const hue = 0.55 + (refractiveIndex - 1.0) * 0.1; // blue-ish, shifts with n
  const color = new THREE.Color().setHSL(hue % 1, 0.3, 0.6);
  const opacity = 0.25 + (refractiveIndex - 1.0) * 0.08;

  const material = new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity: Math.min(opacity, 0.55),
    roughness: 0.05,
    metalness: 0.0,
    transmission: 0.8,
    thickness: 2.0,
    side: THREE.DoubleSide,
  });

  switch (shape) {
    case 'rectangle':
      group.add(createRectangularSlab(material));
      break;
    case 'prism':
      group.add(createTriangularPrism(material));
      break;
    case 'semicircle':
      group.add(createSemicircularCylinder(material));
      break;
    case 'hemisphere':
      group.add(createHemisphereShape(material));
      break;
  }

  return group;
}

function createRectangularSlab(material: THREE.Material): THREE.Mesh {
  const width = 6;
  const height = 3;
  const depth = 4;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  // Position so top surface is at y=0
  mesh.position.y = -height / 2;
  return mesh;
}

function createTriangularPrism(material: THREE.Material): THREE.Mesh {
  // Equilateral triangle cross-section, extruded along Z
  const shape = new THREE.Shape();
  const sideLength = 5;
  const h = (sideLength * Math.sqrt(3)) / 2;

  shape.moveTo(-sideLength / 2, 0);
  shape.lineTo(sideLength / 2, 0);
  shape.lineTo(0, -h);
  shape.closePath();

  const extrudeSettings = { depth: 4, bevelEnabled: false };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = -2; // center along Z
  return mesh;
}

function createSemicircularCylinder(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const radius = 3;
  const depth = 4;

  // Semicircular body
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.absarc(0, 0, radius, Math.PI, 0, false);
  shape.closePath();

  const extrudeSettings = { depth, bevelEnabled: false };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = -depth / 2;
  group.add(mesh);

  return group;
}

function createHemisphereShape(material: THREE.Material): THREE.Mesh {
  const radius = 3;
  const geometry = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/experiments/optics/light-refraction/shapes/MediumShapes.ts
git commit -m "feat(light-refraction): add 4 medium block shape generators (rectangle, prism, semicircle, hemisphere)"
```

---

## Task 4: Experiment 1 — Light Refraction Main Class

**Files:**
- Create: `src/experiments/optics/light-refraction/LightRefraction.ts`
- Create: `src/experiments/optics/light-refraction/index.ts`

- [ ] **Step 1: Create the LightRefraction experiment class**

This follows the Pendulum pattern: extend `ExperimentBase`, define `metadata`/`config`, implement `setupScene()`, `update()`, `getDisplayData()`, `getControlSchema()`, `getMonitorSchema()`.

```typescript
// src/experiments/optics/light-refraction/LightRefraction.ts
import * as THREE from 'three';
import {
  ExperimentBase,
  type ExperimentMetadata,
  type ExperimentConfig,
  type DisplayValue,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  calculateRefraction,
  MEDIA_PRESETS,
  type MediumShape,
} from './RefractionPhysics';
import { createMediumShape } from './shapes/MediumShapes';

export class LightRefraction extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'light-refraction',
    name: 'Light Refraction Lab',
    category: ExperimentCategory.Optics,
    description: 'Explore Snell\'s law, observe refraction and total internal reflection through different medium shapes',
    difficulty: 'basic',
    duration: 15,
    keywords: ['refraction', 'snell', 'reflection', 'total internal reflection', 'optics'],
    thumbnail: '/thumbnails/light-refraction.png',
  };

  readonly config: ExperimentConfig = {
    physics: { timestep: 1 / 60 },
    camera: {
      position: [0, 3, 10],
      target: [0, -1, 0],
      fov: 50,
    },
    parameters: [
      {
        key: 'incidentAngle',
        label: 'Incident Angle',
        type: 'number',
        defaultValue: 30,
        min: 0,
        max: 89,
        step: 1,
        unit: '°',
      },
      {
        key: 'upperMedium',
        label: 'Upper Medium',
        type: 'select',
        defaultValue: 'Air',
        options: MEDIA_PRESETS.map((m) => ({ value: m.name, label: `${m.name} (n=${m.refractiveIndex})` })),
      },
      {
        key: 'lowerMedium',
        label: 'Lower Medium',
        type: 'select',
        defaultValue: 'Glass',
        options: MEDIA_PRESETS.map((m) => ({ value: m.name, label: `${m.name} (n=${m.refractiveIndex})` })),
      },
      {
        key: 'shape',
        label: 'Medium Shape',
        type: 'select',
        defaultValue: 'rectangle',
        options: [
          { value: 'rectangle', label: 'Rectangular Slab' },
          { value: 'prism', label: 'Triangular Prism' },
          { value: 'semicircle', label: 'Semicircular Cylinder' },
          { value: 'hemisphere', label: 'Hemisphere' },
        ],
      },
    ],
  };

  // 3D object references
  private mediumGroup: THREE.Group | null = null;
  private incidentLine: THREE.Line | null = null;
  private reflectedLine: THREE.Line | null = null;
  private refractedLine: THREE.Line | null = null;
  private normalLine: THREE.Line | null = null;
  private angleArcs: THREE.Group | null = null;
  private totalReflectionLabel: THREE.Sprite | null = null;

  // Cached calculation result
  private lastResult: ReturnType<typeof calculateRefraction> | null = null;

  private createRayMaterial(color: number, opacity: number = 1.0): THREE.LineBasicMaterial {
    return new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: opacity < 1, opacity });
  }

  protected async setupScene(): Promise<void> {
    this.createLights();
    this.createGround();
    this.createNormalLine();
    this.createRays();
    this.createMedium();
    this.createAngleArcs();
    this.createTotalReflectionLabel();
    this.updateVisualization();
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.addToScene(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 5);
    this.addToScene(directional);
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -4;
    this.addToScene(ground);
  }

  private createNormalLine(): void {
    // Dashed vertical line at interface
    const material = new THREE.LineDashedMaterial({
      color: 0x888888,
      dashSize: 0.2,
      gapSize: 0.15,
    });
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -3, 0),
      new THREE.Vector3(0, 5, 0),
    ]);
    this.normalLine = new THREE.Line(geometry, material);
    this.normalLine.computeLineDistances();
    this.addToScene(this.normalLine);
  }

  private createRays(): void {
    // Incident ray (yellow)
    this.incidentLine = new THREE.Line(
      new THREE.BufferGeometry(),
      this.createRayMaterial(0xffd700),
    );
    this.addToScene(this.incidentLine);

    // Reflected ray (orange)
    this.reflectedLine = new THREE.Line(
      new THREE.BufferGeometry(),
      this.createRayMaterial(0xff8c00, 0.6),
    );
    this.addToScene(this.reflectedLine);

    // Refracted ray (cyan)
    this.refractedLine = new THREE.Line(
      new THREE.BufferGeometry(),
      this.createRayMaterial(0x00ffff),
    );
    this.addToScene(this.refractedLine);
  }

  private createMedium(): void {
    const shapeName = this.getParameter('shape') as string as MediumShape;
    const mediumName = this.getParameter('lowerMedium') as string;
    const preset = MEDIA_PRESETS.find((m) => m.name === mediumName) ?? MEDIA_PRESETS[2]; // default Glass
    this.mediumGroup = createMediumShape(shapeName, preset.refractiveIndex);
    this.addToScene(this.mediumGroup);
  }

  private createAngleArcs(): void {
    this.angleArcs = new THREE.Group();
    this.addToScene(this.angleArcs);
  }

  private createTotalReflectionLabel(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'center';
    ctx.fillText('Total Internal Reflection', 256, 72);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0 });
    this.totalReflectionLabel = new THREE.Sprite(spriteMaterial);
    this.totalReflectionLabel.position.set(0, 3.5, 0);
    this.totalReflectionLabel.scale.set(4, 1, 1);
    this.addToScene(this.totalReflectionLabel);
  }

  private getMediumIndex(paramKey: string): number {
    const name = this.getParameter(paramKey) as string;
    const preset = MEDIA_PRESETS.find((m) => m.name === name);
    return preset?.refractiveIndex ?? 1.0;
  }

  private updateVisualization(): void {
    const angle = this.getSafeNumber('incidentAngle', 30, 0, 89);
    const n1 = this.getMediumIndex('upperMedium');
    const n2 = this.getMediumIndex('lowerMedium');

    this.lastResult = calculateRefraction(angle, n1, n2, [0, 0, 0], 4.5);

    this.updateRayLine(this.incidentLine!, this.lastResult.incidentRay, 1.0);
    this.updateRayLine(this.reflectedLine!, this.lastResult.reflectedRay,
      this.lastResult.isTotalReflection ? 1.0 : 0.5);

    // Refracted ray
    if (this.lastResult.refractedRay) {
      this.updateRayLine(this.refractedLine!, this.lastResult.refractedRay, 1.0);
      this.refractedLine!.visible = true;
    } else {
      this.refractedLine!.visible = false;
    }

    // Total reflection label
    if (this.totalReflectionLabel) {
      (this.totalReflectionLabel.material as THREE.SpriteMaterial).opacity =
        this.lastResult.isTotalReflection ? 1.0 : 0.0;
    }

    this.updateAngleArcs(this.lastResult);
  }

  private updateRayLine(line: THREE.Line, ray: { origin: number[]; direction: number[]; length: number }, opacity: number): void {
    const start = new THREE.Vector3(...ray.origin);
    const end = start.clone().add(
      new THREE.Vector3(...ray.direction).multiplyScalar(ray.length)
    );
    line.geometry.setFromPoints([start, end]);
    line.geometry.attributes.position.needsUpdate = true;
    (line.material as THREE.LineBasicMaterial).opacity = opacity;
  }

  private updateAngleArcs(result: ReturnType<typeof calculateRefraction>): void {
    if (!this.angleArcs) return;

    // Clear previous arcs
    while (this.angleArcs.children.length > 0) {
      const child = this.angleArcs.children[0];
      this.angleArcs.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    const arcRadius = 1.2;

    // Incident angle arc (green)
    const incidentArc = this.createArc(arcRadius, Math.PI / 2, -result.incidentAngleDeg, 0x22c55e);
    if (incidentArc) this.angleArcs.add(incidentArc);

    // Refracted angle arc (cyan)
    if (result.refractedAngleDeg !== null) {
      const refractedArc = this.createArc(arcRadius, -Math.PI / 2, -Math.PI / 2 + result.refractedAngleDeg, 0x00ffff);
      if (refractedArc) this.angleArcs.add(refractedArc);
    }

    // Critical angle arc (red, dashed)
    if (result.criticalAngleDeg !== null) {
      const criticalArc = this.createArc(arcRadius * 0.8, -Math.PI / 2, -Math.PI / 2 - result.criticalAngleDeg, 0xff4444);
      if (criticalArc) this.angleArcs.add(criticalArc);
    }
  }

  private createArc(radius: number, startAngleRad: number, endAngleRad: number, color: number): THREE.Line | null {
    if (Math.abs(endAngleRad - startAngleRad) < 0.001) return null;

    const points: THREE.Vector3[] = [];
    const segments = 32;
    const dir = endAngleRad > startAngleRad ? 1 : -1;
    const angleDiff = Math.abs(endAngleRad - startAngleRad);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngleRad + dir * angleDiff * t;
      points.push(new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geometry, material);
  }

  protected onReset(): void {
    // Recreate medium when shape changes
    if (this.mediumGroup) {
      this.removeFromScene(this.mediumGroup);
      this.mediumGroup = null;
    }
    this.createMedium();
    this.updateVisualization();
  }

  protected onParameterChange(key: string, value: number | string | boolean): void {
    if (key === 'shape') {
      // Recreate medium geometry
      if (this.mediumGroup) {
        this.removeFromScene(this.mediumGroup);
        this.mediumGroup = null;
      }
      this.createMedium();
    }
    this.updateVisualization();
  }

  update(_deltaTime: number): void {
    // Static scene — no per-frame animation needed
    // update() is required by the interface but the visualization only
    // changes when parameters change
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.lastResult) {
      this.updateVisualization();
    }
    if (!this.lastResult) return {};

    const r = this.lastResult;
    return {
      incidentAngle: { label: 'Incident Angle', value: r.incidentAngleDeg.toFixed(1), unit: '°' },
      refractedAngle: {
        label: 'Refracted Angle',
        value: r.refractedAngleDeg !== null ? r.refractedAngleDeg.toFixed(1) : 'N/A',
        unit: '°',
      },
      criticalAngle: {
        label: 'Critical Angle',
        value: r.criticalAngleDeg !== null ? r.criticalAngleDeg.toFixed(1) : 'N/A',
        unit: '°',
      },
      n1: { label: 'n1 (Upper)', value: this.getMediumIndex('upperMedium').toFixed(3) },
      n2: { label: 'n2 (Lower)', value: this.getMediumIndex('lowerMedium').toFixed(3) },
      reflectance: { label: 'Reflectance', value: (r.reflectance * 100).toFixed(1), unit: '%' },
      transmittance: { label: 'Transmittance', value: (r.transmittance * 100).toFixed(1), unit: '%' },
    };
  }

  getControlSchema() {
    return {
      title: 'Controls',
      parameters: this.config.parameters,
    };
  }

  getMonitorSchema() {
    return {
      title: 'Monitor',
      quantities: [
        { key: 'incidentAngle', label: 'Incident Angle', unit: '°', color: '#22c55e' },
        { key: 'refractedAngle', label: 'Refracted Angle', unit: '°', color: '#00ffff' },
        { key: 'reflectance', label: 'Reflectance', unit: '%', color: '#f59e0b' },
      ],
      defaultSelected: ['incidentAngle', 'refractedAngle', 'reflectance'],
      sampleIntervalMs: 100,
    };
  }

  private getSafeNumber(key: string, fallback: number, min: number, max: number): number {
    const value = this.getParameter(key);
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(Math.max(value, min), max);
  }

  dispose(): void {
    this.lastResult = null;
    this.mediumGroup = null;
    this.incidentLine = null;
    this.reflectedLine = null;
    this.refractedLine = null;
    this.normalLine = null;
    this.angleArcs = null;
    this.totalReflectionLabel = null;
    super.dispose();
  }
}
```

- [ ] **Step 2: Create index.ts**

```typescript
// src/experiments/optics/light-refraction/index.ts
export { LightRefraction } from './LightRefraction';
```

- [ ] **Step 3: Commit**

```bash
git add src/experiments/optics/light-refraction/
git commit -m "feat(light-refraction): implement light refraction experiment with 4 medium shapes"
```

---

## Task 5: Experiment 2 — Boyle's Law Gas Molecules

**Files:**
- Create: `src/experiments/thermodynamics/boyle-law/GasMolecules.ts`

- [ ] **Step 1: Create the gas molecule particle system**

A particle system that visualizes gas molecules bouncing inside a cylinder. Molecules are rendered as small spheres using `THREE.InstancedMesh` for performance.

```typescript
// src/experiments/thermodynamics/boyle-law/GasMolecules.ts
import * as THREE from 'three';

interface MoleculeState {
  positions: Float32Array;
  velocities: Float32Array;
  count: number;
}

/**
 * Particle system for gas molecule visualization inside a cylinder.
 * Molecules bounce elastically off cylinder walls and piston.
 */
export class GasMolecules {
  private mesh: THREE.InstancedMesh;
  private state: MoleculeState;
  private cylinderRadius: number;
  private pistonY: number; // top boundary
  private bottomY: number; // bottom boundary
  private baseSpeed: number;

  constructor(
    moleculeCount: number,
    cylinderRadius: number,
    cylinderHeight: number,
    baseSpeed: number,
  ) {
    this.cylinderRadius = cylinderRadius;
    this.pistonY = cylinderHeight;
    this.bottomY = 0;
    this.baseSpeed = baseSpeed;

    // Initialize molecule positions and velocities
    this.state = {
      positions: new Float32Array(moleculeCount * 3),
      velocities: new Float32Array(moleculeCount * 3),
      count: moleculeCount,
    };

    for (let i = 0; i < moleculeCount; i++) {
      // Random position inside cylinder
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * cylinderRadius * 0.9;
      const y = Math.random() * cylinderHeight * 0.8 + cylinderHeight * 0.1;

      this.state.positions[i * 3] = Math.cos(angle) * r;
      this.state.positions[i * 3 + 1] = y;
      this.state.positions[i * 3 + 2] = Math.sin(angle) * r;

      // Random velocity direction
      const vAngle = Math.random() * Math.PI * 2;
      const vPhi = Math.random() * Math.PI - Math.PI / 2;
      const speed = baseSpeed * (0.5 + Math.random());
      this.state.velocities[i * 3] = Math.cos(vAngle) * Math.cos(vPhi) * speed;
      this.state.velocities[i * 3 + 1] = Math.sin(vPhi) * speed;
      this.state.velocities[i * 3 + 2] = Math.sin(vAngle) * Math.cos(vPhi) * speed;
    }

    // Create instanced mesh for rendering
    const geometry = new THREE.SphereGeometry(0.04, 6, 6);
    const material = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x1e3a5f,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.5,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, moleculeCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.updateInstances();
  }

  /**
   * Update piston position (top boundary).
   */
  setPistonY(y: number): void {
    this.pistonY = y;
    // Push molecules below piston
    for (let i = 0; i < this.state.count; i++) {
      const py = this.state.positions[i * 3 + 1];
      if (py > this.pistonY - 0.05) {
        this.state.positions[i * 3 + 1] = this.pistonY - 0.05;
        this.state.velocities[i * 3 + 1] *= -1;
      }
    }
  }

  /**
   * Set base speed (proportional to sqrt(temperature)).
   */
  setBaseSpeed(speed: number): void {
    const ratio = speed / Math.max(this.baseSpeed, 0.001);
    this.baseSpeed = speed;
    for (let i = 0; i < this.state.count; i++) {
      this.state.velocities[i * 3] *= ratio;
      this.state.velocities[i * 3 + 1] *= ratio;
      this.state.velocities[i * 3 + 2] *= ratio;
    }
  }

  /**
   * Step the simulation forward.
   */
  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.033); // Cap at ~30fps equivalent
    const positions = this.state.positions;
    const velocities = this.state.velocities;
    const count = this.state.count;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      // Update position
      positions[ix] += velocities[ix] * dt;
      positions[iy] += velocities[iy] * dt;
      positions[iz] += velocities[iz] * dt;

      const x = positions[ix];
      const y = positions[iy];
      const z = positions[iz];

      // Cylinder wall collision (circular boundary in XZ plane)
      const distFromCenter = Math.sqrt(x * x + z * z);
      if (distFromCenter > this.cylinderRadius * 0.95) {
        // Reflect velocity: normalize the radial component and reverse it
        const nx = x / distFromCenter;
        const nz = z / distFromCenter;
        const dot = velocities[ix] * nx + velocities[iz] * nz;
        velocities[ix] -= 2 * dot * nx;
        velocities[iz] -= 2 * dot * nz;
        // Push back inside
        const pushDist = this.cylinderRadius * 0.94;
        positions[ix] = nx * pushDist;
        positions[iz] = nz * pushDist;
      }

      // Bottom wall
      if (y < this.bottomY + 0.05) {
        positions[iy] = this.bottomY + 0.05;
        velocities[iy] = Math.abs(velocities[iy]);
      }

      // Piston (top wall)
      if (y > this.pistonY - 0.05) {
        positions[iy] = this.pistonY - 0.05;
        velocities[iy] = -Math.abs(velocities[iy]);
      }
    }

    this.updateInstances();
  }

  private updateInstances(): void {
    const matrix = new THREE.Matrix4();
    const positions = this.state.positions;

    for (let i = 0; i < this.state.count; i++) {
      matrix.setPosition(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      );
      this.mesh.setMatrixAt(i, matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Get the Three.js mesh to add to the scene.
   */
  getObject(): THREE.InstancedMesh {
    return this.mesh;
  }

  /**
   * Get the current cylinder boundaries.
   */
  getBounds(): { bottom: number; top: number; radius: number } {
    return {
      bottom: this.bottomY,
      top: this.pistonY,
      radius: this.cylinderRadius,
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/experiments/thermodynamics/boyle-law/GasMolecules.ts
git commit -m "feat(boyle-law): add instanced mesh gas molecule particle system"
```

---

## Task 6: Experiment 2 — Boyle's Law Main Class

**Files:**
- Create: `src/experiments/thermodynamics/boyle-law/BoyleLaw.ts`
- Create: `src/experiments/thermodynamics/boyle-law/index.ts`

- [ ] **Step 1: Create the BoyleLaw experiment class**

```typescript
// src/experiments/thermodynamics/boyle-law/BoyleLaw.ts
import * as THREE from 'three';
import {
  ExperimentBase,
  type ExperimentMetadata,
  type ExperimentConfig,
  type DisplayValue,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import { GasMolecules } from './GasMolecules';

const R_GAS = 8.314; // J/(mol·K)

export class BoyleLaw extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'boyle-law',
    name: 'Boyle\'s Law Lab',
    category: ExperimentCategory.Thermodynamics,
    description: 'Observe the inverse relationship between gas pressure and volume at constant temperature',
    difficulty: 'basic',
    duration: 15,
    keywords: ['boyle', 'ideal gas', 'pressure', 'volume', 'thermodynamics'],
    thumbnail: '/thumbnails/boyle-law.png',
  };

  readonly config: ExperimentConfig = {
    physics: { timestep: 1 / 60 },
    camera: {
      position: [4, 3, 6],
      target: [0, 2, 0],
      fov: 50,
    },
    parameters: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        defaultValue: 5.0,
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
        step: 10,
        unit: 'K',
      },
    ],
  };

  // Cylinder geometry constants
  private readonly cylinderRadius = 1.5;
  private readonly cylinderMaxHeight = 6;
  private readonly wallThickness = 0.1;
  private readonly pistonHeight = 0.3;

  // 3D objects
  private cylinderWall: THREE.Mesh | null = null;
  private pistonMesh: THREE.Mesh | null = null;
  private bottomMesh: THREE.Mesh | null = null;
  private gasMolecules: GasMolecules | null = null;

  // Derived state
  private currentPressure = 0;
  private currentPV = 0;

  protected async setupScene(): Promise<void> {
    this.createLights();
    this.createGround();
    this.createCylinder();
    this.createPiston();
    this.createGasMolecules();
    this.updateState();
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.addToScene(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 5);
    this.addToScene(directional);
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.addToScene(ground);
  }

  private createCylinder(): void {
    // Transparent cylinder wall
    const wallGeometry = new THREE.CylinderGeometry(
      this.cylinderRadius,
      this.cylinderRadius,
      this.cylinderMaxHeight,
      32,
      1,
      true, // open-ended
    );
    const wallMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.cylinderWall = new THREE.Mesh(wallGeometry, wallMaterial);
    this.cylinderWall.position.y = this.cylinderMaxHeight / 2;
    this.addToScene(this.cylinderWall);

    // Solid bottom
    const bottomGeometry = new THREE.CircleGeometry(this.cylinderRadius, 32);
    const bottomMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.5,
      metalness: 0.3,
    });
    this.bottomMesh = new THREE.Mesh(bottomGeometry, bottomMaterial);
    this.bottomMesh.rotation.x = -Math.PI / 2;
    this.bottomMesh.position.y = 0.01;
    this.addToScene(this.bottomMesh);
  }

  private createPiston(): void {
    const pistonGeometry = new THREE.CylinderGeometry(
      this.cylinderRadius - 0.05,
      this.cylinderRadius - 0.05,
      this.pistonHeight,
      32,
    );
    const pistonMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.3,
      metalness: 0.6,
    });
    this.pistonMesh = new THREE.Mesh(pistonGeometry, pistonMaterial);
    this.pistonMesh.castShadow = true;
    this.addToScene(this.pistonMesh);
  }

  private createGasMolecules(): void {
    const moleculeCount = 120;
    const temperature = this.getSafeNumber('temperature', 300, 200, 500);
    const speed = Math.sqrt(temperature) * 0.8; // Arbitrary visual scaling

    this.gasMolecules = new GasMolecules(
      moleculeCount,
      this.cylinderRadius * 0.85,
      this.volumeToHeight(this.getSafeNumber('volume', 5, 0.5, 10)),
      speed,
    );
    this.addToScene(this.gasMolecules.getObject());
  }

  /**
   * Convert volume (L) to piston height in scene units.
   * Maps 0.5L -> 0.6 units, 10L -> 5.7 units (leaving room for piston)
   */
  private volumeToHeight(volumeL: number): number {
    const minH = 0.6;
    const maxH = this.cylinderMaxHeight - 0.3;
    const fraction = (volumeL - 0.5) / (10 - 0.5); // 0..1
    return minH + fraction * (maxH - minH);
  }

  private updateState(): void {
    const volume = this.getSafeNumber('volume', 5, 0.5, 10);
    const amount = parseFloat(this.getParameter('amount') as string) || 1;
    const temperature = this.getSafeNumber('temperature', 300, 200, 500);

    // PV = nRT => P = nRT / V
    // Convert L to m³: 1 L = 0.001 m³
    const volumeM3 = volume * 0.001;
    this.currentPressure = (amount * R_GAS * temperature) / volumeM3;
    this.currentPV = this.currentPressure * volume;

    // Update piston position
    const pistonY = this.volumeToHeight(volume);
    if (this.pistonMesh) {
      this.pistonMesh.position.y = pistonY + this.pistonHeight / 2;
    }

    // Update gas molecules
    if (this.gasMolecules) {
      this.gasMolecules.setPistonY(pistonY);
      this.gasMolecules.setBaseSpeed(Math.sqrt(temperature) * 0.8);
    }
  }

  protected onReset(): void {
    this.updateState();
  }

  protected onParameterChange(key: string, _value: number | string | boolean): void {
    if (key === 'amount' || key === 'temperature' || key === 'volume') {
      this.updateState();
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning) return;
    if (this.gasMolecules) {
      this.gasMolecules.update(deltaTime);
    }
  }

  getDisplayData(): Record<string, DisplayValue> {
    const volume = this.getSafeNumber('volume', 5, 0.5, 10);
    const pressureAtm = this.currentPressure / 101325;

    return {
      pressure: {
        label: 'Pressure',
        value: this.currentPressure.toFixed(0),
        unit: 'Pa',
      },
      pressureAtm: {
        label: 'Pressure',
        value: pressureAtm.toFixed(2),
        unit: 'atm',
      },
      volume: {
        label: 'Volume',
        value: volume.toFixed(1),
        unit: 'L',
      },
      temperature: {
        label: 'Temperature',
        value: this.getSafeNumber('temperature', 300, 200, 500).toFixed(0),
        unit: 'K',
      },
      pvProduct: {
        label: 'PV Product',
        value: (this.currentPV / 1000).toFixed(2),
        unit: 'kPa·L',
      },
      avgMolecularSpeed: {
        label: 'Avg Molecular Speed',
        value: (Math.sqrt(this.getSafeNumber('temperature', 300, 200, 500)) * 15).toFixed(0),
        unit: 'm/s',
      },
    };
  }

  getControlSchema() {
    return {
      title: 'Controls',
      parameters: this.config.parameters,
    };
  }

  getMonitorSchema() {
    return {
      title: 'Monitor',
      quantities: [
        { key: 'pressure', label: 'Pressure', unit: 'Pa', color: '#f59e0b' },
        { key: 'volume', label: 'Volume', unit: 'L', color: '#60a5fa' },
        { key: 'pvProduct', label: 'PV Product', unit: 'kPa·L', color: '#34d399' },
      ],
      defaultSelected: ['pressure', 'pvProduct'],
      sampleIntervalMs: 100,
    };
  }

  private getSafeNumber(key: string, fallback: number, min: number, max: number): number {
    const value = this.getParameter(key);
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(Math.max(value, min), max);
  }

  dispose(): void {
    this.gasMolecules?.dispose();
    this.gasMolecules = null;
    this.cylinderWall = null;
    this.pistonMesh = null;
    this.bottomMesh = null;
    super.dispose();
  }
}
```

- [ ] **Step 2: Create index.ts**

```typescript
// src/experiments/thermodynamics/boyle-law/index.ts
export { BoyleLaw } from './BoyleLaw';
```

- [ ] **Step 3: Commit**

```bash
git add src/experiments/thermodynamics/boyle-law/
git commit -m "feat(boyle-law): implement Boyle's law experiment with gas molecule visualization"
```

---

## Task 7: Experiment 3 — Wavelength to Color Utility

**Files:**
- Create: `src/experiments/optics/double-slit-interference/WavelengthColor.ts`

- [ ] **Step 1: Create wavelength-to-color mapping**

Standard visible spectrum conversion (380nm violet → 780nm red).

```typescript
// src/experiments/optics/double-slit-interference/WavelengthColor.ts

/**
 * Convert visible light wavelength (nm) to RGB color.
 * Based on Dan Bruton's algorithm.
 * Input: 380..780 nm
 * Output: [r, g, b] each in 0..1
 */
export function wavelengthToRGB(wavelength: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;

  if (wavelength >= 380 && wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    b = 1.0;
  } else if (wavelength >= 440 && wavelength < 490) {
    g = (wavelength - 440) / (490 - 440);
    b = 1.0;
  } else if (wavelength >= 490 && wavelength < 510) {
    g = 1.0;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1.0;
  } else if (wavelength >= 580 && wavelength < 645) {
    r = 1.0;
    g = -(wavelength - 645) / (645 - 580);
  } else if (wavelength >= 645 && wavelength <= 780) {
    r = 1.0;
  }

  // Intensity adjustment at spectrum edges
  let factor = 0.0;
  if (wavelength >= 380 && wavelength < 420) {
    factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
  } else if (wavelength >= 420 && wavelength <= 700) {
    factor = 1.0;
  } else if (wavelength > 700 && wavelength <= 780) {
    factor = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
  }

  return [r * factor, g * factor, b * factor];
}

/**
 * Get a THREE.Color from wavelength in nm.
 */
export function wavelengthToColor(wavelength: number): THREE.Color {
  const [r, g, b] = wavelengthToRGB(wavelength);
  return new THREE.Color(r, g, b);
}

/**
 * Get the approximate color name for a wavelength.
 */
export function wavelengthToName(wavelength: number): string {
  if (wavelength < 450) return 'Violet';
  if (wavelength < 490) return 'Blue';
  if (wavelength < 510) return 'Cyan';
  if (wavelength < 565) return 'Green';
  if (wavelength < 590) return 'Yellow';
  if (wavelength < 625) return 'Orange';
  return 'Red';
}

// Need THREE import for wavelengthToColor
import * as THREE from 'three';
```

- [ ] **Step 2: Commit**

```bash
git add src/experiments/optics/double-slit-interference/WavelengthColor.ts
git commit -m "feat(double-slit): add wavelength-to-RGB color mapping utility"
```

---

## Task 8: Experiment 3 — Interference Physics

**Files:**
- Create: `src/experiments/optics/double-slit-interference/InterferencePhysics.ts`

- [ ] **Step 1: Create interference pattern calculation**

```typescript
// src/experiments/optics/double-slit-interference/InterferencePhysics.ts

/**
 * Double-slit interference pattern calculation.
 *
 * Physics:
 * - Path difference: δ = d·sin(θ)
 * - Two-slit interference: I ∝ cos²(π·d·sin(θ)/λ)
 * - Single-slit diffraction envelope: I ∝ sinc²(π·a·sin(θ)/λ)
 * - Combined: I = I₀ · cos²(π·d·sin(θ)/λ) · sinc²(π·a·sin(θ)/λ)
 */

export interface InterferenceParams {
  wavelength: number;   // nm
  slitSeparation: number; // mm (d)
  slitWidth: number;     // mm (a)
  screenDistance: number; // m (L)
}

export interface InterferenceResult {
  fringeSpacing: number; // mm (Δy = λL/d)
  centralBrightWidth: number; // mm
  maxVisibleOrder: number; // integer
}

/**
 * Calculate interference pattern metrics.
 */
export function calculateInterferenceMetrics(params: InterferenceParams): InterferenceResult {
  const { wavelength, slitSeparation, screenDistance, slitWidth } = params;

  // Fringe spacing: Δy = λL/d (convert units)
  const lambdaM = wavelength * 1e-9;
  const dM = slitSeparation * 1e-3;
  const aM = slitWidth * 1e-3;
  const fringeSpacing = (lambdaM * screenDistance / dM) * 1000; // mm

  // Central bright fringe width = 2·λL/a (first zero of single-slit diffraction)
  const centralBrightWidth = (2 * lambdaM * screenDistance / aM) * 1000; // mm

  // Max visible order: d·sin(θ) = kλ, max k where |sin(θ)| < 1
  const maxOrder = Math.floor(dM / lambdaM);

  return { fringeSpacing, centralBrightWidth, maxVisibleOrder: maxOrder };
}

/**
 * Calculate intensity at position y on the screen.
 * y is in mm, returns normalized intensity 0..1.
 */
export function intensityAtY(
  yMm: number,
  params: InterferenceParams,
): number {
  const { wavelength, slitSeparation, slitWidth, screenDistance } = params;

  const lambdaM = wavelength * 1e-9;
  const dM = slitSeparation * 1e-3;
  const aM = slitWidth * 1e-3;
  const yM = yMm * 1e-3;

  // sin(θ) ≈ y/L for small angles, but use exact formula
  const sinTheta = yM / Math.sqrt(yM * yM + screenDistance * screenDistance);

  // Double-slit interference factor: cos²(π·d·sin(θ)/λ)
  const alpha = Math.PI * dM * sinTheta / lambdaM;
  const interferenceFactor = Math.cos(alpha) ** 2;

  // Single-slit diffraction envelope: sinc²(π·a·sin(θ)/λ)
  const beta = Math.PI * aM * sinTheta / lambdaM;
  let diffractionFactor: number;
  if (Math.abs(beta) < 1e-10) {
    diffractionFactor = 1.0;
  } else {
    diffractionFactor = (Math.sin(beta) / beta) ** 2;
  }

  return interferenceFactor * diffractionFactor;
}

/**
 * Generate intensity array for the observation screen.
 * Returns array of { y, intensity } covering the visible range.
 */
export function generateIntensityProfile(
  params: InterferenceParams,
  numPoints: number = 500,
): Array<{ y: number; intensity: number }> {
  const metrics = calculateInterferenceMetrics(params);

  // Show range: at least 5 fringe spacings on each side
  const halfRange = Math.max(metrics.fringeSpacing * 6, metrics.centralBrightWidth * 1.5);
  const results: Array<{ y: number; intensity: number }> = [];

  for (let i = 0; i < numPoints; i++) {
    const y = -halfRange + (2 * halfRange * i) / (numPoints - 1);
    results.push({
      y: Math.round(y * 100) / 100,
      intensity: intensityAtY(y, params),
    });
  }

  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/experiments/optics/double-slit-interference/InterferencePhysics.ts
git commit -m "feat(double-slit): add interference pattern physics calculations"
```

---

## Task 9: Experiment 3 — Double-Slit Interference Main Class

**Files:**
- Create: `src/experiments/optics/double-slit-interference/DoubleSlitInterference.ts`
- Create: `src/experiments/optics/double-slit-interference/index.ts`

- [ ] **Step 1: Create the DoubleSlitInterference experiment class**

```typescript
// src/experiments/optics/double-slit-interference/DoubleSlitInterference.ts
import * as THREE from 'three';
import {
  ExperimentBase,
  type ExperimentMetadata,
  type ExperimentConfig,
  type DisplayValue,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  calculateInterferenceMetrics,
  generateIntensityProfile,
  type InterferenceParams,
} from './InterferencePhysics';
import { wavelengthToColor, wavelengthToName } from './WavelengthColor';

export class DoubleSlitInterference extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'double-slit-interference',
    name: 'Double-Slit Interference',
    category: ExperimentCategory.Optics,
    description: 'Observe wave interference patterns from two slits and explore how wavelength and slit parameters affect fringe spacing',
    difficulty: 'intermediate',
    duration: 20,
    keywords: ['interference', 'diffraction', 'double slit', 'wave', 'optics', 'fringe'],
    thumbnail: '/thumbnails/double-slit-interference.png',
  };

  readonly config: ExperimentConfig = {
    physics: { timestep: 1 / 60 },
    camera: {
      position: [0, 2, 12],
      target: [0, 0, 0],
      fov: 55,
    },
    parameters: [
      {
        key: 'wavelength',
        label: 'Wavelength',
        type: 'number',
        defaultValue: 550,
        min: 380,
        max: 780,
        step: 5,
        unit: 'nm',
      },
      {
        key: 'slitSeparation',
        label: 'Slit Separation',
        type: 'number',
        defaultValue: 0.5,
        min: 0.1,
        max: 2.0,
        step: 0.05,
        unit: 'mm',
      },
      {
        key: 'screenDistance',
        label: 'Screen Distance',
        type: 'number',
        defaultValue: 1.0,
        min: 0.5,
        max: 5.0,
        step: 0.1,
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

  // Scene layout (in scene units)
  private readonly sourceX = -4;
  private readonly barrierX = 0;
  private readonly screenX = 4;
  private readonly barrierHeight = 5;
  private readonly slitVisualGap = 0.3; // visual half-gap for each slit opening

  // 3D objects
  private lightSource: THREE.Mesh | null = null;
  private lightSourceGlow: THREE.PointLight | null = null;
  private barrierMesh: THREE.Mesh | null = null;
  private screenMesh: THREE.Mesh | null = null;
  private screenTexture: THREE.CanvasTexture | null = null;
  private wavefrontGroup: THREE.Group | null = null;

  private animTime = 0;

  protected async setupScene(): Promise<void> {
    this.createLights();
    this.createGround();
    this.createLightSource();
    this.createBarrier();
    this.createScreen();
    this.createWavefronts();
    this.updateVisualization();
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.addToScene(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.5);
    directional.position.set(2, 8, 4);
    this.addToScene(directional);
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 20),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3.5;
    this.addToScene(ground);
  }

  private createLightSource(): void {
    const wl = this.getSafeNumber('wavelength', 550, 380, 780);
    const color = wavelengthToColor(wl);

    // Glowing sphere
    const geometry = new THREE.SphereGeometry(0.15, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2,
    });
    this.lightSource = new THREE.Mesh(geometry, material);
    this.lightSource.position.set(this.sourceX, 0, 0);
    this.addToScene(this.lightSource);

    // Point light
    this.lightSourceGlow = new THREE.PointLight(color, 2, 8);
    this.lightSourceGlow.position.set(this.sourceX, 0, 0);
    this.addToScene(this.lightSourceGlow);
  }

  private createBarrier(): void {
    // Create barrier with two slits using a shape with holes
    const slitSep = this.getSafeNumber('slitSeparation', 0.5, 0.1, 2.0);
    const visualSlitSep = slitSep * 1.5; // scale for visibility
    const slitVisualWidth = 0.08;

    const shape = new THREE.Shape();
    // Full barrier rectangle
    shape.moveTo(-0.05, -this.barrierHeight / 2);
    shape.lineTo(0.05, -this.barrierHeight / 2);
    shape.lineTo(0.05, this.barrierHeight / 2);
    shape.lineTo(-0.05, this.barrierHeight / 2);
    shape.closePath();

    // Cut out slit 1 (upper)
    const hole1 = new THREE.Path();
    hole1.moveTo(-0.1, visualSlitSep / 2 - slitVisualWidth / 2);
    hole1.lineTo(0.1, visualSlitSep / 2 - slitVisualWidth / 2);
    hole1.lineTo(0.1, visualSlitSep / 2 + slitVisualWidth / 2);
    hole1.lineTo(-0.1, visualSlitSep / 2 + slitVisualWidth / 2);
    hole1.closePath();
    shape.holes.push(hole1);

    // Cut out slit 2 (lower)
    const hole2 = new THREE.Path();
    hole2.moveTo(-0.1, -visualSlitSep / 2 - slitVisualWidth / 2);
    hole2.lineTo(0.1, -visualSlitSep / 2 - slitVisualWidth / 2);
    hole2.lineTo(0.1, -visualSlitSep / 2 + slitVisualWidth / 2);
    hole2.lineTo(-0.1, -visualSlitSep / 2 + slitVisualWidth / 2);
    hole2.closePath();
    shape.holes.push(hole2);

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.5,
      metalness: 0.3,
    });

    this.barrierMesh = new THREE.Mesh(geometry, material);
    this.barrierMesh.position.set(this.barrierX, 0, -0.05);
    this.addToScene(this.barrierMesh);
  }

  private createScreen(): void {
    const screenWidth = 6;
    const screenHeight = this.barrierHeight;

    // Create canvas texture for interference pattern
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    this.screenTexture = new THREE.CanvasTexture(canvas);
    this.screenTexture.minFilter = THREE.LinearFilter;

    const geometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const material = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      side: THREE.DoubleSide,
    });

    this.screenMesh = new THREE.Mesh(geometry, material);
    this.screenMesh.position.set(this.screenX, 0, 0);
    this.addToScene(this.screenMesh);
  }

  private createWavefronts(): void {
    this.wavefrontGroup = new THREE.Group();
    this.addToScene(this.wavefrontGroup);
  }

  private getInterferenceParams(): InterferenceParams {
    return {
      wavelength: this.getSafeNumber('wavelength', 550, 380, 780),
      slitSeparation: this.getSafeNumber('slitSeparation', 0.5, 0.1, 2.0),
      slitWidth: this.getSafeNumber('slitWidth', 0.1, 0.01, 0.5),
      screenDistance: this.getSafeNumber('screenDistance', 1.0, 0.5, 5.0),
    };
  }

  private updateVisualization(): void {
    this.updateLightSourceColor();
    this.updateBarrier();
    this.updateScreenPattern();
    this.updateWavefronts();
  }

  private updateLightSourceColor(): void {
    const wl = this.getSafeNumber('wavelength', 550, 380, 780);
    const color = wavelengthToColor(wl);

    if (this.lightSource) {
      (this.lightSource.material as THREE.MeshStandardMaterial).color.copy(color);
      (this.lightSource.material as THREE.MeshStandardMaterial).emissive.copy(color);
    }
    if (this.lightSourceGlow) {
      this.lightSourceGlow.color.copy(color);
    }
  }

  private updateBarrier(): void {
    // Rebuild barrier when slit separation changes
    if (this.barrierMesh) {
      this.removeFromScene(this.barrierMesh);
      this.barrierMesh.geometry.dispose();
      (this.barrierMesh.material as THREE.Material).dispose();
      this.barrierMesh = null;
    }
    this.createBarrier();
  }

  private updateScreenPattern(): void {
    if (!this.screenTexture || !this.screenMesh) return;

    const params = this.getInterferenceParams();
    const profile = generateIntensityProfile(params, 256);
    const wl = params.wavelength;
    const [baseR, baseG, baseB] = this.wavelengthToRGBArray(wl);

    const canvas = this.screenTexture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw fringe pattern (vertical stripes)
    for (let i = 0; i < profile.length; i++) {
      const intensity = profile[i].intensity;
      const r = Math.round(baseR * intensity * 255);
      const g = Math.round(baseG * intensity * 255);
      const b = Math.round(baseB * intensity * 255);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      // Each profile point maps to a horizontal stripe (y position on screen)
      const y = Math.round((i / (profile.length - 1)) * (canvas.height - 1));
      ctx.fillRect(0, y, canvas.width, 2);
    }

    this.screenTexture.needsUpdate = true;
  }

  private wavelengthToRGBArray(wavelength: number): [number, number, number] {
    let r = 0, g = 0, b = 0;
    if (wavelength >= 380 && wavelength < 440) { r = -(wavelength - 440) / 60; b = 1; }
    else if (wavelength >= 440 && wavelength < 490) { g = (wavelength - 440) / 50; b = 1; }
    else if (wavelength >= 490 && wavelength < 510) { g = 1; b = -(wavelength - 510) / 20; }
    else if (wavelength >= 510 && wavelength < 580) { r = (wavelength - 510) / 70; g = 1; }
    else if (wavelength >= 580 && wavelength < 645) { r = 1; g = -(wavelength - 645) / 65; }
    else if (wavelength >= 645 && wavelength <= 780) { r = 1; }

    let factor = 0;
    if (wavelength >= 380 && wavelength < 420) factor = 0.3 + 0.7 * (wavelength - 380) / 40;
    else if (wavelength >= 420 && wavelength <= 700) factor = 1;
    else if (wavelength > 700 && wavelength <= 780) factor = 0.3 + 0.7 * (780 - wavelength) / 80;

    return [r * factor, g * factor, b * factor];
  }

  private updateWavefronts(): void {
    if (!this.wavefrontGroup) return;

    // Clear old wavefronts
    while (this.wavefrontGroup.children.length > 0) {
      const child = this.wavefrontGroup.children[0];
      this.wavefrontGroup.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    const wl = this.getSafeNumber('wavelength', 550, 380, 780);
    const color = wavelengthToColor(wl);
    const slitSep = this.getSafeNumber('slitSeparation', 0.5, 0.1, 2.0);
    const visualSlitSep = slitSep * 1.5;

    // Draw expanding circular wavefronts from each slit
    const numWavefronts = 8;
    const maxRadius = 3.5;
    const waveSpeed = 2.0;

    for (let w = 0; w < numWavefronts; w++) {
      const phase = (this.animTime * waveSpeed + w * (maxRadius / numWavefronts)) % maxRadius;
      const opacity = 1 - phase / maxRadius;
      if (opacity <= 0) continue;

      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: opacity * 0.3,
      });

      // Upper slit wavefront
      const points1: THREE.Vector3[] = [];
      for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.1) {
        points1.push(new THREE.Vector3(
          this.barrierX + Math.cos(a) * phase,
          visualSlitSep / 2 + Math.sin(a) * phase,
          0,
        ));
      }
      const geo1 = new THREE.BufferGeometry().setFromPoints(points1);
      this.wavefrontGroup.add(new THREE.Line(geo1, material));

      // Lower slit wavefront
      const points2: THREE.Vector3[] = [];
      for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.1) {
        points2.push(new THREE.Vector3(
          this.barrierX + Math.cos(a) * phase,
          -visualSlitSep / 2 + Math.sin(a) * phase,
          0,
        ));
      }
      const geo2 = new THREE.BufferGeometry().setFromPoints(points2);
      this.wavefrontGroup.add(new THREE.Line(geo2, material));
    }
  }

  protected onReset(): void {
    this.animTime = 0;
    this.updateVisualization();
  }

  protected onParameterChange(key: string, _value: number | string | boolean): void {
    if (key === 'slitSeparation') {
      this.updateBarrier();
    }
    this.updateVisualization();
  }

  update(deltaTime: number): void {
    if (!this.isRunning) return;
    this.animTime += deltaTime;
    this.updateWavefronts();
  }

  getDisplayData(): Record<string, DisplayValue> {
    const params = this.getInterferenceParams();
    const metrics = calculateInterferenceMetrics(params);
    const wl = params.wavelength;

    return {
      wavelength: {
        label: 'Wavelength',
        value: `${wl} (${wavelengthToName(wl)})`,
        unit: 'nm',
      },
      fringeSpacing: {
        label: 'Fringe Spacing',
        value: metrics.fringeSpacing.toFixed(2),
        unit: 'mm',
      },
      centralBrightWidth: {
        label: 'Central Bright Width',
        value: metrics.centralBrightWidth.toFixed(2),
        unit: 'mm',
      },
      maxVisibleOrder: {
        label: 'Max Visible Order',
        value: `${metrics.maxVisibleOrder}`,
      },
      slitSeparation: {
        label: 'Slit Separation',
        value: params.slitSeparation.toFixed(2),
        unit: 'mm',
      },
      screenDistance: {
        label: 'Screen Distance',
        value: params.screenDistance.toFixed(1),
        unit: 'm',
      },
    };
  }

  getControlSchema() {
    return {
      title: 'Controls',
      parameters: this.config.parameters,
    };
  }

  getMonitorSchema() {
    return {
      title: 'Monitor',
      quantities: [
        { key: 'fringeSpacing', label: 'Fringe Spacing', unit: 'mm', color: '#f59e0b' },
        { key: 'centralBrightWidth', label: 'Central Bright Width', unit: 'mm', color: '#60a5fa' },
      ],
      defaultSelected: ['fringeSpacing'],
      sampleIntervalMs: 100,
    };
  }

  private getSafeNumber(key: string, fallback: number, min: number, max: number): number {
    const value = this.getParameter(key);
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(Math.max(value, min), max);
  }

  dispose(): void {
    this.screenTexture?.dispose();
    this.animTime = 0;
    this.lightSource = null;
    this.lightSourceGlow = null;
    this.barrierMesh = null;
    this.screenMesh = null;
    this.screenTexture = null;
    this.wavefrontGroup = null;
    super.dispose();
  }
}
```

- [ ] **Step 2: Create index.ts**

```typescript
// src/experiments/optics/double-slit-interference/index.ts
export { DoubleSlitInterference } from './DoubleSlitInterference';
```

- [ ] **Step 3: Commit**

```bash
git add src/experiments/optics/double-slit-interference/
git commit -m "feat(double-slit): implement double-slit interference experiment with wavefront animation"
```

---

## Task 10: Register Experiments & Add Home Page Cards

**Files:**
- Modify: `src/experiments/index.ts`
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Register the 3 new experiments**

Add these lines to `src/experiments/index.ts`:

```typescript
// New imports (add after existing imports)
import { LightRefraction } from './optics/light-refraction';
import { DoubleSlitInterference } from './optics/double-slit-interference';
import { BoyleLaw } from './thermodynamics/boyle-law';

// New registrations (add after existing registrations)
ExperimentRegistry.register('light-refraction', LightRefraction);
ExperimentRegistry.register('double-slit-interference', DoubleSlitInterference);
ExperimentRegistry.register('boyle-law', BoyleLaw);

// New exports (add after existing exports)
export { LightRefraction } from './optics/light-refraction';
export { DoubleSlitInterference } from './optics/double-slit-interference';
export { BoyleLaw } from './thermodynamics/boyle-law';
```

- [ ] **Step 2: Add SVG diagram components to Home.tsx**

Add these diagram components before the `experiments` array in `Home.tsx`:

```typescript
const LightRefractionDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="220" height="132" viewBox="0 0 220 132" className="overflow-visible opacity-78">
            <rect x="30" y="66" width="160" height="40" rx="2" fill="#1e40af" opacity="0.35" />
            <line x1="30" y1="66" x2="190" y2="66" stroke="#38bdf8" strokeWidth="1.5" opacity="0.5" />
            <line x1="50" y1="24" x2="110" y2="66" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="5 4">
                <animate attributeName="stroke-dashoffset" values="0;-18" dur="1.5s" repeatCount="indefinite" />
            </line>
            <line x1="110" y1="66" x2="145" y2="95" stroke="#22d3ee" strokeWidth="2" opacity="0.9">
                <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
            </line>
            <line x1="110" y1="66" x2="170" y2="30" stroke="#fb923c" strokeWidth="1.5" opacity="0.5" strokeDasharray="4 4" />
            <line x1="110" y1="40" x2="110" y2="100" stroke="#555" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="110" cy="66" r="3" fill="#fff" />
        </svg>
    </div>
);

const BoyleLawDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="220" height="132" viewBox="0 0 220 132" className="overflow-visible opacity-78">
            <rect x="70" y="28" width="60" height="76" rx="2" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.6" />
            <rect x="70" y="52" width="60" height="10" rx="1" fill="#94a3b8" opacity="0.8">
                <animate attributeName="y" values="40;65;40" dur="2.5s" repeatCount="indefinite" />
            </rect>
            {[{ cx: 90, cy: 75, delay: 0 }, { cx: 110, cy: 80, delay: 0.3 }, { cx: 100, cy: 85, delay: 0.6 }, { cx: 85, cy: 90, delay: 0.9 }, { cx: 115, cy: 70, delay: 1.2 }].map((p, i) => (
                <circle key={i} cx={p.cx} cy={p.cy} r="2.5" fill="#60a5fa" opacity="0.7">
                    <animate attributeName="cy" values={`${p.cy};${p.cy - 12};${p.cy}`} dur="1.5s" begin={`${p.delay}s`} repeatCount="indefinite" />
                </circle>
            ))}
            <line x1="70" y1="104" x2="130" y2="104" stroke="#38bdf8" strokeWidth="2" />
            <text x="110" y="22" textAnchor="middle" fill="#94a3b8" fontSize="10">PV = const</text>
        </svg>
    </div>
);

const DoubleSlitDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-78">
            <circle cx="30" cy="66" r="6" fill="#fbbf24" opacity="0.9">
                <animate attributeName="r" values="5;7;5" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <line x1="36" y1="66" x2="100" y2="66" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
            <rect x="100" y="20" width="4" height="38" fill="#64748b" />
            <rect x="100" y="74" width="4" height="38" fill="#64748b" />
            <rect x="100" y="20" width="4" height="18" fill="#64748b" />
            <rect x="100" y="94" width="4" height="18" fill="#64748b" />
            {[56, 76].map((y) => (
                <g key={y}>
                    {[1, 2, 3].map((r) => (
                        <circle key={r} cx={104 + r * 18} cy={y} r={r * 5} fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity={0.4 / r}>
                            <animate attributeName="r" values={`${r * 4};${r * 6};${r * 4}`} dur="2s" repeatCount="indefinite" />
                        </circle>
                    ))}
                </g>
            ))}
            <rect x="195" y="24" width="8" height="84" rx="1" fill="#111" stroke="#333" strokeWidth="1" />
            {[32, 42, 52, 62, 72, 82, 92, 102].map((y, i) => (
                <rect key={y} x="195" y={y} width="8" height="5" fill="#fbbf24" opacity={i % 2 === 0 ? 0.9 : 0.15} />
            ))}
        </svg>
    </div>
);
```

- [ ] **Step 3: Add experiment cards to the experiments array**

Add these 3 entries to the `experiments` array in `Home.tsx`:

```typescript
{
    id: 'boyle-law',
    title: "Boyle's Law",
    diagram: <BoyleLawDiagram />,
    gradient: 'from-amber-900/20 via-red-900/10 to-orange-900/20',
},
{
    id: 'light-refraction',
    title: 'Light Refraction',
    diagram: <LightRefractionDiagram />,
    gradient: 'from-cyan-900/20 via-blue-900/10 to-indigo-900/20',
},
{
    id: 'double-slit-interference',
    title: 'Double-Slit Interference',
    diagram: <DoubleSlitDiagram />,
    gradient: 'from-yellow-900/20 via-amber-900/10 to-red-900/20',
},
```

- [ ] **Step 4: Verify the dev server compiles**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/experiments/index.ts src/pages/Home.tsx
git commit -m "feat: register 3 new experiments and add home page cards"
```

---

## Task 11: Visual Verification

- [ ] **Step 1: Open each experiment in the browser**

Navigate to these URLs and verify:
1. `http://localhost:5173/experiment/boyle-law` — cylinder, piston, molecules animate
2. `http://localhost:5173/experiment/light-refraction` — medium block, light rays, angle arcs
3. `http://localhost:5173/experiment/double-slit-interference` — source, barrier, wavefronts, screen pattern

- [ ] **Step 2: Verify home page shows 13 cards total**

Navigate to `http://localhost:5173/` and confirm the 3 new cards appear with correct SVG diagrams and gradients.

- [ ] **Step 3: Test parameter controls for each experiment**

For each experiment:
- Verify slider controls appear in the Control tab
- Verify monitor quantities appear in the Monitor tab
- Verify changing parameters updates the visualization
- Verify Play/Pause/Reset buttons work

- [ ] **Step 4: Fix any visual or functional issues found**

Address bugs, TypeScript errors, or visual problems.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: visual verification fixes for new experiments"
```
