# 2D Experiment Rendering Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2D rendering pipeline (SVG + requestAnimationFrame) parallel to the existing Three.js 3D pipeline, enabling experiments to opt into 2D mode via `renderMode: '2d'` in metadata.

**Architecture:** Dual interface approach — `IExperiment2D` parallel to `IExperiment`. `ExperimentView` branches on `metadata.renderMode`. Animation loop lives in React component (`ExperimentCanvas2D`) not base class, to keep `simulationStore` as the single clock source via `tick(delta)`. `ExperimentWorkbench` is unchanged (receives only declarative data props).

**Tech Stack:** TypeScript, React 18, Zustand, SVG, requestAnimationFrame, ResizeObserver

**Testing strategy:** TypeScript compilation (`npx tsc --noEmit`) validates types and interfaces at each task. A minimal test experiment (Task 10) provides runtime validation. Browser manual check verifies rendering. Vitest is not installed in the project — the existing unit tests that reference it cannot run. E2E Playwright tests are deferred until a real 2D experiment is migrated.

**Spec:** `docs/superpowers/specs/2026-05-14-2d-experiment-rendering-design.md`

---

### Task 1: Add renderMode to ExperimentMetadata

Add `renderMode` field to the existing `ExperimentMetadata` interface. This is a backward-compatible change — the field is optional with a default of `'3d'`.

**Files:**
- Modify: `src/experiments/base/IExperiment.ts:7-16`

- [ ] **Step 1: Add renderMode field to ExperimentMetadata**

In `src/experiments/base/IExperiment.ts`, change the `ExperimentMetadata` interface from:

```typescript
export interface ExperimentMetadata {
    id: string;
    name: string;
    category: ExperimentCategory;
    description: string;
    difficulty: ExperimentDifficulty;
    duration: number; // 预计时长(分钟)
    keywords: string[];
    thumbnail: string;
}
```

to:

```typescript
export interface ExperimentMetadata {
    id: string;
    name: string;
    category: ExperimentCategory;
    description: string;
    difficulty: ExperimentDifficulty;
    duration: number; // 预计时长(分钟)
    keywords: string[];
    thumbnail: string;
    /** Render mode: '3d' (default, Three.js) or '2d' (SVG + Canvas) */
    renderMode?: '3d' | '2d';
}
```

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors (field is optional, all existing experiments unaffected)

- [ ] **Step 3: Commit**

```bash
git add src/experiments/base/IExperiment.ts
git commit -m "feat(2d-pipeline): add renderMode field to ExperimentMetadata"
```

---

### Task 2: Create IExperiment2D Interface

Create the 2D experiment interface, the `ExperimentInstance` union type, and the `isExperiment2D` type guard.

**Files:**
- Create: `src/experiments/base/IExperiment2D.ts`

- [ ] **Step 1: Create IExperiment2D.ts**

Create `src/experiments/base/IExperiment2D.ts`:

```typescript
import type {
    ExperimentMetadata,
    ExperimentConfig,
    ParameterDefinition,
    DisplayValue,
    ControlSchema,
    MonitorSchema,
} from './IExperiment';

/**
 * 2D experiment configuration — no camera, no 3D gravity vector.
 */
export interface ExperimentConfig2D {
    physics?: {
        timestep?: number;
        maxSubSteps?: number;
    };
    parameters: ParameterDefinition[];
}

/**
 * 2D experiment interface — parallel to IExperiment.
 * Key differences from IExperiment:
 * - init() receives HTMLDivElement instead of THREE.Scene
 * - config uses ExperimentConfig2D (no camera, no gravity vector)
 * - No onInteraction (DOM events handled by React)
 * - No dynamic object management methods (createObject, etc.)
 */
export interface IExperiment2D {
    readonly metadata: ExperimentMetadata;
    readonly config: ExperimentConfig2D;

    init(container: HTMLDivElement): Promise<void>;
    start(): void;
    pause(): void;
    resume(): void;
    reset(): void;
    dispose(): void;

    update(deltaTime: number): void;

    setParameter(key: string, value: number | string | boolean): void;
    getParameter(key: string): number | string | boolean;

    getDisplayData(): Record<string, DisplayValue>;

    getControlSchema?(): ControlSchema;
    getMonitorSchema?(): MonitorSchema;

    triggerAction?(key: string): void;

    /** Called when the container resizes. Subclasses can override to adapt layout. */
    onResize?(width: number, height: number): void;
}
```

- [ ] **Step 2: Add ExperimentInstance union type and type guard**

Append to the end of `src/experiments/base/IExperiment2D.ts`:

```typescript
import type { IExperiment } from './IExperiment';

/**
 * Union type for any experiment (3D or 2D).
 * Used by simulationStore and ExperimentRegistry to accept both types.
 */
export type ExperimentInstance = IExperiment | IExperiment2D;

/**
 * Type guard — narrows ExperimentInstance to IExperiment2D.
 */
export function isExperiment2D(exp: ExperimentInstance): exp is IExperiment2D {
    return exp.metadata.renderMode === '2d';
}
```

The `import type { IExperiment }` must be added at the top of the file alongside the existing imports. The full top of the file becomes:

```typescript
import type {
    ExperimentMetadata,
    ExperimentConfig,
    ParameterDefinition,
    DisplayValue,
    ControlSchema,
    MonitorSchema,
    IExperiment,
} from './IExperiment';
```

- [ ] **Step 3: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/experiments/base/IExperiment2D.ts
git commit -m "feat(2d-pipeline): add IExperiment2D interface and ExperimentInstance union type"
```

---

### Task 3: Create ExperimentBase2D Base Class

Create the abstract base class for 2D experiments. Mirrors `ExperimentBase` structure but without Three.js dependencies and without a built-in animation loop.

**Files:**
- Create: `src/experiments/base/ExperimentBase2D.ts`

- [ ] **Step 1: Create ExperimentBase2D.ts**

Create `src/experiments/base/ExperimentBase2D.ts`:

```typescript
import type {
    ExperimentMetadata,
    ExperimentConfig2D,
    ParameterDefinition,
    DisplayValue,
    ControlSchema,
    MonitorSchema,
} from './IExperiment2D';
import type { IExperiment2D } from './IExperiment2D';

/**
 * Abstract base class for 2D experiments.
 *
 * Key differences from ExperimentBase (3D):
 * - No THREE.Scene, no THREE.Object3D[], no Three.js disposal
 * - No built-in requestAnimationFrame loop — animation is driven by
 *   ExperimentCanvas2D calling store.tick(), which calls this.update()
 * - init() receives HTMLDivElement instead of THREE.Scene
 */
export abstract class ExperimentBase2D implements IExperiment2D {
    abstract readonly metadata: ExperimentMetadata;
    abstract readonly config: ExperimentConfig2D;

    protected container: HTMLDivElement | null = null;
    protected isRunning = false;
    protected parameters: Map<string, number | string | boolean> = new Map();

    /**
     * Subclass implements: build SVG/Canvas structure and attach to this.container.
     */
    protected abstract setupScene(): Promise<void>;

    /**
     * Initialize the experiment with a container element.
     */
    async init(container: HTMLDivElement): Promise<void> {
        this.container = container;
        this.initParameters();
        await this.setupScene();
    }

    /**
     * Load default values from config.parameters.
     * Same logic as ExperimentBase.initParameters() (ExperimentBase.ts:37-41).
     * Only depends on config.parameters, compatible with ExperimentConfig2D.
     */
    protected initParameters(): void {
        this.config.parameters.forEach((param: ParameterDefinition) => {
            this.parameters.set(param.key, param.defaultValue);
        });
    }

    start(): void {
        this.isRunning = true;
    }

    pause(): void {
        this.isRunning = false;
    }

    resume(): void {
        this.isRunning = true;
    }

    reset(): void {
        this.isRunning = false;
        this.initParameters();
    }

    dispose(): void {
        this.isRunning = false;
        this.container = null;
        this.parameters.clear();
    }

    abstract update(deltaTime: number): void;

    setParameter(key: string, value: number | string | boolean): void {
        const isDefinedParameter =
            this.parameters.has(key) ||
            this.config.parameters.some((p) => p.key === key);
        if (!isDefinedParameter) return;
        this.parameters.set(key, value);
    }

    getParameter(key: string): number | string | boolean {
        if (this.parameters.has(key)) {
            return this.parameters.get(key) as number | string | boolean;
        }
        const def = this.config.parameters.find((p) => p.key === key);
        if (def) return def.defaultValue;
        return 0;
    }

    /**
     * Safely read a numeric parameter, clamped to [min, max].
     */
    protected getSafeNumber(key: string, fallback: number, min: number, max: number): number {
        const value = this.getParameter(key);
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return fallback;
        }
        return Math.min(Math.max(value, min), max);
    }

    abstract getDisplayData(): Record<string, DisplayValue>;

    getControlSchema(): ControlSchema {
        return { title: 'Controls', parameters: this.config.parameters };
    }

    getMonitorSchema(): MonitorSchema {
        return {
            title: 'Monitor',
            quantities: [],
            defaultSelected: [],
            sampleIntervalMs: 100,
        };
    }

    triggerAction(_key: string): void {
        // Subclass overrides for action handling
    }
}
```

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/experiments/base/ExperimentBase2D.ts
git commit -m "feat(2d-pipeline): add ExperimentBase2D abstract base class"
```

---

### Task 4: Extend ExperimentRegistry for 2D

Add 2D experiment registration to `ExperimentRegistry`, widen `create()` return type, and add a `registerExperiment2D` decorator.

**Files:**
- Modify: `src/experiments/base/ExperimentRegistry.ts`

- [ ] **Step 1: Add 2D registration to ExperimentRegistry**

In `src/experiments/base/ExperimentRegistry.ts`, make the following changes:

1. Add import at the top (line 1 area):

```typescript
import type { IExperiment2D, ExperimentInstance } from './IExperiment2D';
```

2. Add a new type after `ExperimentConstructor` (line 4 area):

```typescript
type ExperimentConstructor = new () => IExperiment;
type Experiment2DConstructor = new () => IExperiment2D;
```

3. Add `experiments2D` map inside the class (after `private experiments = new Map...`):

```typescript
private experiments2D = new Map<string, Experiment2DConstructor>();
```

4. Add `register2D` method (after the existing `register` method, around line 21):

```typescript
/**
 * 注册 2D 实验
 */
register2D(id: string, experimentClass: Experiment2DConstructor): void {
    this.experiments2D.set(id, experimentClass);
    const instance = new experimentClass();
    this.metadataCache.set(id, instance.metadata);
}
```

5. Change `create` method return type and logic (line 47-53):

```typescript
/**
 * 创建实验实例 (支持 3D 和 2D)
 */
create(id: string): ExperimentInstance {
    const cls2D = this.experiments2D.get(id);
    if (cls2D) return new cls2D();

    const ExperimentClass = this.experiments.get(id);
    if (!ExperimentClass) {
        throw new Error(`Experiment "${id}" not registered`);
    }
    return new ExperimentClass();
}
```

6. Add `registerExperiment2D` decorator at the end of the file (after the existing `registerExperiment` decorator):

```typescript
/**
 * 注册装饰器 - 用于自动注册 2D 实验类
 * @example
 * @registerExperiment2D('hydrogen-abstract')
 * class HydrogenAbstract2D extends ExperimentBase2D { ... }
 */
export function registerExperiment2D(id: string) {
    return function <T extends Experiment2DConstructor>(target: T): T {
        ExperimentRegistry.register2D(id, target);
        return target;
    };
}
```

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/experiments/base/ExperimentRegistry.ts
git commit -m "feat(2d-pipeline): extend ExperimentRegistry with register2D and registerExperiment2D decorator"
```

---

### Task 5: Update Base Module Exports

Export the new 2D types from the base module barrel file.

**Files:**
- Modify: `src/experiments/base/index.ts`

- [ ] **Step 1: Add 2D exports**

Change `src/experiments/base/index.ts` from:

```typescript
export * from './IExperiment';
export * from './ExperimentBase';
export * from './ExperimentRegistry';
```

to:

```typescript
export * from './IExperiment';
export * from './IExperiment2D';
export * from './ExperimentBase';
export * from './ExperimentBase2D';
export * from './ExperimentRegistry';
```

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/experiments/base/index.ts
git commit -m "feat(2d-pipeline): export 2D types from base module"
```

---

### Task 6: Widen simulationStore Types

Change `simulationStore` to accept both `IExperiment` and `IExperiment2D` via the `ExperimentInstance` union type.

**Files:**
- Modify: `src/stores/simulationStore.ts`

- [ ] **Step 1: Update import and widen types**

In `src/stores/simulationStore.ts`, change line 2 from:

```typescript
import type { IExperiment } from '@/experiments/base';
```

to:

```typescript
import type { ExperimentInstance } from '@/experiments/base';
```

Then change lines 15 and 21 from:

```typescript
    currentExperiment: IExperiment | null;
    ...
    setExperiment: (experiment: IExperiment | null) => void;
```

to:

```typescript
    currentExperiment: ExperimentInstance | null;
    ...
    setExperiment: (experiment: ExperimentInstance | null) => void;
```

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors (store methods only call `update()`, `start()`, `pause()`, etc. — all shared signatures)

- [ ] **Step 3: Commit**

```bash
git add src/stores/simulationStore.ts
git commit -m "feat(2d-pipeline): widen simulationStore to accept ExperimentInstance"
```

---

### Task 7: Create ExperimentCanvas2D Component

Create the React component that manages the 2D experiment lifecycle: init, animation loop (calling `store.tick()`), resize handling, and cleanup.

**Files:**
- Create: `src/components/simulation/ExperimentCanvas2D.tsx`

- [ ] **Step 1: Create ExperimentCanvas2D.tsx**

Create `src/components/simulation/ExperimentCanvas2D.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import type { IExperiment2D } from '@/experiments/base';

interface ExperimentCanvas2DProps {
    experiment: IExperiment2D;
}

/**
 * 2D experiment rendering container.
 *
 * Responsibilities:
 * 1. Initialize experiment with the container div
 * 2. Run requestAnimationFrame loop that calls store.tick(delta)
 * 3. Notify experiment of container resize via onResize()
 * 4. Cleanup on unmount (dispose experiment, cancel rAF, disconnect observer)
 */
export function ExperimentCanvas2D({ experiment }: ExperimentCanvas2DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tick = useSimulationStore((s) => s.tick);

    // Initialize experiment
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        experiment.init(container);
        return () => {
            experiment.dispose();
        };
    }, [experiment]);

    // Animation loop — drives store.tick(), store calls experiment.update()
    useEffect(() => {
        let rafId: number;
        let lastTime = performance.now();

        const loop = () => {
            const now = performance.now();
            const delta = (now - lastTime) / 1000;
            lastTime = now;
            tick(delta);
            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [tick]);

    // Resize handling
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            experiment.onResize?.(width, height);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [experiment]);

    return (
        <div
            ref={containerRef}
            className="h-full w-full"
            style={{ background: '#0D1117' }}
        />
    );
}

export default ExperimentCanvas2D;
```

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/simulation/ExperimentCanvas2D.tsx
git commit -m "feat(2d-pipeline): add ExperimentCanvas2D component with animation loop and resize handling"
```

---

### Task 8: Branch ExperimentView by renderMode

Modify `ExperimentView.tsx` to render `ExperimentCanvas2D` for 2D experiments instead of `SceneContainer`. This is the integration point.

**Files:**
- Modify: `src/pages/ExperimentView.tsx`

- [ ] **Step 1: Add import and renderMode logic**

In `src/pages/ExperimentView.tsx`:

1. Add import for ExperimentCanvas2D and IExperiment2D (line 5 area, after ExperimentScene/SceneContainer import):

```typescript
import { ExperimentScene, SceneContainer } from '@/components/simulation';
import { ExperimentCanvas2D } from '@/components/simulation/ExperimentCanvas2D';
import type { IExperiment2D } from '@/experiments/base';
```

2. Add renderMode derivation. After the `if (error || !currentExperiment)` block (after line 229), before the `return` JSX, add:

```typescript
const renderMode = currentExperiment.metadata.renderMode ?? '3d';
```

3. Replace the `<main>` section (lines 274-300) with the renderMode-branching version. The current code is:

```tsx
<main className="relative flex-1 px-4 pb-4 pt-3">
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45 shadow-[0_18px_60px_rgba(2,12,27,0.5)]">
        <SceneContainer
            cameraPosition={currentExperiment.config.camera.position}
            cameraTarget={currentExperiment.config.camera.target}
            cameraFov={currentExperiment.config.camera.fov ?? 50}
            showGrid={false}
            showAxes={false}
            backgroundColor="#0D1117"
        >
            <ExperimentScene experiment={currentExperiment} />
        </SceneContainer>
    </div>

    <ExperimentWorkbench
        title={currentExperiment.metadata.name}
        controlSchema={controlSchema}
        monitorSchema={monitorSchema}
        parameterValues={parameterValues}
        onParameterChange={handleParameterChange}
        onAction={handleAction}
        displayData={displayData}
        monitorHistory={monitoringHistory}
        selectedMonitorIds={selectedMonitorIds}
        onSelectedMonitorIdsChange={setSelectedMonitorIds}
    />
</main>
```

Replace with:

```tsx
<main className="relative flex-1 px-4 pb-4 pt-3">
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45 shadow-[0_18px_60px_rgba(2,12,27,0.5)]">
        {renderMode === '2d' ? (
            <ExperimentCanvas2D experiment={currentExperiment as IExperiment2D} />
        ) : (
            <SceneContainer
                cameraPosition={(currentExperiment as IExperiment).config.camera.position}
                cameraTarget={(currentExperiment as IExperiment).config.camera.target}
                cameraFov={(currentExperiment as IExperiment).config.camera.fov ?? 50}
                showGrid={false}
                showAxes={false}
                backgroundColor="#0D1117"
            >
                <ExperimentScene experiment={currentExperiment as IExperiment} />
            </SceneContainer>
        )}
    </div>

    <ExperimentWorkbench
        title={currentExperiment.metadata.name}
        controlSchema={controlSchema}
        monitorSchema={monitorSchema}
        parameterValues={parameterValues}
        onParameterChange={handleParameterChange}
        onAction={handleAction}
        displayData={displayData}
        monitorHistory={monitoringHistory}
        selectedMonitorIds={selectedMonitorIds}
        onSelectedMonitorIdsChange={setSelectedMonitorIds}
    />
</main>
```

Note: Add `import type { IExperiment } from '@/experiments/base';` at the top of the file alongside the existing imports, and use `as IExperiment` for the type casts in the 3D branch. The store already widens to `ExperimentInstance`, but the 3D branch needs `IExperiment`-specific access to `config.camera`.

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/ExperimentView.tsx
git commit -m "feat(2d-pipeline): branch ExperimentView rendering by renderMode"
```

---

### Task 9: Add 2D CSS Design Tokens

Create CSS variables for 2D experiment styling, derived from the existing palette.

**Files:**
- Create: `src/styles/experiment-2d.css`

- [ ] **Step 1: Create experiment-2d.css**

Create `src/styles/experiment-2d.css`:

```css
/*
 * 2D Experiment Design Tokens
 *
 * Derived from existing palette (src/index.css: --color-primary, --color-secondary, etc.)
 * and the home page SVG animation style (src/pages/Home.tsx).
 * These tokens are scoped to 2D experiment canvases via the .exp-2d-container class.
 */

:root {
    /* 2D experiment palette — derived from existing global tokens */
    --exp-2d-primary: #6366f1;
    --exp-2d-secondary: #8b5cf6;
    --exp-2d-accent: #22d3ee;
    --exp-2d-positive: #34d399;
    --exp-2d-negative: #f87171;
    --exp-2d-particle: #fbbf24;

    /* Effects */
    --exp-2d-glow: 0 0 8px var(--exp-2d-primary);
    --exp-2d-glow-strong: 0 0 16px var(--exp-2d-primary), 0 0 32px rgba(99, 102, 241, 0.3);

    /* Stroke and fill defaults */
    --exp-2d-stroke: 1.5px;
    --exp-2d-stroke-color: rgba(148, 163, 184, 0.6);
    --exp-2d-fill: rgba(99, 102, 241, 0.1);
    --exp-2d-fill-active: rgba(99, 102, 241, 0.25);

    /* Background — matches ExperimentView's scene container */
    --exp-2d-bg: #0D1117;
    --exp-2d-surface: rgba(15, 23, 42, 0.45);

    /* Text */
    --exp-2d-text: rgba(226, 232, 240, 0.9);
    --exp-2d-text-dim: rgba(148, 163, 184, 0.6);
    --exp-2d-text-label: rgba(203, 213, 225, 0.8);
}
```

- [ ] **Step 2: Import CSS in main entry**

In `src/main.tsx` (or wherever global styles are imported), add the import. Check the existing imports first — if `src/index.css` is imported there, add the new CSS right after it:

```typescript
import '@/styles/experiment-2d.css';
```

If `main.tsx` does not import styles directly, find where `src/index.css` is imported and add the new import at the same location.

- [ ] **Step 3: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/styles/experiment-2d.css src/main.tsx
git commit -m "feat(2d-pipeline): add 2D experiment CSS design tokens"
```

---

### Task 10: Create Minimal Test 2D Experiment

Create a trivial 2D experiment (pulsing circle) to validate the entire pipeline end-to-end. This will be a temporary experiment for verification — it can be removed later or kept as a reference.

**Files:**
- Create: `src/experiments/test-circle-2d/CircleDemo2D.ts`
- Create: `src/experiments/test-circle-2d/index.ts`
- Modify: `src/experiments/index.ts`

- [ ] **Step 1: Create the CircleDemo2D experiment**

Create directory `src/experiments/test-circle-2d/` and file `CircleDemo2D.ts`:

```typescript
import type { IExperiment2D, ExperimentConfig2D } from '../base';
import { ExperimentBase2D } from '../base';
import { registerExperiment2D } from '../base';
import type { DisplayValue } from '../base';

const metadata = {
    id: 'circle-demo-2d',
    name: '2D Pipeline Test',
    category: 'atomic' as const,
    description: 'Minimal 2D experiment to validate the rendering pipeline.',
    difficulty: 'basic' as const,
    duration: 1,
    keywords: ['test', '2d'],
    thumbnail: '',
    renderMode: '2d' as const,
};

const config: ExperimentConfig2D = {
    parameters: [
        {
            key: 'radius',
            label: 'Radius',
            type: 'number' as const,
            defaultValue: 50,
            min: 10,
            max: 200,
            step: 1,
            unit: 'px',
        },
        {
            key: 'speed',
            label: 'Speed',
            type: 'number' as const,
            defaultValue: 2,
            min: 0.5,
            max: 10,
            step: 0.5,
            unit: 'Hz',
        },
    ],
};

@registerExperiment2D('circle-demo-2d')
export class CircleDemo2D extends ExperimentBase2D {
    readonly metadata = metadata;
    readonly config = config;

    private phase = 0;

    protected async setupScene(): Promise<void> {
        if (!this.container) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 400 400');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.display = 'block';

        // Background
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', '400');
        bg.setAttribute('height', '400');
        bg.setAttribute('fill', 'var(--exp-2d-bg)');
        svg.appendChild(bg);

        // Pulsing circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '200');
        circle.setAttribute('cy', '200');
        circle.setAttribute('fill', 'var(--exp-2d-primary)');
        circle.setAttribute('opacity', '0.6');
        circle.id = 'pulse-circle';
        svg.appendChild(circle);

        // Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '200');
        text.setAttribute('y', '380');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'var(--exp-2d-text)');
        text.setAttribute('font-size', '14');
        text.textContent = '2D Pipeline Active';
        svg.appendChild(text);

        this.container.appendChild(svg);
    }

    update(deltaTime: number): void {
        this.phase += deltaTime * this.getSafeNumber('speed', 2, 0.5, 10);
        const radius = this.getSafeNumber('radius', 50, 10, 200);
        const pulseRadius = radius + Math.sin(this.phase * Math.PI * 2) * radius * 0.3;

        const circle = this.container?.querySelector('#pulse-circle') as SVGCircleElement | null;
        if (circle) {
            circle.setAttribute('r', String(Math.max(1, pulseRadius)));
        }
    }

    getDisplayData(): Record<string, DisplayValue> {
        return {
            phase: { label: 'Phase', value: (this.phase % 1).toFixed(2), unit: 'cycles' },
            radius: { label: 'Radius', value: this.getParameter('radius') as number, unit: 'px' },
        };
    }

    onResize(_width: number, _height: number): void {
        // Could update viewBox to match container aspect ratio
    }
}
```

- [ ] **Step 2: Create barrel export**

Create `src/experiments/test-circle-2d/index.ts`:

```typescript
export { CircleDemo2D } from './CircleDemo2D';
```

- [ ] **Step 3: Register the test experiment**

In `src/experiments/index.ts`, add the import and registration. At the top, add:

```typescript
import { CircleDemo2D } from './test-circle-2d';
```

And add the registration call alongside the existing ones:

```typescript
ExperimentRegistry.register2D('circle-demo-2d', CircleDemo2D);
```

And add the export:

```typescript
export { CircleDemo2D } from './test-circle-2d';
```

- [ ] **Step 4: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/experiments/test-circle-2d/ src/experiments/index.ts
git commit -m "feat(2d-pipeline): add minimal CircleDemo2D test experiment for pipeline validation"
```

---

### Task 11: Full Pipeline Verification

Verify the entire 2D pipeline works: TypeScript compilation, zero impact on existing experiments, and browser rendering.

- [ ] **Step 1: TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Dev server check**

Run: `npm run dev -- --host`
Open: `http://localhost:5173/experiment/circle-demo-2d`
Expected:
- Page loads without errors
- Dark background with pulsing indigo circle in the center
- "2D Pipeline Active" text at bottom
- Control panel on the right shows "Radius" and "Speed" sliders
- Monitor panel shows "Phase" and "Radius" quantities
- Start/Pause/Reset buttons work
- Adjusting sliders changes the circle behavior

- [ ] **Step 3: Verify existing 3D experiments unaffected**

Open any existing experiment (e.g., `http://localhost:5173/experiment/pendulum`):
- Page loads and renders normally in 3D
- Control panel works as before
- No console errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(2d-pipeline): complete 2D rendering pipeline — verified with CircleDemo2D and zero impact on 14 existing 3D experiments"
```
