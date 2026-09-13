# Contributing to Kinetrace

Thank you for considering it. The most useful contribution is usually a new
exercise, and that should never require touching the engine.

## Ground rules

- Code, comments, identifiers, commits and docs in **English**. User-facing copy and
  cues live only in dictionaries (Spanish first, English second).
- TypeScript strict everywhere, workers included. No `any`.
- Units in JSDoc on every numeric parameter and DSL field: degrees, seconds, metres,
  frames per second.
- Every algorithm gets a unit test on landmark fixtures before it gets a UI.
- Conventional commits.
- Nothing that encourages pushing through pain, and no claim Kinetrace can diagnose
  anything. The pain check-in is the user's own note and is never an input to logic.

## Getting set up

```bash
pnpm install
pnpm models:fetch     # pose models into apps/web/public/models
pnpm verify           # format, lint, typecheck, tests
pnpm dev
```

## Adding an exercise

An exercise is one file of typed data in
`packages/exercises/src/library/<id>.exercise.ts`, validated at build time and
covered by a fixture. Copy the closest existing file and work through the fields.

### 1. Identity and filters

```ts
id: 'glute-bridge',                     // kebab-case, stable, used as a database key
names: { es: 'Puente de glúteos', en: 'Glute bridge' },
synonyms: { es: ['puente', 'puente de cadera'], en: ['bridge', 'hip raise'] },
area: 'lowerBack',                      // library filter
position: 'supine',                     // library filter and camera guidance
spinalLoad: 'neutral',                  // what the lumbar spine is asked to do
equipment: 'none' | 'mat',
provenance: { targets: 'derived', dose: 'authored' },
```

Synonyms matter: they are what the sheet import matches a physiotherapist's wording
against, in both languages.

`spinalLoad` is `flexion` (the lumbar curve is deliberately reduced or reversed),
`extension` (deliberately increased), `rotation`, `neutral` (the lower back holds
still while something else moves, which is most of the stability work) or `mixed`
(the repetition passes through more than one). It is a **mechanical description of
the movement**, in the same family as `area` and `position`. The library filters on
it and the review screen counts it, so a professional can see which way a routine
leans; nothing in the app selects, warns or reorders by it, and it is not a
recommendation.

`provenance` says where your numbers came from, one value per family:
`derived` if you read them off `pnpm replay` running the engine over your own
reference motion, `authored` if you wrote them down. **Use `authored` for the
dosage.** No clinical guideline gives sets or repetitions for low back pain —
dosage is individualised by design — so `authored` is the accurate answer, not
an admission. The review screen and the library screen both say it out loud, and
a number that claims more than it has is worse than one that claims nothing.

### 2. How it is done

```ts
howTo: {
  es: ['Túmbate boca arriba con las rodillas dobladas…', '…'],
  en: ['Lie on your back with your knees bent…', '…'],
},
```

Required, in both languages, and the validator refuses fewer than two steps, a blank
one, or two languages of different lengths. These are shown before an exercise
somebody has not done and on the library screen.

Describe the movement the rest of the file already encodes — the starting position,
the phases, what moves and what does not — in the words a person needs rather than
the numbers the engine needs. **No dosage and no clinical advice**: a
physiotherapist's instructions replace them, and `physioNote` on the routine is
where those go. Like the cues, they want a professional's eye before they ship.

### 3. The view

```ts
view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
cameraTipKey: 'tip.floorSide',
```

The setup assistant blocks the session until the camera actually shows what the
metrics need, so declare the view the exercise is really measured from.

### 4. Metrics

Metric slots are names your phases and rules refer to:

```ts
metrics: {
  hip: { id: 'hipFlexion', side: 'auto' },
  line: { id: 'trunkLineDeviation', side: 'auto', options: { distal: 'knee' } },
},
primaryMetric: 'hip',
```

`side` is `left`, `right`, `auto` (the side the camera sees better, with hysteresis)
or `mean`. Add `absolute: true` for signed metrics whose sign only says which way.

Every metric is an **interior joint angle in degrees**: 180 degrees means the
segments are in line — a straight knee, an extended hip — and the angle decreases
with flexion. Run `pnpm replay <fixture> --metrics` to see the range a movement
actually produces before you pick thresholds.

### 5. Phases and targets

Phases form a cycle. The machine only advances to the next phase, and only once its
condition has held for `minDwellMs`, which is what keeps jitter from counting.

```ts
phases: [
  { id: 'rest', when: { below: 140 }, minDwellMs: 200 },
  { id: 'top', when: { above: 148 }, minDwellMs: 500 },
],
targets: {
  direction: 'increase',              // which way a good repetition moves the metric
  band: { min: 165, max: 185 },       // the physio's target
  safety: { min: 80, max: 200 },      // outside this, the engine says stop
},
```

Put the phase threshold clearly **below** the target band (or above it, for
`decrease`). A repetition that completes the cycle without reaching the band is
reported as a partial with the value it reached; one that never crosses the phase
threshold is not seen at all.

### 6. Rules

A rule is a condition over metrics that must hold for `sustainMs` before it proposes
a cue, and that cannot fire again for `cooldownMs`:

```ts
rules: [
  {
    id: 'hipsSagging',
    priority: 'form',                 // 'safety' | 'form' | 'encouragement'
    when: { metric: 'line', above: 12 },
    sustainMs: 1000,
    cooldownMs: 4000,
    cueKey: 'cue.liftHips',
  },
],
```

Conditions can read `value`, `absValue`, `velocity`, `absVelocity`, `stability` and
`confidence`, and combine with `all`, `any` and `not`.

Cue keys must exist in `packages/exercises/src/dictionary.ts`, in both languages.
Cue writing rules: under six words, imperative, and always what to do rather than
what is wrong. "Lift your hips", never "your hips are low".

### 7. The reference motion

A handful of keyframes of joint angles. The library animates it, the fixture builder
turns it into landmarks, and the tests run the engine over it:

```ts
reference: {
  posture: 'supine',
  cameraSide: 'left',
  cycleSeconds: 4,
  base: { kneeAngle: 90 },
  keyframes: [
    { t: 0, pose: { hipAngle: 128, trunkAngle: 0 } },
    { t: 0.45, pose: { hipAngle: 172, trunkAngle: -20 } },
    { t: 1, pose: { hipAngle: 128, trunkAngle: 0 } },
  ],
},
```

Angles follow the same convention as the metrics. `trunkAngle` leans the trunk in
the sagittal plane, `trunkLateral` bends it sideways, `trunkRotation` and
`pelvisRotation` turn the shoulder and hip lines, `hipAbduction` and `kneeSplay`
move limbs out of the sagittal plane.

### 8. A fixture, and the numbers behind it

Add a good variant and at least one variant that should trip each rule, in
`scripts/fixtures/variants.ts`. A good variant is generated for every exercise
automatically and must count every repetition with **no** corrective cue.

```bash
pnpm fixtures:build
pnpm replay glute-bridge --metrics      # ranges, velocities, cues, repetitions
pnpm test                               # the expectations in the fixture are asserted
```

Fixtures are stored as the recipe that rebuilds them, not as megabytes of landmarks,
so they stay reviewable. Recorded fixtures from a real camera are also supported and
are more valuable; see `docs/decisions/0001-synthetic-fixtures.md`.

## Adding a metric

If an exercise cannot be expressed in the DSL, the DSL is missing a primitive. Add it
to `packages/engine/src/metrics/definitions.ts` with:

- the landmarks it needs, so the setup assistant can check them,
- its preferred view,
- a doc comment saying what the sign and the units mean,
- a unit test in `packages/engine/src/__tests__/metrics.test.ts` that measures a pose
  built from the body model and asserts the value.

Then add the exercise.

## Pull requests

- `pnpm verify` green, and `pnpm test:e2e` if you touched the app.
- One milestone or one exercise per pull request.
- If you deviate from `docs/` or from the specification, add a short decision record
  in `docs/decisions/`.
- Default ranges must be marked as defaults everywhere they appear. If you are not a
  physiotherapist, say in the pull request where your numbers came from.
