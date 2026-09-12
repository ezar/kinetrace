# 5. The app checks the professional's numbers, and never overrules them

**Status:** accepted · **Date:** 2026-09-12

## Context

Every screen that shows a target range carries the same sentence: these are defaults,
and your physiotherapist's numbers replace them. Until now there was nowhere to do
that except two unlabelled number inputs in the routine builder, with no validation,
no safety limits, no record of who set them, and no way to see what the app would say
to the patient.

A prescription can also be wrong in a way that is invisible from the two numbers
alone. A repetition is only counted once the movement crosses the threshold that
opens the exercise's top phase; the target band then decides whether that repetition
was _good_. Set the band below that threshold and every repetition is good the moment
it is counted. Nothing looks broken. The app simply stops measuring anything.

## Decision

A review screen, and a validator behind it.

- `reviewPrescription(exercise, prescription)` returns **codes**, not text, like
  everything else the engine and the library hand to the app. Thirteen of them: the
  arithmetic (inverted ranges, a target the safety stop would interrupt, an angle
  the metric cannot express), and the two that need to know how the engine counts —
  a band entirely on the far side of the counting threshold, and a band that no
  longer discriminates because it sits below it.
- **Errors block the signature. Warnings never do.** The professional is the
  authority on the person in front of them; a target a long way from our default may
  be exactly right after surgery. The app's job is to be certain they are looking at
  what they are signing, not to have an opinion about it.
- Metrics now declare the range they can physically report, so a target nobody could
  reach is caught rather than accepted.
- The signature is `{ by, at, note }` stored on the routine. It is a record that
  somebody sat down and checked, **not an authentication**: there are no accounts in
  Kinetrace and there is no way to prove who typed a name.

## Consequences

- The promise on every library screen now has something behind it.
- Writing the validator found two exercises in the starter library whose safety stop
  bracketed the whole measurable range and could therefore never fire: `wall-angels`
  (0 to 185 degrees of shoulder abduction, which is measured 0 to 180) and
  `thoracic-rotation-quadruped` (0 to 100 on a magnitude that stops at 90). Both now
  declare no safety stop, which is what they always meant.
- A band with an open-ended maximum — the glute bridge's 165 to 185 on a joint angle
  that stops at 180 — is idiomatic, not a mistake: for an exercise judged on going
  further, only the minimum is binding. The validator checks the binding end only.
- The engine now honours a safety stop set per person, which it previously ignored:
  `toRunnerConfig` took a band but not a safety range.
- None of this can tell whether a range is clinically right. It can only tell whether
  the engine can act on it. The ranges in the library remain provisional until a
  physiotherapist has been through them, which is now something the app can record.
