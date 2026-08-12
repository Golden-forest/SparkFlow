# SimCanvas — Procedural / Algorithmic Domain Extension

> **Status**: Design v1.0 — brainstormed 2026-08-12, awaiting user review
> **Scope**: Extend the `simcanvas` skill (a personal Claude Code skill at `~/.claude/skills/simcanvas/`) with a first-class execution model and correctness contract for procedural / algorithmic simulations (sorting, cellular automata, Markov chains, graph traversal, stepwise numerical methods, molecular-dynamics-as-events, etc.). No host-project (`atomic_physics`) coupling.

---

## 1. Problem and opportunity

SimCanvas is already multi-domain *in ambition*: its frontmatter names "physics, mathematics, chemistry, biology, engineering, mechanics, traffic, education, and other dynamic or rule-based systems," and `modeling.md` is loaded for "scientific, mathematical, engineering, **stochastic, or rule-system** model choices." But its **rigor is uneven**:

- **Continuous physics** is supported deeply: `physics-correctness.md` (the largest reference) defines a 6-tier model classification, a Physics Contract template, oracle checks via `runModelChecks()`, and library routing (Planck.js / Rapier / SymPy / SciPy / Pint). Quantitative physics cannot claim correctness without passing model checks (SKILL.md non-negotiable rule, line 144).
- **Procedural / algorithmic / rule-system** domains default to `qualitative` and are trusted uncritically. There is no step contract, no oracle harness, no tier routing, no notion of discrete ticks or events.

There is also a **structural mismatch**: SimCanvas's runtime is built around a continuous-time `update(dt)` loop. That fits a pendulum or an RC circuit but *fights* algorithmic visualizations, which are discrete (compare/swap steps, CA generations, Markov transitions, BFS ticks) and whose pedagogical subject is often *the algorithm itself* — "show me Euler's step, then RK4's step, side by side." The current 9-hook runtime (`init/start/pause/reset/update/render/setParameters/getState/getReadouts`) has no `step()`, no tick counter, no event log, no scrub/undo.

The result: today, building a sorting visualizer or a CA in SimCanvas means either (a) forcing discrete ticks into a `dt` accumulator — which makes scrub-to-tick, undo, and event logging awkward — or (b) silently dropping all correctness checks. Both are traps the project has fallen into before (the stagnant over-engineered `src/experiments/` track next to the leaner `public/simcanvas/` track is the same shape of "we'll retrofit it later" debt).

## 2. Goal

Give procedural / algorithmic simulations the **same symmetric treatment physics already gets**:

1. A **peer execution model** (discrete ticks + events) alongside the continuous `dt` model, plus a **hybrid** mode for continuous-motion-with-discrete-events (molecular dynamics, stepwise numerical integrators).
2. A **procedural correctness contract** mirroring `physics-correctness.md`: a step contract, a procedural model-tier classification, and **oracle checks** verifiable through `window.simulation.runModelChecks()`.
3. Coverage across the skill's **load-bearing surfaces**: routing in SKILL.md, the runtime contract in `implementation.md`, the design-gate (a "step narrative" alternative to "motion narrative"), the validator (a `data-model-tier="procedural"` track), the starter (a procedural variant), and evals (new procedural cases).

## 3. Non-goals

- **Not** building a shared runtime library in any host project. The zero-dependency single-file rule is non-negotiable; the step contract stays small enough to inline per artifact. No `_shared/step-runtime.js`.
- **Not** a library of canonical algorithm implementations. The user writes the algorithm; the skill provides the *contract* + *oracle harness* (decision B from brainstorming). No built-in sort/CA/BFS engines.
- **Not** chemistry-, biology-, or math-specific correctness references. This spec adds a *procedural/algorithmic* axis orthogonal to domain. A future `chemistry-correctness.md` (reaction stoichiometry, equilibrium constants) or a math-correctness reference (symbolic identity, convergence) would be separate specs on the *domain* axis. This spec is about the *execution-model and algorithmic-correctness* axis.
- **Not** touching the continuous-physics path. All changes are additive; no existing continuous sim is invalidated.

## 4. Design

### 4.1 Three execution modes (peer model)

SimCanvas's routing step classifies a simulation's **execution mode** up front, alongside the existing model-tier classification. Three modes:

| Mode | State advances by | "Speed" means | Primary hook | Example |
|---|---|---|---|---|
| `continuous` (existing) | `dt` seconds | wall-clock time compression | `update(dt)` | pendulum, RC circuit, projectile |
| `procedural` (new) | logical **tick** | ticks per second | `step()` | sorting, CA, Markov chain, BFS |
| `hybrid` (new) | `dt` underneath, **discrete events** fire on top | both | `update(dt)` + `step()` events | molecular dynamics, stepwise integrator (Euler vs RK4), particle collisions as events |

The mode is recorded in the artifact as `data-execution-mode="continuous|procedural|hybrid"` (a sibling to the existing `data-model-tier`). The validator recognizes all three values and enforces mode-appropriate hooks.

### 4.2 Extended runtime contract (additive)

The runtime contract in `implementation.md` is extended. The 9 existing hooks are unchanged. The following **optional, mode-gated** hooks are added:

```text
# Existing (unchanged) — all modes
init()
start()
pause()
reset()
update(dt)          # continuous + hybrid only
render()
setParameters(values)
getState()
getReadouts()

# New — procedural + hybrid only
step()              # advance exactly one logical tick; returns nothing
stepBack()          # optional: undo one tick (requires bounded history)
seekTo(tick)        # optional: scrub to an absolute tick index
getTick()           # return current tick index (integer ≥ 0)
getEvents()         # return the event log: what changed this tick
                    #   e.g. [{type:'compare', i:3, j:4}, {type:'swap', i:3, j:4}]
isDone()            # optional: true when the algorithm has reached its halting state;
                    #   enables the UI to stop and the oracle to assert postconditions
```

Rules:
- **Continuous sims omit every new hook.** No existing artifact breaks.
- **Procedural sims omit `update(dt)`** and drive `render()` from `step()` instead. `getTick()` and `getEvents()` are required for procedural + hybrid. `stepBack()`/`seekTo()` are optional (implement when the teaching value of scrubbing/undo justifies the history cost).
- **Hybrid sims implement both `update(dt)` and `step()`** — `update(dt)` advances continuous state; discrete events are logged and surfaced through `getEvents()`. The classic case: a numerical integrator where each `step()` is one Euler/RK4 step and the visual story is *the per-step error*, not smooth motion.
- The existing rule "Use `requestAnimationFrame` only as a scheduler" extends: in procedural mode, `requestAnimationFrame` schedules tick advancement at the configured ticks-per-second rate, accumulating fractional ticks between frames — *not* simulating continuous time.

### 4.3 `procedural-correctness.md` (new reference)

Mirrors the structure of `physics-correctness.md`. Contents:

**A. Procedural model-tier classification** — 5 tiers, parallel to physics's 6:

| Tier | When to use | Oracle requirement |
|---|---|---|
| `qualitative` | Process illustration with no claimed correctness (a "looks like a sort" demo). | None. Allowed to skip `runModelChecks()`. |
| `deterministic-trace` | Deterministic algorithm with a single correct output for a given input (sorting, BFS/DFS, expression evaluation). | **Output-equivalence oracle**: algorithm output equals a trusted reference over N random inputs. |
| `state-machine` | System characterized by legal transitions (finite automata, Markov chain transition matrix, CA rule table). | **Transition-legality oracle**: every step's transition is permitted by the rule table / transition matrix; reachable-states invariant holds. |
| `algorithm-with-invariants` | Algorithm whose correctness is a loop invariant (Dijkstra, merge sort, balanced-tree ops, divide-and-conquer). | **Invariant oracle**: invariant holds before/after each step; postcondition holds at termination. |
| `stochastic` | Randomized process (MCMC, randomized quicksort, genetic drift). | **Distributional oracle** (weaker): over many seeded runs, statistics match expected distribution within tolerance; OR deterministic-seed replayability (same seed → identical trace). |

**B. The step contract** — a precise definition of what `step()` must guarantee:
- Pure advance: `step()` moves the model from tick *n* to tick *n+1* and leaves `getTick()` consistent.
- Determinism rule: for tiers `deterministic-trace` / `state-machine` / `algorithm-with-invariants`, the same state + same `step()` call must always produce the same successor (no hidden `Math.random()` unless the tier is `stochastic` and seeded).
- Event logging rule: for tiers where the *process* is the lesson (not just the final output), `getEvents()` must return a structured, serializable log of what `step()` did, so the UI can highlight compare/swap/visit/flip transitions.
- Termination rule: for algorithms with a known halting condition, expose it (`isDone()` is added as a further optional hook) so the UI can stop and the oracle can assert postconditions at termination.

**C. Oracle checks via `runModelChecks()`** — exactly the same delivery surface physics uses, so SKILL.md §6 (validation) and the validator's existing `runModelChecks()` requirement generalize for free. Each tier specifies a concrete oracle recipe:

- `deterministic-trace`: generate N random inputs, assert `f(input)` deep-equals the reference (e.g. JS built-in `Array.prototype.sort` for a sort sim, NetworkX-style reference for BFS — inlined, single-file).
- `state-machine`: assert every logged transition is in the rule table; assert the set of reachable states from the initial state matches a BFS over the transition graph.
- `algorithm-with-invariants`: assert the invariant holds after every `step()` across a run; assert the postcondition holds once `isDone()`.
- `stochastic`: fix a seed; assert the trace is byte-identical on replay; optionally assert distribution statistics over 1000 runs within tolerance.

**D. Library routing** — parallels physics's Planck.js/Rapier/SymPy routing, but lighter:
- For `state-machine`/`algorithm-with-invariants` tiers, a build-time oracle can be expressed as an inlined reference implementation (the zero-dependency default).
- External libs (e.g. a graph-algorithm reference) are optional and task-scoped, same rule as physics libs. No new mandatory dependencies.

**E. Hard rule (procedural analog of SKILL.md line 144):**

> Never claim algorithmic correctness (correct output, legal transitions, invariant preservation, distributional behavior) without model checks against a reference implementation, transition rule, loop invariant, or seeded-replay/distribution oracle.

### 4.4 SKILL.md changes

Three surgical edits:

1. **§"Load only what the task needs"** — add a row:
   > Read [references/procedural-correctness.md](references/procedural-correctness.md) for algorithmic, rule-system, state-machine, stochastic, or discrete-step simulations — sorting, cellular automata, Markov chains, graph traversal, stepwise numerical methods, agent-based rules, or any system whose state advances by logical ticks rather than continuous time.

2. **§5 Implement the MVP** — extend the `runModelChecks()` requirement sentence (currently "For continuous, event/contact, rigid-body, or domain-solver physics…") to also cover procedural tiers: "For continuous/event/rigid-body/domain-solver physics **or for deterministic-trace / state-machine / algorithm-with-invariants / stochastic procedural models**, implement and pass model checks before binding the model to the scene."

3. **§"Non-negotiable rules"** — add the procedural-correctness hard rule from §4.3 E above.

4. **§"Route the task"** — add a one-line note that Create/Modify classification also tags the **execution mode** (continuous / procedural / hybrid), recorded as `data-execution-mode`.

### 4.5 `implementation.md` changes

Extend the "Runtime contract" section additively (per §4.2). Add a short "Execution modes" subsection above the runtime contract describing continuous/procedural/hybrid and when each applies, and note that `data-execution-mode` is a recognized attribute. Extend "Robustness" with: "For procedural and hybrid modes, bound the event-log and history growth; reject non-finite tick indices; guard `seekTo` against out-of-range targets."

### 4.6 Design-gate changes

`design-gate-template.md` currently requires a "motion narrative." Add a **"step narrative"** as a peer alternative: for procedural/hybrid sims, the gate describes the *teaching sequence of discrete events* ("tick 0: show initial array; tick 3: first compare highlighted; tick 7: first swap; tick N: sorted, postcondition visible") instead of continuous motion. `design-gate.md` gains a paragraph explaining when to use which.

### 4.7 Validator changes (`validate_simulation.py`)

- Recognize `data-execution-mode="continuous|procedural|hybrid"`. Default to `continuous` if absent (back-compat).
- Mode-gated hook enforcement:
  - `continuous`: existing 9-hook contract unchanged.
  - `procedural`: require `step`, `getTick`, `getEvents`; `update(dt)` optional.
  - `hybrid`: require `update(dt)`, `step`, `getTick`, `getEvents`.
- Extend the `runModelChecks()` requirement to procedural tiers (`deterministic-trace`/`state-machine`/`algorithm-with-invariants`/`stochastic`), mirroring how it's already required for quantitative physics tiers.
- Extend `data-model-tier` to accept the new procedural tier values (currently physics-only: `qualitative/analytic/continuous-ode/event-contact/rigid-body-engine/domain-solver`). The tier namespace becomes mode-aware: a sim sets *one of* the physics tiers *or* one of the procedural tiers (plus the shared `qualitative`).

### 4.8 Starter artifact (`starter/simulation.html`)

Add a second starter, `starter/simulation-procedural.html`, demonstrating a deterministic-trace algorithm (suggested: insertion sort on a small array) with: `data-execution-mode="procedural"`, `data-model-tier="deterministic-trace"`, the step/event hooks, and a `runModelChecks()` that asserts output-equivalence against `Array.prototype.sort` over N random arrays. The existing continuous starter is unchanged.

`create_simulation.py` gains a `--mode {continuous,procedural,hybrid}` flag (default `continuous`) selecting the starter template.

### 4.9 Evals (`evals/cases.json`)

Add at least 3 new procedural cases to the existing 7 groups × 3 structure (per the `validate_skill.py` "≥3 cases per group" rule). Suggested:
- One `trigger_positive` case: "visualize bubble sort" → should load `procedural-correctness.md`, set `data-execution-mode="procedural"`, require `runModelChecks()`.
- One `physics_correctness`-analog (rename-neutral: add to the existing group or a new `procedural_correctness` group) case: assert the skill mandates an output-equivalence oracle for a deterministic-trace sim.
- One `regression` case: a continuous-physics request must *not* trigger procedural mode or require the procedural contract.

### 4.10 `modeling.md` cross-link

Add one paragraph cross-linking to `procedural-correctness.md` for stochastic/rule-system models (which `modeling.md` already names), so the existing reference stops being a dead end for those model types.

## 5. Files touched / added

**New files (3):**
- `references/procedural-correctness.md`
- `assets/procedural-contract-template.md` (the procedural analog of `physics-contract-template.md` — step contract + oracle-cases table)
- `starter/simulation-procedural.html`

**Edited files (7):**
- `SKILL.md` (routing row, §5 runModelChecks sentence, non-negotiable rule, route-the-task mode note)
- `references/implementation.md` (execution-mode subsection, additive runtime hooks, robustness)
- `references/design-gate.md` (step-narrative vs motion-narrative)
- `assets/design-gate-template.md` (step-narrative field)
- `references/modeling.md` (cross-link to procedural-correctness)
- `scripts/validate_simulation.py` (execution-mode + tier + mode-gated hooks + runModelChecks for procedural)
- `scripts/create_simulation.py` (`--mode` flag + starter selection)
- `evals/cases.json` (≥3 new procedural cases)
- `references/evolution.md` (no edit expected — it already governs promoting new rules)

Total: ~3 new files, ~8 edited. All additive; no existing artifact invalidated; no host-project coupling.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Procedural tier namespace collides with physics tiers in the validator. | `data-model-tier` accepts the union; `data-execution-mode` disambiguates. Validator checks tier values are *legal for the declared mode*. |
| Hybrid mode is under-specified and gets mis-used as a dumping ground. | Hybrid requires *both* `update(dt)` and `step()`; validator enforces both. The reference doc gives exactly two canonical patterns (MD-with-events, stepwise integrator) and says "if your sim doesn't match one of these, it's probably not hybrid." |
| `stepBack()`/`seekTo()` history growth violates the "bound history" robustness rule. | Both hooks are explicitly *optional*; the reference doc states the history cost and says to omit them unless scrubbing/undo is a teaching requirement. |
| Author claims `qualitative` to dodge oracle checks for a sim that should be `deterministic-trace`. | The procedural-correctness reference includes a "tier discipline" note (parallel to physics): if the sim names a specific algorithm, it's at least `deterministic-trace` and the oracle is required. Reviewer/debug paths can challenge a mis-tiered sim. |
| Scope creep into domain references (chemistry-correctness, math-correctness). | §3 Non-goals names this explicitly. The procedural axis is orthogonal; domain-correctness references are future specs. |

## 7. Verification of the extension itself

Before calling the extension done:
1. `python3 scripts/validate_skill.py` passes (SKILL.md < 500 lines, links resolve, eval coverage ≥ 3 per group including new procedural cases, starter generates + validates).
2. `python3 scripts/create_simulation.py --mode procedural …` produces a valid artifact; `validate_simulation.py` accepts it and correctly enforces procedural hooks.
3. The existing continuous starter still validates unchanged (back-compat).
4. One procedural-correctness case from `evals/cases.json` behaves as specified when the skill is invoked against a "visualize insertion sort" prompt.

## 8. Out of scope (explicit)

- Any change to the `atomic_physics` repo's `public/simcanvas/` artifacts or their manifest.
- Chemistry, biology, or pure-math correctness references (future domain-axis specs).
- A shared runtime library in any host project (violates the zero-dependency single-file rule).
- Built-in algorithm implementations (decision B: contract + oracle, not an algorithm library).
- Touching the continuous-physics path or existing physics artifacts.
