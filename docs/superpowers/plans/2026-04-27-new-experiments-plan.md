# New Physics Experiments Implementation Plan

**Goal:** Add 3 experiments — Light Refraction, Boyle's Law, Double-Slit Interference.
**Design Spec:** `docs/superpowers/specs/2026-04-27-new-experiments-design.md`
**Priority:** Boyle's Law > Light Refraction > Double-Slit Interference (by complexity)

All experiments extend `ExperimentBase`, register via `ExperimentRegistry`, and use `ExperimentWorkbench` for declarative UI (control panel + monitor panel).

---

## File Structure

```
src/experiments/optics/light-refraction/
    LightRefraction.ts           # Main experiment class
    RefractionPhysics.ts         # Snell's law, Fresnel equations (pure functions)
    shapes/MediumShapes.ts       # 4 medium block geometries
    index.ts

src/experiments/thermodynamics/boyle-law/
    BoyleLaw.ts                  # Main experiment class
    GasMolecules.ts             # InstancedMesh particle system
    index.ts

src/experiments/optics/double-slit-interference/
    DoubleSlitInterference.ts    # Main experiment class
    InterferencePhysics.ts       # Fringe intensity calculation (pure functions)
    WavelengthColor.ts           # Wavelength-to-RGB conversion utility
    index.ts

src/experiments/optics/index.ts
src/experiments/thermodynamics/index.ts
```

Existing files to modify: `src/experiments/index.ts`, `src/pages/Home.tsx`, `src/experiments/base/ExperimentBase.ts`

---

## Task 1: Infrastructure

- Create `src/experiments/optics/index.ts` and `src/experiments/thermodynamics/index.ts`
- Add `getSafeNumber(key, fallback, min, max)` protected helper to `ExperimentBase.ts` — shared by all 3 experiments for safe parameter reads

## Task 2: Boyle's Law (`boyle-law`)

Category: `thermodynamics`, Difficulty: `basic`

**Scene:** Transparent cylinder container with a movable piston. Gas molecules (InstancedMesh particles) bounce inside at speeds proportional to sqrt(T). Stacked weight blocks on piston visualize pressure.

**Interaction:** Drag piston in 3D scene OR use slider — both stay in sync.

**Parameters:**
- `volume` (slider 0.5–10 L, default 5)
- `amount` (select 1/2/3 mol, default 1) — molecule count scales with this (40/mol)
- `temperature` (slider 200–500 K, default 300)

**Physics:** `P = nRT/V`, molecule speeds `∝ sqrt(T)`. Molecule count recreated when `amount` changes.

**Monitor quantities (time-series):** Pressure, Volume, PV product (kPa·L, ≈2.49 at STP), Temperature

**Notes:**
- `GasMolecules.dispose()` only nulls references; `ExperimentBase.dispose()` handles Three.js cleanup via `addToScene()`
- PV display uses kPa·L for intuitive educational values

## Task 3: Light Refraction (`light-refraction`)

Category: `optics`, Difficulty: `basic`

**Scene:** Semi-transparent medium block at the center of a flat interface plane. Incident ray (yellow beam with arrow) enters from above. Reflected ray and refracted ray at the interface. Dashed normal line. Arc annotations for incident/refracted/critical angles.

**4 Medium Shapes:** Rectangle, Prism, Semicircle, Hemisphere — visual geometry only, v1 physics uses a flat single-surface interface for all shapes.

**Parameters:**
- `incidentAngle` (slider 0–89°, default 30)
- `upperMedium` (select Air/Water/Glass/Diamond, default Air)
- `lowerMedium` (select Air/Water/Glass/Diamond, default Glass)
- `shape` (select Rectangle/Prism/Semicircle/Hemisphere, default Rectangle)
- `wavelength` (slider 380–780 nm, default 550)

**Physics:** Snell's law refraction, Fresnel reflectance, total internal reflection detection with critical angle. When TIR occurs, refracted ray disappears, reflected ray brightens, text indicator shown.

**Critical angle arc direction:** Drawn on the refraction side of the normal (`-PI/2 + angle`), not the incident side.

**Monitor:** Static experiment, no time-varying data. `getMonitorSchema()` returns empty quantities. All values shown via `getDisplayData()` live readout.

**Deferred to v2:** Prism dispersion, rectangular slab double-surface refraction, curved-surface normals for semicircle/hemisphere.

## Task 4: Double-Slit Interference (`double-slit-interference`)

Category: `optics`, Difficulty: `intermediate`

**Scene:** Light source (glowing point, color matches wavelength) on the left. Double-slit barrier in the middle. Concentric arc wavefronts expand from both slits. Observation screen on the right renders interference fringe pattern (brightness = intensity, color = wavelength). Intensity curve overlay on the fringe pattern.

**Parameters:**
- `wavelength` (slider 380–780 nm, default 550)
- `slitSeparation` (slider 0.1–2.0 mm, default 0.5)
- `screenDistance` (slider 0.5–5.0 m, default 1.0)
- `slitWidth` (slider 0.01–0.5 mm, default 0.1)

**Physics:** Fringe intensity via path difference + single-slit diffraction envelope. Fringe color from `WavelengthColor.wavelengthToRGB()`.

**Monitor quantities (time-series):** Wavelength, Fringe spacing, Central bright fringe width, Visible order k

**Notes:**
- `DoubleSlitInterference` imports `wavelengthToRGB` from `./WavelengthColor` — do NOT duplicate the algorithm
- `WavelengthColor.ts` imports `THREE` at the top of the file
- Wavefront lines should be pre-created and have geometry buffers updated rather than destroyed/recreated every frame

## Task 5: Unit Tests

Create Vitest tests for the pure-function physics modules:
- `RefractionPhysics.test.ts` — Snell's law angles, TIR detection, Fresnel reflectance monotonicity, preset medium validation
- `WavelengthColor.test.ts` — RGB output for violet/green/red, clamping, out-of-range returns [0,0,0]
- `InterferencePhysics.test.ts` — max intensity at center, zero at destructive points, symmetry, fringe spacing formulas

## Task 6: Registration & Home Page

- Register all 3 experiments in `src/experiments/index.ts`
- Add 3 cards to `Home.tsx` with inline SVG diagrams (light refraction = prism + beam, Boyle's law = cylinder + piston, double-slit = waves + slits)
- Visual verification in browser

---

## Key Implementation Notes

1. **No `config.json`** — recent experiments (e.g. ProjectileMotion) define config inline; follow that pattern
2. **`ExperimentCategory.Optics` and `ExperimentCategory.Thermodynamics`** already exist in `src/utils/constants.ts`
3. **Thumbnail images** are not created in v1; Home page uses inline SVG diagrams instead
4. **All UI text in English** per project internationalization standards
5. **Scene objects** must use `addToScene()`/`removeFromScene()` for automatic lifecycle management
6. **Reference implementations:** `ProjectileMotion.ts` for experiment structure, `ExperimentWorkbench.tsx` for UI integration
