# New Physics Experiments Design: Refraction, Boyle's Law, Double-Slit Interference

> Date: 2026-04-27
> Status: Approved

## Overview

Add 3 new virtual simulation experiments to the platform, covering optics and thermodynamics — two domains currently absent from the project. All experiments use 3D scenes (Three.js/R3F) for consistency with existing experiments. Implementation priority: Boyle's Law > Light Refraction > Double-Slit Interference (ordered by complexity).

---

## Experiment 1: Light Refraction & Total Internal Reflection

**ID:** `light-refraction`
**Category:** `optics`
**Difficulty:** `basic`

### Physics

- Snell's Law: `n1 * sin(theta1) = n2 * sin(theta2)`
- Law of reflection: `theta_r = theta_i`
- Critical angle: `theta_c = arcsin(n2/n1)` (when light travels from denser to less dense medium)
- Fresnel equations for reflection/transmission intensity ratios

### 3D Scene

| Element | Description |
|---------|-------------|
| Medium block | Semi-transparent glass-textured solid, 4 selectable shapes |
| Incident ray | Yellow/white beam from above with direction arrow |
| Reflected ray | At interface, angle equals incident angle |
| Refracted ray | Enters medium at angle per Snell's law; disappears on total internal reflection |
| Normal line | Dashed line at interface |
| Angle annotations | Arc labels for incident angle, refracted angle, critical angle |
| Total reflection indicator | Text label when total internal reflection occurs; reflected ray brightens |

### Medium Block Shapes

| Shape | Physics use-case | Special behavior |
|-------|-----------------|------------------|
| Rectangular slab | Basic refraction demo | Two refractions (entry + exit surface) |
| Triangular prism | Dispersion | Different wavelengths refract differently — white light splits into spectrum |
| Semicircular cylinder | Classic refractive index measurement | All rays from arc surface converge at center; normal always points to center |
| Hemisphere | 3D version of semicylinder | Classic total internal reflection demonstration |

### Parameters (Control Schema)

| Parameter | Type | Range/Options | Default |
|-----------|------|---------------|---------|
| `incidentAngle` | slider | 0 ~ 89 degrees | 30 |
| `upperMedium` | select | Air (1.0), Water (1.33), Glass (1.5), Diamond (2.42) | Air |
| `lowerMedium` | select | Air (1.0), Water (1.33), Glass (1.5), Diamond (2.42) | Glass |
| `shape` | select | Rectangle, Prism, Semicircle, Hemisphere | Rectangle |
| `wavelength` | slider | 380 ~ 780 nm | 550 |

### Monitored Quantities

| Quantity | Unit | Description |
|----------|------|-------------|
| Incident angle | degrees | theta_i |
| Refracted angle | degrees | theta_r (per Snell's law) |
| Critical angle | degrees | theta_c (if applicable) |
| n1 | dimensionless | Upper medium refractive index |
| n2 | dimensionless | Lower medium refractive index |
| Reflectance | ratio | Reflected intensity / incident intensity |

---

## Experiment 2: Boyle's Law

**ID:** `boyle-law`
**Category:** `thermodynamics`
**Difficulty:** `basic`

### Physics

- Boyle's Law: `P1 * V1 = P2 * V2` at constant temperature
- Ideal gas equation: `PV = nRT`
- Gas molecules average speed proportional to sqrt(T)
- Pressure derived from: `P = nRT / V`

### 3D Scene

| Element | Description |
|---------|-------------|
| Cylinder | Transparent cylindrical container, closed bottom |
| Piston | Solid cylinder, draggable up/down in 3D scene |
| Gas molecules | Large number of small particles with random motion inside cylinder; speed increases with pressure |
| Weights (visual) | Stacked blocks on top of piston, visual representation of pressure |
| P-V curve | Real-time plot showing hyperbolic PV relationship |

### Interaction Modes

1. **3D Drag mode**: User drags piston directly in the 3D scene; volume changes, pressure auto-calculated
2. **Slider mode**: Slider controls piston position; 3D scene synchronizes

Both modes stay in sync — dragging updates the slider, slider updates the 3D position.

### Parameters (Control Schema)

| Parameter | Type | Range/Options | Default |
|-----------|------|---------------|---------|
| `volume` | slider | 0.5 ~ 10 L | 5.0 |
| `amount` | select | 1 mol, 2 mol, 3 mol | 1 mol |
| `temperature` | slider | 200 ~ 500 K | 300 |

### Monitored Quantities

| Quantity | Unit | Description |
|----------|------|-------------|
| Pressure | Pa / atm | Current gas pressure |
| Volume | L | Current gas volume |
| Temperature | K | Constant temperature |
| PV product | Pa*L | Should remain constant (verify Boyle's law) |
| Avg molecular speed | m/s | Visual indicator of molecular motion |

---

## Experiment 3: Double-Slit Interference

**ID:** `double-slit-interference`
**Category:** `optics`
**Difficulty:** `intermediate`

### Physics

- Path difference: `delta = d * sin(theta)` (d = slit separation, theta = diffraction angle)
- Bright fringe: `d * sin(theta) = k * lambda` (k = 0, +/-1, +/-2, ...)
- Dark fringe: `d * sin(theta) = (k + 0.5) * lambda`
- Fringe spacing: `Delta_y = lambda * L / d` (L = slit-to-screen distance)
- Single-slit diffraction envelope: intensity modulated by `sin(beta)/beta` where `beta = pi*a*sin(theta)/lambda`

### 3D Scene

| Element | Description |
|---------|-------------|
| Light source | Glowing point on the left, color matches selected wavelength |
| Double-slit barrier | Vertical barrier in the middle with two parallel slits |
| Wavefronts | Concentric arc wavefronts expanding from both slits, phase shown as brightness |
| Observation screen | Vertical screen on the right showing interference fringe pattern |
| Intensity curve | Overlaid I(y) plot aligned with the fringe pattern |

### Fringe Rendering

- Fringe color matches the selected wavelength (red light = red fringes, blue light = blue fringes)
- Intensity mapped to brightness (bright fringes = full color, dark fringes = black)
- Wavelength-to-color mapping uses the standard visible spectrum (380nm violet ~ 780nm red)

### Parameters (Control Schema)

| Parameter | Type | Range/Options | Default |
|-----------|------|---------------|---------|
| `wavelength` | slider | 380 ~ 780 nm | 550 |
| `slitSeparation` | slider | 0.1 ~ 2.0 mm | 0.5 |
| `screenDistance` | slider | 0.5 ~ 5.0 m | 1.0 |
| `slitWidth` | slider | 0.01 ~ 0.5 mm | 0.1 |

### Monitored Quantities

| Quantity | Unit | Description |
|----------|------|-------------|
| Wavelength | nm | Current wavelength + color name |
| Fringe spacing | mm | Delta_y = lambda * L / d |
| Central bright fringe width | mm | Width of central maximum |
| Visible order k | integer | Highest visible interference order |

---

## Implementation Scope (v1)

> **Note:** Some advanced features from the original design are deferred to future iterations to keep the initial implementation focused.

### Deferred to v2

- **Light Refraction:** Prism dispersion (multi-wavelength ray splitting), rectangular slab double refraction (entry + exit surface), curved surface normal calculation for semicircle/hemisphere shapes
- **Double-Slit Interference:** Intensity curve I(y) overlay on the observation screen

### In Scope for v1

- **Light Refraction:** Single-surface Snell's law refraction, total internal reflection, 4 medium block shapes (visual geometry only, physics uses flat interface), Fresnel reflectance
- **Boyle's Law:** Full implementation including 3D drag + slider dual-mode interaction, gas molecule particle system, P-V monitoring
- **Double-Slit Interference:** Wavefront animation, interference pattern rendering on screen, wavelength-color mapping

---

## Implementation Strategy

### Reusable Infrastructure

All three experiments inherit from `ExperimentBase` and use:

- `getControlSchema()` for declarative parameter controls
- `getMonitorSchema()` for real-time charting
- `ExperimentWorkbench` (existing UI: control panel + monitor panel + charts)
- `PlaybackControls` (existing play/pause/reset buttons)
- `SceneContainer` (existing R3F canvas + camera + lighting)

### New Experiment Categories

Add two new categories to `ExperimentCategory`:
- `optics` — for light refraction and double-slit interference
- `thermodynamics` — for Boyle's law

Update `Home.tsx` with new cards and SVG icons for each experiment.

### File Structure (per experiment)

```
src/experiments/optics/light-refraction/
    LightRefraction.ts          # Main experiment class
    shapes/                     # Medium block shape generators
        RectangularSlab.ts
        TriangularPrism.ts
        SemicircularCylinder.ts
        Hemisphere.ts
    RayTracer.ts               # Snell's law + reflection calculations

src/experiments/thermodynamics/boyle-law/
    BoyleLaw.ts                # Main experiment class
    GasMolecules.ts            # Particle system for gas molecule visualization
    Cylinder.ts                # Cylinder + piston 3D models

src/experiments/optics/double-slit-interference/
    DoubleSlitInterference.ts  # Main experiment class
    WavefrontRenderer.ts       # Wavefront arc animation
    FringeRenderer.ts          # Interference pattern on observation screen
    WavelengthColor.ts         # Wavelength-to-RGB color mapping utility
```

### Implementation Order

1. **Boyle's Law** — simplest physics, new thermodynamics category, draggable piston is the main interactive challenge
2. **Light Refraction** — medium complexity, 4 shapes to implement, Snell's law is straightforward
3. **Double-Slit Interference** — most complex rendering (wavefronts + fringe pattern + intensity curve), physics involves both interference and single-slit diffraction envelope

### Home Page Updates

Add 3 new cards to `Home.tsx`:
- Light Refraction — optics section, prism/beam icon
- Boyle's Law — thermodynamics section, cylinder/piston icon
- Double-Slit Interference — optics section, wave/slit icon
