# Rutherford Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Rutherford α-Particle Scattering experiment's visual style with the home page's dopamine tech aesthetic — brighter backgrounds, softer colors, thicker trajectory lines, smoother particle source geometry.

**Architecture:** Three files modified independently: MacroExperimentView.tsx (device view), RutherfordExperiment.ts (micro view 3D objects + trajectory Line2 migration), and SceneContainer.tsx (shared background). The ScatteringPhysics.ts interface gets a minor addition (`scatterAngle` field) to support 3-tier trajectory coloring.

**Tech Stack:** React, Three.js 0.181, `three/examples/jsm/lines/Line2`, `three/examples/jsm/lines/LineMaterial`, `three/examples/jsm/lines/LineGeometry`, Tailwind CSS

---

### Task 1: Add `scatterAngle` field to AlphaParticle interface

**Files:**
- Modify: `src/experiments/atomic/rutherford-scattering/ScatteringPhysics.ts:7-14`
- Modify: `src/experiments/atomic/rutherford-scattering/ScatteringPhysics.ts:107-136`

- [ ] **Step 1: Add `scatterAngle: number` to the AlphaParticle interface**

In `ScatteringPhysics.ts:7-14`, add the field:

```typescript
export interface AlphaParticle {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    trajectory: THREE.Vector3[];
    isActive: boolean;
    hasLargeAngle: boolean; // 是否大角度散射(>90°)
    scatterAngle: number; // 偏转角(弧度), 0 = 未散射
}
```

- [ ] **Step 2: Refactor `checkLargeAngleScattering` to `computeScatterAngle` returning the angle**

In `ScatteringPhysics.ts:111-136`, replace the method:

```typescript
/**
 * 计算粒子偏转角（弧度）
 * 初始方向为+z方向，通过比较最终方向与初始方向的夹角
 */
static computeScatterAngle(particle: AlphaParticle): number {
    if (particle.trajectory.length < 5) return 0;

    const initialDir = new THREE.Vector3(0, 0, 1);

    const len = particle.trajectory.length;
    const finalDir = particle.trajectory[len - 1]
        .clone()
        .sub(particle.trajectory[Math.max(0, len - 5)])
        .normalize();

    const cosAngle = THREE.MathUtils.clamp(initialDir.dot(finalDir), -1, 1);
    return Math.acos(cosAngle);
}
```

- [ ] **Step 3: Update the caller to use new method name and set scatterAngle**

In `ScatteringPhysics.ts`, update the line that calls `checkLargeAngleScattering` (around line 107):

```typescript
particle.hasLargeAngle = this.checkLargeAngleScattering(particle);
```

Replace with:

```typescript
const angle = ScatteringPhysics.computeScatterAngle(particle);
particle.scatterAngle = angle;
particle.hasLargeAngle = angle > Math.PI / 2;
```

- [ ] **Step 4: Set `scatterAngle: 0` in `createParticle`**

In `ScatteringPhysics.ts:151-157`, update the return object to include `scatterAngle: 0`.

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/experiments/atomic/rutherford-scattering/ScatteringPhysics.ts
git commit -m "refactor(physics): add scatterAngle field to AlphaParticle for 3-tier trajectory coloring"
```

---

### Task 2: Migrate trajectory lines to Line2 in RutherfordExperiment

**Files:**
- Modify: `src/experiments/atomic/rutherford-scattering/RutherfordExperiment.ts:1-10,50,233-260`

- [ ] **Step 1: Add Line2 imports at top of RutherfordExperiment.ts**

Add after the existing imports (line 1-9):

```typescript
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
```

- [ ] **Step 2: Change the type of trajectoryLines map**

In `RutherfordExperiment.ts:50`, change:

```typescript
private trajectoryLines: Map<number, THREE.Line> = new Map();
```

To:

```typescript
private trajectoryLines: Map<number, Line2> = new Map();
```

- [ ] **Step 3: Rewrite `updateTrajectoryLine` to use Line2 with 3-tier colors**

Replace the entire `updateTrajectoryLine` method (lines 233-260) with:

```typescript
private updateTrajectoryLine(particle: AlphaParticle): void {
    if (particle.trajectory.length < 2) return;

    // 移除旧线
    const oldLine = this.trajectoryLines.get(particle.id);
    if (oldLine) {
        this.removeFromScene(oldLine);
        oldLine.geometry.dispose();
        (oldLine.material as LineMaterial).dispose();
    }

    const points = particle.trajectory;

    // 扁平化坐标数组 [x1,y1,z1, x2,y2,z2, ...]
    const positions: number[] = [];
    points.forEach((p) => {
        positions.push(p.x, p.y, p.z);
    });

    const geometry = new LineGeometry();
    geometry.setPositions(positions);

    // 3-tier coloring based on scatter angle
    let color = '#22D3EE'; // 默认: 青色 (直穿)
    if (!particle.isActive) {
        const angleDeg = (particle.scatterAngle * 180) / Math.PI;
        if (angleDeg >= 30) {
            color = '#F97316'; // 大角度: 橙色
        } else if (angleDeg >= 10) {
            color = '#34D399'; // 小角度: 翠绿
        }
        // angleDeg < 10 stays cyan (直穿)
    }

    const material = new LineMaterial({
        color: new THREE.Color(color).getHex(),
        linewidth: 2.5,
        transparent: true,
        opacity: particle.isActive ? 0.8 : 0.4,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    const line = new Line2(geometry, material);
    line.computeLineDistances();
    this.addToScene(line);
    this.trajectoryLines.set(particle.id, line);
}
```

- [ ] **Step 4: Update `cleanupOldParticles` to dispose Line2 resources**

In `cleanupOldParticles` (lines 262-281), update the disposal block for trajectory lines. Change:

```typescript
const line = this.trajectoryLines.get(p.id);
if (line) {
    this.removeFromScene(line);
    this.trajectoryLines.delete(p.id);
}
```

To:

```typescript
const line = this.trajectoryLines.get(p.id);
if (line) {
    this.removeFromScene(line);
    line.geometry.dispose();
    (line.material as LineMaterial).dispose();
    this.trajectoryLines.delete(p.id);
}
```

Do the same for the `clearAllParticles` method (lines 283-289).

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/experiments/atomic/rutherford-scattering/RutherfordExperiment.ts
git commit -m "feat(rutherford): migrate trajectory lines to Line2 with 3-tier color coding"
```

---

### Task 3: Update micro view colors and particle source geometry

**Files:**
- Modify: `src/experiments/atomic/rutherford-scattering/RutherfordExperiment.ts:70-154,176-215`

- [ ] **Step 1: Update electron cloud color and opacity**

In `createAtomModel` (lines 72-81), change:

```typescript
color: 0x4488ff,
```
and
```typescript
opacity: 0.08,
```

To:

```typescript
color: 0x22D3EE,
```
and
```typescript
opacity: 0.12,
```

- [ ] **Step 2: Update electron cloud boundary ring**

In `createAtomModel` (lines 85-89), change:

```typescript
color: 0x6699ff,
```
and
```typescript
opacity: 0.3,
```

To:

```typescript
color: 0x38BDF8,
```
and
```typescript
opacity: 0.35,
```

- [ ] **Step 3: Update particle source cone**

In `createParticleSource` (lines 139-154), change the cone segments from 8 to 32, and color from green to cyan:

```typescript
const geometry = new THREE.ConeGeometry(0.3, 0.8, 32);
const material = new THREE.MeshStandardMaterial({
    color: 0x22D3EE,
    emissive: 0x0891B2,
    emissiveIntensity: 0.5,
});
```

- [ ] **Step 4: Update alpha particle default color**

In `createParticleMesh` (lines 176-185), change:

```typescript
color: 0x00ff00,
```

To:

```typescript
color: 0x00FF41,
```

- [ ] **Step 5: Update particle distance-based color transitions**

In the `update` method (lines 210-215), change the color logic:

```typescript
// 根据距离原子核的远近改变颜色
const distToNucleus = particle.position.length();
if (distToNucleus < 1) {
    (mesh.material as THREE.MeshBasicMaterial).color.setHex(0xF59E0B);
} else if (distToNucleus < 2) {
    (mesh.material as THREE.MeshBasicMaterial).color.setHex(0x34D399);
}
```

- [ ] **Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/experiments/atomic/rutherford-scattering/RutherfordExperiment.ts
git commit -m "style(rutherford): update micro view colors to dopamine palette, smooth particle source geometry"
```

---

### Task 4: Update device view (MacroExperimentView) background, lighting, and colors

**Files:**
- Modify: `src/pages/MacroExperimentView.tsx:410-413,419-423,427-430`

- [ ] **Step 1: Update Canvas background gradient**

In line 410-413, change:

```typescript
background:
    'radial-gradient(circle at 16% 15%, rgba(56, 189, 248, 0.14), transparent 34%), linear-gradient(180deg, #030816 0%, #091328 46%, #111b33 100%)',
```

To:

```typescript
background:
    'radial-gradient(circle at 16% 15%, rgba(56, 189, 248, 0.18), transparent 34%), radial-gradient(circle at 84% 80%, rgba(0, 255, 65, 0.08), transparent 40%), linear-gradient(180deg, #0D1117 0%, #111827 46%, #1a2332 100%)',
```

- [ ] **Step 2: Update light intensities**

In lines 419-423, change:

```tsx
<ambientLight intensity={0.35} />
<hemisphereLight args={['#8be9ff', '#0b1021', 0.38]} />
<directionalLight position={[10, 10, 5]} intensity={0.95} castShadow />
<pointLight position={[8, 2, 0]} intensity={0.7} color="#fb923c" />
<pointLight position={[-7, 5, -4]} intensity={0.35} color="#38bdf8" />
```

To:

```tsx
<ambientLight intensity={0.5} />
<hemisphereLight args={['#8be9ff', '#0b1021', 0.55]} />
<directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
<pointLight position={[8, 2, 0]} intensity={0.5} color="#38BDF8" />
<pointLight position={[-7, 5, -4]} intensity={0.4} color="#00FF41" />
```

- [ ] **Step 3: Update ground color**

In line 429, change:

```tsx
<meshStandardMaterial color="#0f172a" />
```

To:

```tsx
<meshStandardMaterial color="#0D1117" />
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/MacroExperimentView.tsx
git commit -m "style(macro-view): brighten background, lighting, and ground color"
```

---

### Task 5: Update device view material colors

**Files:**
- Modify: `src/pages/MacroExperimentView.tsx:47-62,102-127,250-271`

- [ ] **Step 1: Update AlphaSource colors**

In lines 47-62, change:

```tsx
<meshStandardMaterial color="#1e3a8a" metalness={0.6} roughness={0.4} />
```
To:
```tsx
<meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
```

Change:
```tsx
<meshStandardMaterial color="#ff4500" emissive="#ff2200" emissiveIntensity={0.5} />
```
To:
```tsx
<meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={0.5} />
```

- [ ] **Step 2: Update DetectorScreen material color**

In lines 105-112, change:

```tsx
color="#3b82f6"
```
and
```tsx
opacity={0.7}
```

To:

```tsx
color="#22D3EE"
```
and
```tsx
opacity={0.8}
```

- [ ] **Step 3: Update hit mark colors**

In lines 118-122, change the color mapping from:

```tsx
color={
    mark.type === 'direct' ? '#ffdd00' :
        mark.type === 'small' ? '#ffaa00' : '#ff4400'
}
```

To:

```tsx
color={
    mark.type === 'direct' ? '#34D399' :
        mark.type === 'small' ? '#F59E0B' : '#F97316'
}
```

- [ ] **Step 4: Update legend colors to match**

In lines 469-481, change:

```tsx
<div className="h-3 w-3 rounded-full bg-yellow-400" />
```
To:
```tsx
<div className="h-3 w-3 rounded-full bg-emerald-400" />
```

```tsx
<div className="h-3 w-3 rounded-full bg-orange-400" />
```
stays the same (amber-400 was `#F59E0B`, orange-400 is `#F97316` — close enough for the small angle category; update to amber for exact match):

```tsx
<div className="h-3 w-3 rounded-full bg-amber-400" />
```

```tsx
<div className="h-3 w-3 rounded-full bg-red-500" />
```
stays the same for large angle (keep orange-500 for consistency):

```tsx
<div className="h-3 w-3 rounded-full bg-orange-500" />
```

- [ ] **Step 5: Update data panel label colors to match**

In lines 443, 447, 451, change:

```tsx
<span className="text-yellow-400">Direct Passage</span>
```
To:
```tsx
<span className="text-emerald-400">Direct Passage</span>
```

```tsx
<span className="text-orange-400">Small Angle Scatter</span>
```
To:
```tsx
<span className="text-amber-400">Small Angle Scatter</span>
```

```tsx
<span className="text-red-400">Large Angle Scatter</span>
```
To:
```tsx
<span className="text-orange-500">Large Angle Scatter</span>
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/MacroExperimentView.tsx
git commit -m "style(macro-view): update material colors to dopamine palette (source, detector, hit marks, legend)"
```

---

### Task 6: Update micro view Canvas background

**Files:**
- Modify: `src/pages/ExperimentView.tsx:281`

- [ ] **Step 1: Change backgroundColor prop for micro view**

In `ExperimentView.tsx:281`, change:

```tsx
backgroundColor="#030816"
```

To:

```tsx
backgroundColor="#0D1117"
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ExperimentView.tsx
git commit -m "style(micro-view): brighten canvas background to match home page"
```

---

### Task 7: Visual verification

- [ ] **Step 1: Start dev server and check device view**

Open `http://localhost:5173/experiment/rutherford-scattering` in browser.

Verify:
- Background is visibly brighter (not near-black)
- Two glow spots visible (blue top-left, green bottom-right)
- Source glow ball is sky-blue, not orange-red
- Detector screen is cyan, not blue
- Hit marks are emerald/amber/orange, not yellow/orange/red
- Legend and data panel colors match hit marks

- [ ] **Step 2: Check micro view**

Open `http://localhost:5173/experiment/rutherford-scattering/micro` in browser.

Verify:
- Particle source cone is smooth (no visible facets) and cyan
- Alpha particles are `#00FF41` green, turn emerald near nucleus
- Trajectory lines are visibly thick (~2.5px)
- Completed trajectories show 3 colors: cyan (direct), emerald (small angle), orange (large angle)
- Electron cloud is slightly brighter cyan
- Background matches home page darkness level

- [ ] **Step 3: Check console for errors**

Open browser DevTools console. Verify no WebGL errors, no missing texture warnings.

- [ ] **Step 4: Final commit if any hotfixes were needed**

```bash
git add -A
git commit -m "fix(rutherford): visual verification hotfixes"
```
