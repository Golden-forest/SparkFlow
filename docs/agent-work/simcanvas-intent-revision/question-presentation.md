# Revised presentation: Guangdong2026 Q14 / Q15

Status: user approved the recommended wireframe on 2026-10-13, with the explicit condition to create new HTML entries and preserve the earlier animations. Implemented, locally verified and deployed as additional entrypoints: jumping-robot-exam-steps and charged-bead-exam-steps. Original published assets remain intact. Existing verified trajectory kernel is reused; exact delivery evidence is in progress.md.

## Shared behavior

Each page has three clearly numbered question entries. Question selection sets the relevant initial/end states, controls, key observations and full equation chain. Physical phase is labeled separately from question number. Give the animation the largest region; reserve a readable derivation board for applicable equations and boundary values. No default energy-history plot, generic quantity dropdown or insight. Short source labels and formulas replace explanatory paragraphs. Key results appear at their corresponding scene locations/events and on the derivation board. Source symbols are not replaced by arbitrary numeric values. Before/After and phase jumps remain where they support the requested reasoning.

The teacher also approved combining independent inspection with continuous playback. Both pages default to full process with looping selected; Start plays, and Full process returns from a question to continuous playback with one click. Full mode follows the source trajectory once, automatically updates question coverage and equations, and holds exact contacts/extrema briefly. It includes clearly labeled continuation after each requested calculation interval. Selecting a question retains the original independent interval and optional loop. This avoids manually switching questions while also avoiding replaying Q14's overlapping intervals as if they were consecutive physical stages.

## Q14: Twin-Pendulum Jumping Robot

Source givens visible together: totalM=4 kg includes bothm=1 kg bobs; R=.4 m; v0=4 m/s; g=10 m/s². Shell massM−2m=2 kg.

### Part1 · Post-impact kinetic energy

Interval: release at bottom -> swing to bumpers -> simultaneous bumper collision -> common launch, stop immediately after impact. Show bob incoming speedv_b and common outgoing speedV at the collision, with event Before/After. Laws distinguish smooth swing from impact; highlight the active step.

1. Per bob: ½mv0² = ½m v_b² + mgR.
2. v_b² = v0²−2gR = 8 m²/s²; v_b=2√2 m/s.
3. Short collision vertical momentum:2m v_b = M V; V=√2 m/s.
4. Post-impact kinetic energy:E_k=½M V²=4 J.

### Part2 · Maximum rise

Interval: launch just after bumpers -> highest point; stop at apex. Show upward shell velocityV, height bracket measured from launch, instantaneous velocity, and terminalh_max. No energy-history curve.

1. ½M V² = M g h_max (orV²=2g h_max).
2. h_max=V²/(2g)=.10 m.
3. At highest point: common speed0.

### Part3 · Mechanical-energy loss through first landing

Interval: initial bob motion -> first shell landing, including both impact discontinuities. Stop after landing for the requested answer. Show shell and bob velocities separately at ground impact: before both−√2 m/s; after shell0, bobs−√2 m/s. Emphasize two discrete loss contributions, not continuous energy-versus-time variation. Any later bob return is a separate optional continuation.

1. Bumper loss:ΔE1=½(2m)v_b²−½M V²=8−4=4 J.
2. Ground loss:ΔE2=½(M−2m)V²=2 J.
3. Total:ΔE=ΔE1+ΔE2=6 J.
4. Overall check: initialE=½(2m)v0²=16 J; finalE=2mgR+½(2m)V²=8+2=10 J; ΔE=16−10=6 J.

## Q15: Charged Bead Between Plates

Source uses symbols:m,q,d,g; no given numericalm,q,d,g. Plate separation and equivalent swing radiusd; two equal ropes length√2d, angle90°. Keep rope-plane inset. Illustrative parameters may set playback but are clearly separated; default displayed results remain symbolic or dimensionless. theta positive towardN.

### Part1 · Constant voltage from quasi-static ramp

Interval: initial equilibrium -> slowly increasingU -> positive bead first reachesN; stop before charge reversal for this part. Showθ, increasing voltage and equilibrium forces. Boundary geometry suppliesθN=30°.

1. sinθN=(d/2)/d=½; θN=30°.
2. qE=mg tanθN, E=U0/d.
3. U0=mgd tan30°/q=mgd/(√3q).

### Part2 · Single-rope tension before firstM contact

Interval: release fromN after charge−q, underU0 -> firstM contact; stop BEFORE speed reset. Showv_M, centripetal direction, two individual rope forces or the explicitly labeled resultant√2T, and the event side. Do not confuse the static tension from part1 with moving-ball tension.

1. Endpoints have equal height; ½m v_M²=qU0.
2. v_M²=2gd/√3.
3. Radial Newton law:√2T−mg cos30°−qE sin30°=m v_M²/d, withqE=mg/√3 (magnitude).
4. T=(2√6/3)mg ≈1.633mg per rope.

### Part3 · Voltage multiplier, allowed range and piecewise maximum

Interval: afterM contact, v=0, charge+q, U=kU0 -> travel towardN. Show k as the actual question input; identify the valid branches and maximum-speed position on the arc. Use diagram comparisons and equation cases; no default time-history energy curve.

1. Release tension:T_start=(3−k)mg/(2√6)>0 ->0<k<3 (source answer). Showk=3 separately as a critical zero-tension release; stop the arc demo fork>3.
2. Work-energy along the arc:E_k/(mgd)=cosθ−√3/2+(k/√3)(sinθ+½).
3. Stationary maximum condition:−sinθ+(k/√3)cosθ=0 ->tanθ*=k/√3.
4. For0<k≤1:θ*=atan(k/√3)≤30°, E_k,max=mgd[√(1+k²/3)−√3/2+k/(2√3)].
5. For1<k<3: maximum occurs atN before contact, θ=30°, E_k,max=kmgd/√3.
6. Atk=1 both expressions agree; contact after the measured maximum resets velocity and reverses charge, separately from the maximum snapshot.

## Structural gate wireframe

Scene-first, question-specific derivation board; no fixed energy/plot/insight inventory.

```text
Bilingual title · source question
[Part1: concrete target] [Part2: concrete target] [Part3: concrete target]
┌────────────────────────────────┬────────────────────────┐
│ Active question + physical phase│ Relevant givens/results│
│                                │ Complete equation chain│
│ Large apparatus animation      │ Applicable step marked │
│ Boundary numbers at objects    │                        │
│ Required vectors/geometry only │                        │
├────────────────────────────────┴────────────────────────┤
│ Question-specific checkpoints / interval scrub          │
│ Start Pause Reset Slow · Before/After when useful        │
└─────────────────────────────────────────────────────────┘
```

The same presentation principles adapt to other simulations: pulse superposition may need scene plus scrub; a stopping-distance comparison may need a meaningful parameter plot. These two exam layouts do not become universal requirements.
