# Rutherford α-Particle Scattering — Visual Redesign Spec

## Problem

The Rutherford α-Particle Scattering experiment has two views (Device/Macro and Micro) that feel visually disconnected from the home page's "dopamine" design language:

1. **Device View is too dark** — Canvas background near-black (`#030816`), low light intensities, objects lack presence
2. **Micro View has jarring colors** — Pure green `#00ff00` particles/trajectories look cheap and clash with the home page's soft gradients
3. **Lines are too thin** — `THREE.LineBasicMaterial` defaults to 1px on most browsers, trajectories are nearly invisible
4. **Arrow/particle source is ugly** — Micro view uses `ConeGeometry(0.3, 0.8, 8)` with 8 segments, looks rough and out of place

## Design Direction

**Harmonious coexistence** — Preserve semantic colors for physics elements (gold foil = gold, nucleus = warm), but unify the overall brightness, glow quality, line thickness, and accent palette with the home page's dopamine tech aesthetic.

## Changes

### 1. Device View (MacroExperimentView.tsx)

#### Background & Lighting

| Property | Current | New |
|----------|---------|-----|
| Canvas gradient | `#030816` → `#091328` → `#111b33` | `#0D1117` → `#111827` → `#1a2332` |
| Center highlight | `rgba(56,189,248,0.14)` single | Keep + add `rgba(0,255,65,0.08)` green glow |
| ambientLight intensity | 0.35 | 0.5 |
| hemisphereLight intensity | 0.38 | 0.55 |
| directionalLight intensity | 0.95 | 1.2 |

#### Object Materials

| Object | Current | New |
|--------|---------|-----|
| Source body | `#1e3a8a` deep blue | `#1e293b` → `#334155` muted slate |
| Source glow sphere | `#ff4500` / emissive `#ff2200` | `#38BDF8` / emissive `#0EA5E9` (sky blue, matches home) |
| Detector screen | `#3b82f6` opacity 0.7 | `#22D3EE` opacity 0.8 (cyan) |
| Alpha particles | `#ffd700` / emissive `#ffaa00` | Keep gold (semantic), increase emissiveIntensity |
| Ground | `#0f172a` | `#0D1117` (unified with home) |

#### Hit Point Colors (detector)

| Category | Current | New |
|----------|---------|-----|
| Direct passage | `#ffdd00` | `#34D399` (emerald green) |
| Small angle | `#ffaa00` | `#F59E0B` (amber) |
| Large angle | `#ff4400` | `#F97316` (orange) |

### 2. Micro View (RutherfordExperiment.ts)

#### Particle Source (Cone)

| Property | Current | New |
|----------|---------|-----|
| Color | `0x00ff00` pure green | `0x22D3EE` cyan |
| Segments | 8 | **32** (smooth surface) |
| Emissive | `0x00aa00` intensity 0.5 | `0x0891B2` intensity 0.5 |
| Keep breathing animation | Yes | Yes |

#### Alpha Particles

| Distance | Current | New |
|----------|---------|-----|
| Default | `0x00ff00` green | `0x00FF41` (home page green) |
| Close (<1) | `0xff6600` | `#F59E0B` (amber) |
| Medium (<2) | `0xffff00` | `#34D399` (emerald) |

#### Trajectory Lines — Line2 Migration

Replace `THREE.LineBasicMaterial` with `Line2` + `LineMaterial` from `three/examples/jsm/lines/`:

- **linewidth**: 2.5px (visible on all browsers)
- **Colors by scattering angle**:
  - Direct passage (angle < 10°): `#22D3EE` (cyan)
  - Small angle (10° ≤ angle < 30°): `#34D399` (emerald)
  - Large angle (angle ≥ 30°): `#F97316` (orange)
- **Opacity**: Active = 0.8, Completed = 0.4

New imports needed in RutherfordExperiment.ts:
```
import { Line2 } from 'three/examples/jsm/lines/Line2'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry'
```

#### Electron Cloud & Boundary

| Object | Current | New |
|--------|---------|-----|
| Cloud color | `0x4488ff` opacity 0.08 | `0x22D3EE` opacity 0.12 |
| Boundary ring | `0x6699ff` opacity 0.3 | `0x38BDF8` opacity 0.35 |

#### Canvas Background

| Property | Current | New |
|----------|---------|-----|
| Start color | `#030816` | `#0D1117` (unified) |

### 3. Semantic Colors Preserved

These elements keep their physics-meaningful warm colors unchanged:

- **Gold foil**: `#ffd700` (macro) / `0xdaa520` (micro)
- **Nucleus**: `0xffd700` with `emissive 0xffaa00` intensity 2
- **Nucleus glow**: `0xffdd00` opacity 0.4

## Files to Modify

| File | Scope |
|------|-------|
| `src/pages/MacroExperimentView.tsx` | Background gradient, light intensities, material colors, hit point colors, ground color |
| `src/experiments/atomic/rutherford-scattering/RutherfordExperiment.ts` | Particle source (color, segments), alpha particle colors, trajectory Line2 migration, electron cloud colors |
| `src/components/simulation/SceneContainer.tsx` | Canvas background start color |

## Not in Scope

- Home page changes
- Physics simulation logic changes
- New 3D models or geometries (except cone segment increase)
- Environment maps / HDR
