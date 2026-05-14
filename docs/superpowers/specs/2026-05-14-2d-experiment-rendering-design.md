# 2D Experiment Rendering Pipeline Design

## Background

The current experiment system (`IExperiment` + `ExperimentBase`) is deeply coupled with Three.js 3D rendering. All 14 existing experiments use Three.js exclusively. However, many physics experiments are inherently 2D (circuit diagrams, energy levels, wave interference top-down views) and benefit from SVG-based 2D rendering for clarity, performance, and visual consistency with the home page.

The home page already demonstrates high-quality SVG animations (gradient strokes, flowing dashes, glow effects) that are well-suited for experiment-level visualization. The `HydrogenAbstractView` page proves that interactive 2D simulation (SVG + requestAnimationFrame) works, but it bypasses the unified experiment interface entirely.

## Goals

1. Enable experiments to use 2D rendering (React state-driven SVG) alongside the existing 3D pipeline
2. Maintain visual consistency with the home page SVG animation style
3. Zero impact on existing 14 experiments
4. Share control panel, parameter system, and monitoring infrastructure between 2D and 3D experiments

## Decision: Dual Interface + Shared Infrastructure (Approach A)

**Chosen over**: unified renderer abstraction (too risky, requires refactoring all 14 experiments), separate pages (duplicated maintenance).

**Core idea**: Add `IExperiment2D` interface parallel to `IExperiment`. `ExperimentView` branches on `metadata.renderMode`. Control panel and parameter system remain shared.

## Current Architecture Summary

Before designing the 2D interface, here is the current 3D pipeline flow:

```
ExperimentView
  ├─ simulationStore.setExperiment(experiment: IExperiment)  // Zustand store
  ├─ <SceneContainer>                                         // R3F <Canvas>
  │    └─ <SimulationLoop>                                   // useFrame → store.tick(delta)
  │         └─ store.tick → experiment.update(delta)         // per-frame update
  │    └─ <ExperimentScene experiment={experiment} />        // calls experiment.init(scene)
  │         └─ experiment.init(THREE.Scene)
  └─ <ExperimentWorkbench>                                   // declarative data props only
```

Key observations:
- **`simulationStore`** (Zustand) owns the simulation state (`SimulationState.Idle/Running/Paused`) and drives `experiment.update(delta)` via `tick()`
- **`SimulationLoop`** (inside R3F `useFrame`) is the animation driver — it calls `store.tick(delta)` every frame
- **`ExperimentWorkbench`** receives only declarative data props (`ControlSchema`, `MonitorSchema`, `DisplayValue`, etc.) — no `IExperiment` type dependency
- **`ExperimentView`** directly accesses `experiment.config.camera.position` at line 276-279, which will cause TypeScript errors for 2D experiments

## Interface Design

### IExperiment2D

```typescript
interface IExperiment2D {
  readonly metadata: ExperimentMetadata;
  readonly config: ExperimentConfig2D;

  init(container: HTMLDivElement): Promise<void>;
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  dispose(): void;

  update(deltaTime: number): void;

  // Parameter control (same signatures as IExperiment)
  setParameter(key: string, value: number | string | boolean): void;
  getParameter(key: string): number | string | boolean;

  // Data output (same signature as IExperiment)
  getDisplayData(): Record<string, DisplayValue>;

  // Declarative UI schema (same as IExperiment optional methods)
  getControlSchema?(): ControlSchema;
  getMonitorSchema?(): MonitorSchema;

  // User-triggered actions (same as IExperiment)
  triggerAction?(key: string): void;
}
```

**Key differences from IExperiment** (current code at `src/experiments/base/IExperiment.ts:110-149`):

| Aspect | IExperiment (3D) | IExperiment2D |
|--------|-------------------|---------------|
| `init()` parameter | `THREE.Scene` | `HTMLDivElement` |
| `config` type | `ExperimentConfig` (has `camera`) | `ExperimentConfig2D` (no `camera`) |
| `onInteraction` | `InteractionEvent` (THREE.Vector3/Object3D) | Not included — DOM events handled by React |
| Dynamic object management | `createObject`, `removeObject`, `addRamp`, `removeRamp`, `getSimulationObjects` | Not included — not needed for 2D experiments |

**Shared signatures**: `start`, `pause`, `resume`, `reset`, `dispose`, `update`, `setParameter`, `getParameter`, `getDisplayData`, `getControlSchema`, `getMonitorSchema`, `triggerAction` — all identical so `ExperimentWorkbench` works without modification.

### ExperimentConfig2D

```typescript
interface ExperimentConfig2D {
  physics?: {
    timestep?: number;
    maxSubSteps?: number;
  };
  // No camera field — 2D scenes have no camera concept
  parameters: ParameterDefinition[];
}
```

### ExperimentMetadata extension

`ExperimentMetadata` is defined in `src/experiments/base/IExperiment.ts:7-16` (not a separate file). Add `renderMode` field with default value `'3d'`:

```typescript
interface ExperimentMetadata {
  id: string;
  name: string;
  category: ExperimentCategory;
  description: string;
  difficulty: ExperimentDifficulty;
  duration: number;
  keywords: string[];
  thumbnail: string;
  renderMode?: '3d' | '2d';  // defaults to '3d', added here
}
```

### Union Type for Shared Code

To support both experiment types in `simulationStore` and `ExperimentView`, define a union type:

```typescript
type ExperimentInstance = IExperiment | IExperiment2D;

function isExperiment2D(exp: ExperimentInstance): exp is IExperiment2D {
  return exp.metadata.renderMode === '2d';
}
```

## Base Class

### ExperimentBase2D

Manages 2D lifecycle: container reference, pause/resume. **Animation loop is NOT built into the base class** — it is managed by the React component (`ExperimentCanvas2D.tsx`) to ensure proper lifecycle synchronization with React's `useEffect` cleanup.

```typescript
abstract class ExperimentBase2D implements IExperiment2D {
  protected container: HTMLDivElement | null = null;
  protected isRunning: boolean = false;
  protected parameters: Map<string, number | string | boolean> = new Map();

  abstract readonly metadata: ExperimentMetadata;
  abstract readonly config: ExperimentConfig2D;

  protected abstract setupScene(): Promise<void>;
  // Subclasses build SVG/Canvas structure and attach to this.container

  async init(container: HTMLDivElement): Promise<void> {
    this.container = container;
    this.initParameters();
    await this.setupScene();
  }

  /**
   * Initialize parameter defaults from config.
   * Copied from ExperimentBase (ExperimentBase.ts:37-41) — only depends on
   * config.parameters, not config.camera, so compatible with ExperimentConfig2D.
   */
  protected initParameters(): void {
    this.config.parameters.forEach((param: ParameterDefinition) => {
      this.parameters.set(param.key, param.defaultValue);
    });
  }

  start(): void { this.isRunning = true; }
  pause(): void { this.isRunning = false; }
  resume(): void { this.isRunning = true; }

  reset(): void {
    this.isRunning = false;
    this.initParameters();
    // subclass should override for additional reset logic
  }

  dispose(): void {
    this.isRunning = false;
    this.container = null;
    this.parameters.clear();
  }

  abstract update(deltaTime: number): void;

  setParameter(key: string, value: number | string | boolean): void {
    const isDefinedParameter = this.parameters.has(key) ||
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

  abstract getDisplayData(): Record<string, DisplayValue>;

  getControlSchema(): ControlSchema {
    return { title: 'Controls', parameters: this.config.parameters };
  }

  getMonitorSchema(): MonitorSchema {
    return { title: 'Monitor', quantities: [], defaultSelected: [], sampleIntervalMs: 100 };
  }

  triggerAction(_key: string): void { /* subclass overrides */ }
}
```

**Key difference from ExperimentBase**: No `THREE.Scene`, no `THREE.Object3D[]`, no Three.js resource disposal. No `requestAnimationFrame` loop — the animation driver lives in the React component.

## simulationStore Integration

**Problem**: `simulationStore.currentExperiment` has type `IExperiment | null` (see `src/stores/simulationStore.ts:15`). It cannot accept `IExperiment2D` directly.

**Solution**: Widen the store type to accept the union.

```typescript
// simulationStore.ts changes
import type { IExperiment, IExperiment2D, ExperimentInstance } from '@/experiments/base';

interface SimulationStore {
  currentExperiment: ExperimentInstance | null;  // was: IExperiment | null
  setExperiment: (experiment: ExperimentInstance | null) => void;
  // ... rest unchanged
}
```

The store's `tick(delta)` calls `currentExperiment.update(delta)` — this works because both `IExperiment` and `IExperiment2D` have `update(deltaTime: number)`.

The store's `start/pause/resume/reset` call the corresponding methods on `currentExperiment` — also compatible since signatures match.

**No other store logic changes required.**

## ExperimentView Branching

**Problem**: `ExperimentView.tsx:276-279` directly accesses `currentExperiment.config.camera.position`, which doesn't exist on `IExperiment2D`.

**Solution**: Wrap the `<SceneContainer>` block (lines 275-286) in a render-mode conditional. The `<ExperimentWorkbench>` block (lines 288-299) stays outside the conditional since it only uses declarative props.

```tsx
// Inside ExperimentView, after loading experiment:
const renderMode = currentExperiment.metadata.renderMode ?? '3d';

// In JSX:
<main className="relative flex-1 px-4 pb-4 pt-3">
  <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 ...">
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

  <ExperimentWorkbench ... />  {/* unchanged */}
</main>
```

**Estimated change**: ~15 lines modified in `ExperimentView.tsx` (not 10 as previously estimated — the `<SceneContainer>` block including its background wrapper `<div>` must be wrapped in the conditional).

## ExperimentCanvas2D Component

This React component handles:
1. Container ref and experiment initialization
2. `requestAnimationFrame` loop that calls `store.tick(delta)` — keeping the store as the single simulation clock source
3. Resize handling via `ResizeObserver`
4. Cleanup on unmount

```tsx
function ExperimentCanvas2D({ experiment }: { experiment: IExperiment2D }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tick = useSimulationStore((s) => s.tick);

  // Initialize experiment
  useEffect(() => {
    if (!containerRef.current) return;
    experiment.init(containerRef.current);
    return () => { experiment.dispose(); };
  }, [experiment]);

  // Animation loop — drives store.tick(), store calls experiment.update()
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      tick(delta);  // store.tick → experiment.update(delta)
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
      // Subclass can override onResize if needed
      experiment.onResize?.(width, height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [experiment]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

**Design decision**: The animation loop lives in the React component (not in `ExperimentBase2D`) because:
- React's `useEffect` cleanup automatically cancels `requestAnimationFrame` on unmount
- Prevents use-after-dispose bugs if `dispose()` is called while the loop is running
- Keeps the store as the single clock source — `tick(delta)` drives `experiment.update(delta)`, same as the 3D path (`SimulationLoop` → `useFrame` → `tick`)

Add optional `onResize` to `IExperiment2D`:

```typescript
interface IExperiment2D {
  // ... existing methods
  onResize?(width: number, height: number): void;
}
```

## ExperimentRegistry Extension

`ExperimentRegistry` (`src/experiments/base/ExperimentRegistry.ts`) currently uses `ExperimentConstructor = new () => IExperiment` and `create()` returns `IExperiment`.

**Changes**:

```typescript
type Experiment2DConstructor = new () => IExperiment2D;
type ExperimentInstance = IExperiment | IExperiment2D;

class ExperimentRegistryClass {
  private experiments = new Map<string, ExperimentConstructor>();
  private experiments2D = new Map<string, Experiment2DConstructor>();
  private metadataCache = new Map<string, ExperimentMetadata>();

  register2D(id: string, experimentClass: Experiment2DConstructor): void {
    this.experiments2D.set(id, experimentClass);
    const instance = new experimentClass();
    this.metadataCache.set(id, instance.metadata);
  }

  create(id: string): ExperimentInstance {
    const cls2D = this.experiments2D.get(id);
    if (cls2D) return new cls2D();
    const cls = this.experiments.get(id);
    if (!cls) throw new Error(`Experiment "${id}" not registered`);
    return new cls();
  }

  // getAll, getByCategory, getMetadata, has — unchanged (use metadataCache)
}
```

Add `registerExperiment2D` decorator:

```typescript
export function registerExperiment2D(id: string) {
  return function <T extends Experiment2DConstructor>(target: T): T {
    ExperimentRegistry.register2D(id, target);
    return target;
  };
}
```

## Visual Style System

### Design Tokens (CSS Variables)

The existing `src/index.css` defines `--color-primary: #3b82f6`, `--color-secondary: #6366f1`, etc. The 2D experiment tokens should complement (not duplicate) these:

```css
:root {
  /* 2D experiment specific tokens — derived from existing palette */
  --exp-2d-primary: #6366f1;       /* same as --color-secondary */
  --exp-2d-secondary: #8b5cf6;
  --exp-2d-accent: #22d3ee;         /* matches home page cyan */
  --exp-2d-positive: #34d399;       /* matches home page emerald */
  --exp-2d-negative: #f87171;
  --exp-2d-particle: #fbbf24;
  --exp-2d-glow: 0 0 8px var(--exp-2d-primary);
  --exp-2d-stroke: 1.5px;
  --exp-2d-fill: rgba(99, 102, 241, 0.1);

  /* Background matches ExperimentView's bg-slate-950 (#020617) */
  --exp-2d-bg: #0D1117;
  --exp-2d-surface: rgba(15, 23, 42, 0.45);
}
```

`ExperimentView` uses Tailwind classes (`bg-slate-950`, `border-white/10`, `bg-slate-900/45`) and inline styles for background gradients. 2D experiments should match this dark theme visual language.

### Rendering Technology

**Primary**: React state-driven SVG. All positions, colors, sizes managed as React state. Animation loop (`requestAnimationFrame` via `ExperimentCanvas2D`) updates state. SVG elements respond declaratively.

**Comparison with home page approach**:

| | Home page `<animate>` | Recommended: React state + rAF |
|---|---|---|
| Debuggability | Poor (state in DOM) | Good (React DevTools) |
| Parameter control | None | Native (state = params) |
| Pause/step | Not supported | Fully supported |
| Performance (< 200 elements) | Good | Good |
| Performance (> 200 elements) | Poor | Requires Canvas overlay |

### SVG + Canvas Hybrid (Deferred — YAGNI)

For particle-heavy scenes (particle count > 200), overlay Canvas below SVG:

```
<div style="position: relative">
  <canvas ref={particleCanvasRef} />   <!-- bottom: particles -->
  <svg ref={svgRef}>                    <!-- top: static elements -->
    <line ... />                        <!-- electrodes, labels -->
    <text ... />
  </svg>
</div>
```

**Deferred to actual need**: The specific threshold, Canvas API exposure, resize synchronization, and responsibility split (base class vs subclass) will be designed when a particle-heavy 2D experiment is implemented. This follows the YAGNI principle.

### SVG Visual Patterns (not components, code patterns)

Reusable patterns from home page (`src/pages/Home.tsx`), assembled per-experiment:

1. **Labeled dashed line** — arrow + text label
2. **Glowing particle** — `<circle>` + CSS filter blur
3. **Gradient path** — `<linearGradient>` stroked curve
4. **Pulsing ring** — `<circle>` radius oscillates with state
5. **Flowing arrow** — `stroke-dashoffset` shifts over time

## File Structure

### New files

```
src/experiments/base/
  IExperiment2D.ts            # 2D experiment interface
  ExperimentBase2D.ts         # 2D experiment base class

src/components/simulation/
  ExperimentCanvas2D.tsx      # 2D rendering container + animation loop + resize

src/styles/
  experiment-2d.css            # CSS variables and shared 2D styles
```

### Modified files

```
src/experiments/base/
  IExperiment.ts               # Add renderMode to ExperimentMetadata, add ExperimentInstance union type
  ExperimentRegistry.ts        # Add experiments2D map, register2D(), widen create() return type
  index.ts                     # Export new 2D types

src/stores/
  simulationStore.ts           # Widen currentExperiment type to ExperimentInstance | null

src/pages/
  ExperimentView.tsx           # Add renderMode conditional around SceneContainer (~15 lines)
```

### Unchanged files

All 14 existing experiment implementations, `ExperimentBase.ts` (3D base class), `ExperimentWorkbench`, `SceneContainer`, `ExperimentScene`, `ExperimentCanvas2D` (new).

## Migration: HydrogenAbstractView

The first 2D experiment client. The migration has specific challenges:

### Current HydrogenAbstractView characteristics

`src/pages/HydrogenAbstractView.tsx` is a standalone page (~730 lines) with:

1. **Custom sidebar** (`AbstractSideToolbar`): Independent control panel with parameters like `initialLevel`, `electronCount`, `allowSecondary`, `incidentType`, `incidentEnergy`, `viewMode`. Uses its own UI, not `ExperimentWorkbench`.
2. **Two simulation modes**: Spontaneous emission and excitation — requires a "Fire" action button.
3. **Feedback message system**: Temporary UI messages (e.g., "Energy mismatch") that `getDisplayData()` cannot express.
4. **Fixed canvas size**: 800x600 SVG, not responsive to container.
5. **Closure-based animation**: Uses `useRef` for animation frame ID, `animate` function depends on closure state (electrons, incidentParticles). Causes `useEffect` dependency array churn.

### Migration steps

1. **Create `HydrogenAbstract2D`** implementing `IExperiment2D`
   - Map each sidebar parameter to `ParameterDefinition[]`
   - Map "Fire" button to `ActionDefinition` + `triggerAction('fire')`
   - Map `viewMode` toggle to `setParameter('viewMode', ...)`
2. **Define `getControlSchema()`** returning all parameters as `ParameterDefinition[]`
3. **Define `getMonitorSchema()`** for relevant quantities (energy, wavelength, etc.)
4. **Feedback messages**: The 2D React component can render its own feedback UI via React state, since 2D experiments render as React components. No interface change needed for `getDisplayData()`.
5. **Responsive sizing**: Implement `onResize(width, height)` to adapt SVG `viewBox`
6. **Register** with `@registerExperiment2D('hydrogen-abstract')`
7. **Delete** `HydrogenAbstractView.tsx` and its route
8. **Result**: The experiment loads through `ExperimentView` 2D branch with full `ExperimentWorkbench` control panel support

## Out of Scope (YAGNI)

- Runtime 3D-to-2D switching (an experiment is one or the other)
- SVG component library (abstract after 2-3 2D experiments exist)
- Any changes to existing 14 experiments
- Dedicated 2D rendering library (Konva, PixiJS, etc.) — vanilla SVG + Canvas is sufficient
- SVG + Canvas hybrid details (deferred until particle-heavy 2D experiment is needed)
