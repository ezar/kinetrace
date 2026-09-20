# 8. A routine transcribed from a published programme

**Status:** accepted · **Date:** 2026-09-20

## Context

ADR 7 ended with a hole left open on purpose. Every dose in the library is
`authored` — written by hand, with no source — and the provenance value
`clinical` was deliberately not created, because "a number taken from a clinical
source has to name it, and adding the value before there is a citation to go
with it is exactly how an authored number ends up looking sourced. When a real
one arrives, the value and the citation arrive together."

One arrived: a four page patient programme for the lumbar spine published by
the Sociedad Española de Rehabilitación y Medicina Física, ten exercises, each
with a drawing, an instruction and a printed dose.

It arrived alongside a question that turned out to be the more interesting one:
whether the order of the app's back routine was right. It is not the document's
order — the document puts the cat-camel ninth of ten and the app puts it first —
and the honest answer was that the app's order never came from anywhere. The
comment on `DEFAULT_ROUTINE_IDS` says as much: "the maker's current back
routine".

Two things about the document matter as much as its contents.

**It prescribes nothing to anybody.** It has no name on it, no signature, no
frequency, no progression and not one word about pain. It is a printed sheet a
professional society publishes for professionals to hand out.

**Most of it was not in this library.** Seven of the ten steps had no exercise
here, and five of those seven had something with a similar name doing a
different movement: the sheet's curl-up lifts the trunk 25 cm with the hands on
the floor, while the library's is McGill's with the hands under the lumbar
spine; the sheet's prone extension lifts the trunk itself, while the library's
is an arm-driven press-up; the sheet's step 10 raises an arm, then the opposite
leg, while the library's bird dog raises both at once.

Two of those five were matched in the first version of this work and had to be
taken back out, which is why they are worth naming.

- The sheet's **pelvic tilt** asks for the glutes to lift 1-2 cm off the floor.
  The library's pelvic tilt is the same joint doing less, and its fourth
  instruction says so in as many words: the hips never leave the floor. Matched,
  it put that instruction on screen directly underneath a quotation asking for
  the opposite.
- The sheet's **lower abdominals** lift the legs, ten times, under their own
  muscle. The library's double knee to chest is a sustained stretch the arms
  pull into and hold. The tell was the shape of the dose: ten repetitions only
  became ten holds because the movement underneath had already been swapped.

Both were matched on their titles. Neither reading survived opening the library
file and reading its own instructions next to the quotation.

Matching those pairs would have produced a tidy ten of ten, or a respectable
five, and a routine that was not the document.

## Decision

Published programmes are transcribed as data, and a routine can name one.

- **`packages/exercises/src/programmes.ts` holds the transcription.** Every step
  keeps its printed number, its own title and its own instruction, verbatim and
  untranslated: they are a quotation, not UI copy, so ADR 3 does not apply to
  them and the dictionaries do not carry them.
- **A step is matched only when the library has that exercise.** The other seven
  stay in the list with a reason — `notInLibrary`, or `differentExercise` with
  the id that was rejected — and the routine screen shows them. A programme the
  app can only partly run says so on the part it runs. The test that keeps this
  honest is the narrow one: a programme may never prescribe an exercise that the
  same programme refuses by name somewhere else.
- **The citation covers a number only while it is that number.** A routine that
  cites a document keeps saying so after somebody edits a dose or a professional
  signs it, and in both cases the sentence changes: the citation becomes where
  this came from rather than what it says. Nothing is stored to track that — the
  transcription is right there, so the comparison is made against it.
- **Printed holds become tempo, not prose.** "Mantener 5 segundos" is a pace on
  the phase that hold belongs to, which the engine already checks (ADR: the
  tempo monitor). Where the library counts an exercise in time rather than
  repetitions, the printed repetitions become that many holds run together.
- **Where the document is silent the routine is silent.** It prints no rest
  anywhere, so every entry rests zero rather than borrowing the library's
  authored rest. The one place a range had to become a number — a stretch
  printed as 10-30 seconds — takes the bottom of it and carries the printed
  instruction alongside, so the other end is never lost.
- **`Routine.source` is a citation, deliberately not a `review`.** A document is
  not a professional who looked at this person and signed. A transcribed routine
  is unsigned like any other, the review screen goes on saying so, and the panel
  on the routine screen says in as many words that these numbers are copied from
  a document rather than prescribed to the reader.
- **`RoutineExercise.sourceNote` carries the document's instruction**, shown
  under the dose, so the numbers on the card can be checked against the paper
  without leaving the screen.

## Consequences

- The first numbers in this app with a source anybody can look up. They are also
  visibly not the library's, which is the point: two routines can now sit side
  by side and say where each came from.
- The library's own doses are untouched and still `authored`. Nothing here
  promotes them, and the exercise-level `clinical` provenance value still does
  not exist, because a programme is not a library.
- The gap between the paper and the app is a product feature rather than an
  omission. The missing steps are things worth asking a professional about, and
  they are listed where somebody will read them. Three of ten was a
  worse-looking number than five of ten and a truer one, and the screen that
  shows it is the screen where that matters.

## Addendum: writing the exercises the document describes

Four of the seven gaps were closed the only way that does not bend the
document — by writing the exercise it describes, rather than pointing it at
something adjacent. `active-double-knee-raise`, `supine-trunk-curl` and
`prone-trunk-extension` are the document's steps 2, 3 and 6, and each one is
the honest counterpart of a library exercise that was rejected above: the
active knee raise to the sustained stretch, the trunk curl to McGill's, the
trunk extension to the press-up. `side-lying-leg-raise` is step 7, and it
needed a metric first. The programme now runs seven of its ten steps.

Two things learned in the writing are worth keeping:

- **A pace rule has a ceiling, and it is the filter's rather than the body's.**
  The engine estimates velocity through a one-euro derivative, so a movement of
  sixteen degrees cannot read much above 28 deg/s however fast it is thrown.
  The prone extension's first pace threshold was set by analogy with a larger
  exercise and could never have fired. A rule that cannot fire is worse than no
  rule, because the library looks like it is watching something it is not. Each
  threshold here is a multiple of what its own reference motion produces, with
  a fixture that trips it and a good variant that stays silent.
- **Measure the joint the mistake actually moves.** The rule that keeps the
  prone extension from becoming a press-up first watched the elbow, which says
  nothing when the arms already rest straight beside the body. What a press-up
  needs first is the hands coming up beside the chest, which is the shoulder.

**Step 7 needed a metric, and the metric taught two things.** `hipAbduction` is
the leg's counterpart of `shoulderAbduction`, measuring leg elevation in the
frontal plane, and it is the first metric here that had to be measured against
the trunk's own axis rather than the same-side shoulder-to-hip diagonal the arm
metrics use. That diagonal leans inwards by however much wider somebody's
shoulders are than their pelvis — a few degrees of the arm's 180 degree range,
but a few degrees of the hip's forty-five, varying from person to person.
Against the trunk axis a leg in line with the body reads zero whoever it
belongs to, and reads the same lying down as standing.

The second thing was in the harness rather than the maths. A unilateral
exercise is measured on the limb the prescription names, and `toRunnerConfig`
has taken that side since side planks were added. Nothing that replays a
_reference motion_ was passing it: the fixture builder and the phase timeline
both fell through to `auto`, which picks the limb the camera sees better. For
every unilateral exercise in the library until now that happened to be the limb
doing the work. For a leg lifting off a stacked pair it is a coin toss, and it
came up wrong: the fixture measured the leg resting on the mat and counted no
repetitions at all. `referenceSide` now reads the worked limb off the motion's
own keyframes, and both replayers use it.

The three steps still missing are the ones with real obstacles rather than
absent files: a cross-body curl and a supine lumbar rotation both need
`thoracicRotation` and so the front, where a supine body has no length; and the
last step raises one limb at a time where the library's bird dog raises two.

The pelvic tilt is a fourth, of a different kind: the document and the library
agree on the joint and disagree on how far it travels. Closing that one means
deciding whether it is one exercise or two, which is a question for a
professional rather than for this file.

- Adding the missing exercises is a separate job with a higher bar: thresholds
  in this library are derived by running the engine over a reference motion
  (ADR 7), and authoring them by hand to close a gap would trade one honest
  absence for five dishonest presences.
