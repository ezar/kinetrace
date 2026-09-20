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

**Half of it is not in this library.** Five of the ten steps have no exercise
here, and three of those five have something with a similar name doing a
different movement: the sheet's curl-up lifts the trunk 25 cm with the hands on
the floor, while the library's is McGill's with the hands under the lumbar
spine; the sheet's prone extension lifts the trunk itself, while the library's
is an arm-driven press-up; the sheet's step 10 raises an arm, then the opposite
leg, while the library's bird dog raises both at once.

Matching those pairs would have produced a tidy ten of ten and a routine that
was not the document.

## Decision

Published programmes are transcribed as data, and a routine can name one.

- **`packages/exercises/src/programmes.ts` holds the transcription.** Every step
  keeps its printed number, its own title and its own instruction, verbatim and
  untranslated: they are a quotation, not UI copy, so ADR 3 does not apply to
  them and the dictionaries do not carry them.
- **A step is matched only when the library has that exercise.** The other five
  stay in the list with a reason — `notInLibrary`, or `differentExercise` with
  the id that was rejected — and the routine screen shows them. A programme the
  app can only half run says so on the half it runs.
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
- The gap between the paper and the app is now a product feature rather than an
  omission. Five missing exercises are five things worth asking a professional
  about, and they are listed where somebody will read them.
- Adding the missing exercises is a separate job with a higher bar: thresholds
  in this library are derived by running the engine over a reference motion
  (ADR 7), and authoring them by hand to close a gap would trade one honest
  absence for five dishonest presences.
