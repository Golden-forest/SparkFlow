# Guangdong 2026: final two problems

- Q14: `public/simcanvas/jumping-robot-guangdong-2026/index.html` — Twin-Pendulum Jumping Robot.
- Q15: `public/simcanvas/charged-bead-parallel-plates/index.html` — Charged Bead Between Plates. Upgrades the existing entry and preserves its route.
- Home gallery: seven bilingual filters; disciplines partition all39 current assets; Exam Problems overlaps the two relevant discipline entries without duplication.

Both pages are self-contained offline HTML. Main scene, selected quantity, energy ledger, history and accessibility readout use one pure model. Event Before/After preserve identical physical time. Playback, pause, reset, scrub, checkpoints and optional equations are available. Changing Q15 k resets to its M-contact release if already in the changed-voltage part, otherwise resets to ramp start.

Q14 uses M=4 kg including two1 kg bobs, R=.4 m, v0=4 m/s, g=10 m/s². Bumper loss4 J, launch K4 J, rise .1 m, ground loss2 J. The first landing calculation ends at total loss6 J. The subsequent return to the bottom retains that loss and illustrates the bobs' continuing motion.

Q15 demo values are m=1 kg, d=.6 m, q=1 μC, g=9.8 m/s². The voltage-ramp timing is schematic and explicitly labeled. Two ropes length sqrt(2)d meet at90°; equivalent swing radius d. First M pre-contact single-rope tension2sqrt(6)mg/3 includes the centripetal term. Contacts reset speed and reverse charge. For0<k<1 maximum K lies inside the arc; for1≤k<3 at the plate. k=3 is a critical release; k>3 stops the arc model. Electrostatic charging/source energy beyond modeled mechanical work is outside scope.

Canonical checks (from repository root):

```sh
node scripts/simcanvas-exam/build.cjs
node scripts/simcanvas-exam/check.cjs
node scripts/simcanvas-exam/check-browser.cjs
npm run manifest
```

Production preview check (set SIMCANVAS_RELEASE_ROOT to the built release checkout):

```sh
SIMCANVAS_RELEASE_ROOT=/private/tmp/sparkflow-ball-spring-release node scripts/simcanvas-exam/check-gallery.cjs
```

The model check runs1797 invariant/reference checks and79 independent energy-quadrature snapshots with2e-6 s / m/s tolerances. Static SimCanvas validation accepts only the user-approved absent insight region; all other failures block. Browser checks cover quantities, event transitions, lifecycle, parameters and1440×900 /390×844 /844×390. They verify local artifacts and the isolated production build; protected online post-login behavior requires separate evidence.
