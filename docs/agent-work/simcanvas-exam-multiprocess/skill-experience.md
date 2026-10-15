# SimCanvas skill experience: Q14 / Q15

These observations were recorded at the original release, when the shared skill was unchanged. The 2026-10-13 correction below supersedes its presentation assessment; see ../simcanvas-intent-revision/progress.md for the installed skill update.

## Useful existing guidance, demonstrated here

- Physics contract before scene implementation: exact bodies (M includes bobs), double-rope geometry, charge sign and collision conditions prevented misleading simplifications. Explicit event models are enough for these textbook problems; a rigid-body engine would add approximation without helping the lesson.
- One authoritative state: scene, quantities, energy ledger, history and event snapshots derive from the same trajectory. Pausing freezes their state and SVG output together. Controls seek the model rather than driving separate visual tweens.
- Model-first and independent oracle: both trajectories pass independent energy quadrature. The previously existing Q15 self-test passed an incorrect first-impact tension assumption; checking the document answer and the centripetal term revealed it. A passing test is useful only if its expected answer is independently justified.
- Scene-first composition, native SVG and offline single-file output work for these two different apparatuses. Exact SI arithmetic and slowed playback coexist with an illustrative quasi-static ramp.

## Concrete gaps and where a fix belongs

| Observed issue | Candidate improvement | Proposed location / evidence |
|---|---|---|
| Required insight region conflicts with approved minimal-text layout; validator rejects otherwise complete output | Validate the accepted layout contract, permit an explicitly omitted optional interpretation region | Layout contract and validator; this project explicitly accepts only that exact failure |
| Regex runtime inspection stops at the first nested object brace, missing real getReadouts/runModelChecks hooks | Parse runtime shape or execute a sandboxed browser contract check instead of relying solely on regex | Validator regression fixture; shorthand named getters work here but syntax should not determine correctness |
| Multi-process questions need instantaneous before/after states at identical time | Add a conditional event-contact recipe with pre/post snapshots, ordered nodes, bounded history and scrub semantics | Physics reference and examples; demonstrated in both Q14 impacts and Q15 contacts |
| One mechanical-energy curve hides collision loss or electric work | Choose an energy ledger from the actual system boundary: E+loss=initial energy, or E+loss=external work | Pedagogy / physics reference; do not universally claim mechanical conservation |
| Existing Q15 tests omitted low-k interior maximum, and confused static tension with moving-ball tension | Require oracle coverage of each subquestion and thresholds; annotate symbolic/demo values | Physics contract checklist / an exam eval, not a Guangdong-specific core instruction |
| Two physical ropes can be misread as one in a side-view swing | Preserve apparatus topology, label projection, supply rope-plane inset when necessary | Reference fidelity / visual teaching guidance; Q15 has exact90° rope-plane inset |
| Desktop evidence initially overflowed behind footer | Check actual hit targets and non-overlap, not only DOM presence or positive scene size | Browser validation; fixed with compact selector and controls in bottom dock |
| Gallery taxonomy is separate from a single simulation's model | Add platform guidance for discipline + overlapping topic filters, bilingual entry names, preserving old URLs | Host-platform adapter; do not put gallery implementation into the universal simulation workflow |

## Scope of possible skill update

Keep core SKILL.md concise. Most proposed changes belong in conditional references and executable validation. Start with a small event-contact example and two regression cases (robot impact; charged bead low-k peak) after the user reviews these delivered animations. Avoid a universal phase engine or additional mandatory prose panels.

## Scientific presentation boundaries

Q14 uses prescribed ideal bumper and ground impacts. Requested 6 J loss is measured at first landing; extra bob return is labeled as a later stage and adds no loss. Q15 ramp duration is schematic; dynamic sweeps use calculated time and demonstration SI parameters, since the original gives only symbols. k=3 is shown as a critical zero-tension release, separately from the source answer's strict0<k<3 range; k>3 stops the circular-constraint demonstration instead of inventing negative rope tension or constrained motion.

## Teacher correction · 2026-10-13

The main failure was content selection, not missing controls or inaccurate energy bookkeeping. Inheriting an earlier energy lesson's dashboard hid which subquestion was being answered and displaced the actual derivation. A correct trajectory and passing browser checks do not prove that the animation supports the teacher's task. An energy ledger is appropriate only when that question asks about energy or requires it for reasoning; adding more accurate generic panels does not solve the mismatch.

The installed update now requires a proportional intent-to-presentation plan, separate coverage for every subquestion, complete applicable equations and source values when derivation is requested, and proactive omission of unused charts/insight/sidebars. The starter and static validator no longer impose those panels. Independent trial plans selected different evidence for exam derivation, pulse superposition and stopping-distance comparison. This verifies workflow behavior on those cases, not the classroom acceptance of the still-proposed exam redesign.

## Additional walkthrough implementation experience

- Reusing a verified trajectory kernel with a small question-interval adapter avoids duplicating physics. New question modes still require explicit start/end sides: Q14.1 ends after impact, Q15.2 ends before contact. Playback, checkpoint jumps and reset must agree on those sides.
- The active question and sampled physical state are different concepts. A before/after comparator can cross the selected interval at the same time. Label previous/next interval snapshots explicitly, clear the current question's equation highlight there, and keep invalid future constraints blocked even while displaying a preceding valid snapshot.
- Highlight the applicable equation, not a universal step index. The derivative-equals-zero condition identifies an interior maximum; it must not remain highlighted at a non-stationary endpoint maximum or an excluded critical parameter branch.
- Presentation transitions can temporarily contradict a correctly updated model: fading equation highlights lagged behind instantaneous SVG/event changes. Removed those fades rather than hiding the mismatch with screenshot delays.
- Complete derivations need intentional space. The five-equation third part works with a compact branch summary above the chain; a redundant generic result footer displaced the last equation and was omitted for that part only.
- Preservation is independently checkable: the release check compares all old asset hashes and gallery entries, not merely whether two old cards are still visible. The additional version was published without releasing unrelated dirty workspace/account changes.

The two additional walkthroughs now pass the six-part coverage and representation checks and are deployed. Source/physics/runtime capabilities were reusable; classroom intent selection, boundary context and applicable-equation mapping needed explicit decisions. No general learning-effect claim follows from these checks.

## Combined playback experience

- A lesson needs both a continuous overview and independent question inspection. The same verified state supports both; only traversal and equation selection change. Add the mode controls to the existing dock instead of expanding the main layout.
- Questions are not necessarily sequential phases. Q14's third question overlaps the first two. A full overview must traverse the source curve once and show overlapping coverage, rather than concatenating three question clips.
- Automatic pre/post contact holds reduce teacher interaction while keeping instantaneous physical changes exact. Presentation holds and cycle resets must not be mistaken for elapsed physical time or an additional physical impulse.
- Loops need explicit endpoint behavior: pause/resume must preserve a pending hold, disabling a terminal loop must stop there, and invalid constraints must stop without replaying fictitious motion. These are browser-testable invariants.
- Continued motion beyond an answer interval can aid the overview, but it must clear that question's active equations and carry a continuation label. Do not let an earlier maximum marker or a signed vertical-speed label misdescribe later motion.

These controls serve this teacher's requested lecture flow. They do not establish a universal requirement for every SimCanvas animation to loop or show a question selector.
