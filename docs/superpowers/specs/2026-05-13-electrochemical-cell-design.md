# Electrochemical Cell Simulation - Design Spec

> Date: 2026-05-13
> Status: Draft
> Scope: Galvanic Cell + Electrolytic Cell (unified apparatus)

## 1. Overview

A unified electrochemical cell simulation that demonstrates both **galvanic cell** (原电池) and **electrolytic cell** (电解池) modes through a single apparatus. Users switch between modes by clicking the external device on the wire (voltmeter <-> power supply). The simulation visualizes macro apparatus, microscopic particle flow, and chemical equations in a single 3D scene.

### Target Audience

High school physics/chemistry students studying electrochemistry.

### Key Insight

The same apparatus serves both modes: connecting a voltmeter yields a galvanic cell (spontaneous redox), connecting a power supply yields an electrolytic cell (driven redox). This reinforces the conceptual link between the two.

## 2. Visual Design

### Color Palette (Dopamine)

Colors aligned with the project homepage SVG animations:

| Role | Hex | Usage in Experiment |
|------|-----|---------------------|
| Green | `#00FF41` / `#A3E635` | Electrons, energy flow |
| Blue | `#38BDF8` / `#60A5FA` | Anions, solution, water |
| Yellow | `#FFD166` / `#FACC15` | Cations, wire, highlights |
| Orange | `#F97316` / `#FDBA74` | Cu electrode, warm tones |
| Cyan | `#22D3EE` / `#7DD3FC` | Reduction labels, data |
| Red | `#F87171` | Oxidation labels |
| Gray | `#94A3B8` | Zn electrode, neutral elements |
| Background | `#0D1117` ~ `#1E293B` | Dark gradient (inherits from SceneContainer) |

### 3D Scene Layout

Single 3D scene with all elements coexisting:

```
[Wire + Device]----[Zn Electrode] | [CuSO4 Solution] | [Cu Electrode]----[Wire]
                                  |  ion animations   |
                        [Equation panel at scene bottom]
```

Components:
- **Beaker**: `LatheGeometry` glass container with `#38BDF8` semi-transparent solution
- **Zn Electrode**: `BoxGeometry`, silver-gray `#94A3B8`
- **Cu Electrode**: `BoxGeometry`, orange `#F97316`
- **Wire**: `TubeGeometry` along spline, golden `#FACC15`
- **External Device**: `BoxGeometry` + text texture, clickable to switch
  - Galvanic mode: Voltmeter icon
  - Electrolytic mode: Power supply icon
- **Electrons**: `InstancedMesh` spheres, `#00FF41`, moving along wire path
- **Cations** (Zn²⁺, Cu²⁺): `InstancedMesh` spheres, `#FFD166`
- **Anions** (SO₄²⁻): `InstancedMesh` spheres, `#38BDF8`

### Equation Display

HTML overlay at the bottom of the 3D scene using `@react-three/drei` `<Html>` component:

**Galvanic Cell mode:**
- Anode (Zn -): Zn -> Zn²⁺ + 2e⁻ (oxidation, `#F87171` label)
- Cathode (Cu +): Cu²⁺ + 2e⁻ -> Cu (reduction, `#22D3EE` label)
- Total: Zn + Cu²⁺ -> Zn²⁺ + Cu

**Electrolytic Cell mode:**
- Anode (Cu +): Cu -> Cu²⁺ + 2e⁻ (oxidation, `#F87171` label)
- Cathode (Zn -): Cu²⁺ + 2e⁻ -> Cu (reduction, `#22D3EE` label)
- Total: same as galvanic but driven by external voltage
- Shows minimum decomposition voltage

### Electrode Labels

3D labels next to each electrode showing:
- Element symbol (Zn / Cu)
- Polarity: (正极/负极 for galvanic) or (阴极/阳极 for electrolytic)
- Updated dynamically on mode switch

## 3. Control Panel

### Parameters (ControlSchema)

| Key | Type | Default | Range | Unit | Notes |
|-----|------|---------|-------|------|-------|
| `mode` | `select` | `galvanic` | galvanic / electrolytic | - | Primary mode switch |
| `electrolyteConcentration` | `number` | 1.0 | 0.1 ~ 2.0 | mol/L | CuSO₄ concentration |
| `temperature` | `number` | 25 | 0 ~ 100 | °C | Affects Nernst equation |
| `electrodeSpacing` | `number` | 5 | 2 ~ 10 | cm | Affects internal resistance |
| `externalResistance` | `number` | 10 | 1 ~ 100 | Ω | Only shown in galvanic mode |
| `appliedVoltage` | `number` | 3.0 | 0 ~ 12 | V | Only shown in electrolytic mode |
| `showParticles` | `boolean` | true | - | - | Toggle particle animation |
| `showEquations` | `boolean` | true | - | - | Toggle equation overlay |

### Actions

| Key | Label | Behavior |
|-----|-------|----------|
| `resetElectrodes` | Reset Electrodes | Clear deposited material, restore initial state |

### Monitor (MonitorSchema)

| Quantity | Unit | Color | Source |
|----------|------|-------|--------|
| Cell EMF | V | `#22d3ee` | Nernst equation |
| Current | A | `#f59e0b` | Ohm's law |
| Electron flow rate | e⁻/s | `#00FF41` | Animation parameter |
| Zn²⁺ concentration | mol/L | `#FFD166` | Faraday's law cumulative |
| Cu deposited | mg | `#F97316` | Faraday's law cumulative |

### DisplayData

Returns equation strings and computed values for the right-side panel and in-scene overlay.

## 4. Mode Switch Behavior

When `mode` parameter changes (via 3D click or control panel):

1. **3D device model**: Swap voltmeter <-> power supply mesh
2. **Particle direction**: Reverse electron flow direction on wire
3. **Equations**: Update half-reactions and total reaction text
4. **Conditional parameters**: Show/hide `externalResistance` vs `appliedVoltage` in control panel
5. **Electrode labels**: Swap (正极/负极) <-> (阴极/阳极)
6. **Particle composition**: Adjust ion types and directions for electrolytic mode

## 5. Physics Engine

### `ElectrochemistryPhysics.ts` — Pure Functions

**Nernst Equation (EMF calculation):**
```
E = E° - (RT / nF) * ln(Q)
E°(Zn/Cu) = 1.10 V (standard cell potential)
```

**Current calculation:**
- Galvanic: `I = E / (R_internal + R_external)`
- Electrolytic: `I = (V_applied - V_decomposition) / R_total`

**Faraday's Law (mass deposited):**
```
m = (M * I * t) / (n * F)
```

**Reaction equations:**
- `getReactions(mode)` returns structured reaction data (half-reactions, total, labels)

All calculations use SI units internally, convert for display.

## 6. Particle Flow System

### `ParticleFlowSystem.ts`

Manages animated particles along predefined paths:

- **Wire path**: Spline curve from one electrode, through external device, to other electrode
- **Solution paths**: Multiple curves between electrodes through the solution
- **Particle types**:
  - Electrons (green `#00FF41`): follow wire path
  - Cations (yellow `#FFD166`): follow solution paths from anode to cathode
  - Anions (blue `#38BDF8`): follow solution paths from cathode to anode
- Uses `InstancedMesh` for efficient rendering of many particles
- Particle speed proportional to current magnitude
- Direction reverses between galvanic and electrolytic modes

### Animation Details

- Particles continuously loop along their paths
- When reaching path end, respawn at start (seamless loop)
- Particle count scales with current (more particles = higher current)
- Smooth transition when mode switches (particles decelerate, reverse, accelerate)

## 7. File Structure

### New Files

```
src/experiments/electrochemistry/
├── index.ts                      # Export
├── GalvanicCell.ts               # Main experiment class (~350 lines)
├── ElectrochemistryPhysics.ts    # Pure physics calculations (~150 lines)
└── ParticleFlowSystem.ts         # Particle animation system (~200 lines)
```

### Modified Files

| File | Change |
|------|--------|
| `src/utils/constants.ts` | Add `Electrochemistry: 'electrochemistry'` to `ExperimentCategory` |
| `src/experiments/index.ts` | Import and register `GalvanicCell` |
| `src/pages/Home.tsx` | Add experiment card with SVG icon |

### Class Structure

```
GalvanicCell extends ExperimentBase
├── metadata: { id, name, category, description, ... }
├── config: { parameters[], camera, physics }
├── setupScene(): void
│   ├── Create beaker, electrodes, wire, device
│   ├── Create equation overlay
│   └── Initialize ParticleFlowSystem
├── update(deltaTime): void
│   ├── Update particle positions
│   └── Update physics calculations
├── getDisplayData(): Record<string, DisplayValue>
├── getControlSchema(): ControlSchema
├── getMonitorSchema(): MonitorSchema
└── onParameterChange(key, value): void
    └── Handle mode switch, conditional parameters
```

## 8. Routing

Uses the standard generic route:

```
/experiment/galvanic-cell  ->  ExperimentView  (auto-loads from Registry)
```

No custom page component needed. `ExperimentView` handles everything:
- Header with back button, title, playback controls
- `SceneContainer` with `ExperimentScene`
- `ExperimentWorkbench` with Controls + Monitor tabs

## 9. 3D Object Construction (No External Models)

All 3D objects built programmatically:

| Object | Geometry | Material |
|--------|----------|----------|
| Beaker | `LatheGeometry` (profile curve) | `MeshPhysicalMaterial` (transparent, glass-like) |
| Solution | `CylinderGeometry` | `MeshStandardMaterial` (semi-transparent blue) |
| Zn Electrode | `BoxGeometry` | `MeshStandardMaterial` (metallic gray) |
| Cu Electrode | `BoxGeometry` | `MeshStandardMaterial` (metallic orange) |
| Wire | `TubeGeometry` (spline) | `MeshStandardMaterial` (golden) |
| Voltmeter | `BoxGeometry` + circle + text | `MeshStandardMaterial` |
| Power Supply | `BoxGeometry` + text | `MeshStandardMaterial` |
| Electrons | `SphereGeometry` (instanced) | `MeshBasicMaterial` (emissive green) |
| Cations | `SphereGeometry` (instanced) | `MeshBasicMaterial` (emissive yellow) |
| Anions | `SphereGeometry` (instanced) | `MeshBasicMaterial` (emissive blue) |

## 10. Camera Configuration

```typescript
camera: {
  position: [0, 4, 8],
  target: [0, 1, 0],
  fov: 50
}
```

OrbitControls enabled for user rotation/zoom. Default view shows the full apparatus from a slight elevated angle.

## 11. Reusable Patterns from Existing Experiments

| Pattern | Source | Application |
|---------|--------|-------------|
| `ExperimentBase` inheritance | All experiments | Lifecycle management |
| Physics/rendering separation | `ScatteringPhysics.ts` | `ElectrochemistryPhysics.ts` |
| `InstancedMesh` particle system | `RutherfordExperiment.ts` | Particle flow |
| `select` parameter for modes | `HydrogenTransition.ts` | Mode switching |
| `CSS2DRenderer` / `<Html>` labels | `HydrogenTransition.ts` | Equation overlay |
| `ControlSchema` / `MonitorSchema` | `Pendulum.ts` | UI panels |
| `addToScene()` / `removeFromScene()` | `ExperimentBase` | Safe 3D object management |
| Lathe geometry for containers | N/A (new pattern) | Beaker |

## 12. Out of Scope

- Salt bridge configuration (single container only)
- Multiple electrolyte types (only CuSO4)
- Electroplating of different metals
- Secondary/rechargeable batteries
- Real-time voltage-current curve plotting (monitoring panel provides basic chart)
