# 7. Every number says where it came from

**Status:** accepted · **Date:** 2026-09-13

## Context

Somebody asked whether the repetitions and hold times in the library were right.
Going to look for the answer turned up two facts, and the second one was worse
than the first.

**The two families of numbers have different histories.** The commit that
created the library says of the angles: "Thresholds were not guessed: each one
was read off the replay tool running the engine over that exercise's own
reference motion." Phase thresholds, target bands and safety stops were derived,
which is why the thresholds sit clearly below the bands and the pace rules sit
just above the velocity a correct tempo produces.

Nothing of the kind is true of the dosage. Sets, repetitions, hold seconds, rest
seconds and the library's one declared tempo were written down by hand. There is
no ADR, no test, no line of documentation and no commit message that justifies a
single one of them.

**And no clinical guideline would supply them.** A 2024 systematic review in the
Journal of Science and Medicine in Sport is titled "Clinical guidelines are
silent on the recommendation of physical activity and exercise therapy for low
back pain", and reports that no guideline gives dosage, intensity or frequency.
NICE NG59 recommends exercise programmes and says the type should take a
person's specific needs, preferences and capabilities into account. Dosage is
individualised on purpose; it is not a number a library can look up.

Meanwhile the app shows an angle and a repetition count in the same typeface, on
the same card, and the two look equally well founded.

## Decision

Exercises declare where their numbers came from, and the app says so.

- `provenance: { targets, dose }` on the exercise definition, each `derived`
  (read off the engine running over the reference motion) or `authored`
  (written by hand, with no source). Required, and the validator rejects a value
  it has no name for. All seventeen are `{ targets: 'derived', dose: 'authored' }`
  today, which is the truth.
- **There is deliberately no `clinical` value yet.** A number taken from a
  clinical source has to name it, and adding the value before there is a
  citation to go with it is exactly how an authored number ends up looking
  sourced. When a real one arrives, the value and the citation arrive together.
- **The review screen says it, while the routine is unsigned.** Above the gauge:
  where the angles came from. Above the dosage fields: that nobody set these,
  that the guidelines do not supply them, and that until the professional does
  they belong to nobody. The moment the routine is signed the lines go away —
  somebody has taken responsibility for every number on the card.
- **The library screen always says it**, because a library is never signed.

## Consequences

- The honest answer to "are the repetitions right?" is now in the product rather
  than in somebody's memory of a commit message.
- This is the third thing in this repository to be given a provenance rather
  than a defence: the fixtures are declared synthetic (ADR 1), the metrics are
  declared proxies (ADR 2), and the dosage is now declared unsourced.
- It makes the dosage fields on the review screen the point of that screen
  rather than a footer to it. They were always editable; they were not always
  obviously **unanswered**.
- Nothing here improves a single number. It stops them being mistaken for
  something they are not, which is the only improvement available without a
  physiotherapist.
