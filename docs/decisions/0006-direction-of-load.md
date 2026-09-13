# 6. Exercises say which way they load the lower back

**Status:** accepted · **Date:** 2026-09-13

## Context

Half the starter library targets the lumbar spine, and until now nothing in an
exercise said which way it moved it. `area: 'lowerBack'` says where; `position:
'supine'` says how you start. Neither distinguishes an exercise that deliberately
reduces the lumbar curve from one that deliberately increases it, though the
library contains both and they sit next to each other in the same filter.

That gap shows up in three places:

- **The library** cannot be browsed by it, so somebody assembling a routine sees
  seventeen exercises with no way to tell the directions apart.
- **The review screen** shows a professional every number of every exercise, one
  exercise at a time, and says nothing about the routine as a whole. A routine
  whose exercises all pull the same way does not announce itself as a group.
- **The sheet import** proposes a routine from a photograph. Whatever it proposes,
  the reviewer is looking at a list with this property invisible.

The obvious temptation is to go further: hold the direction, decide which one a
given person needs, and have the app select or warn. That is a clinical decision
about a body the app has never examined, and the whole project is built on not
making it — see ADR 5, and the sentence on every screen that shows a range.

## Decision

A required field, and nothing that acts on it.

- `spinalLoad: 'flexion' | 'extension' | 'rotation' | 'neutral' | 'mixed'` on the
  exercise definition, alongside `area` and `position` and of the same kind: a
  **mechanical description of the movement**, not a recommendation. `neutral` is
  the largest group and means the lower back is asked to hold still while
  something else moves, which is what most of the stability work is for.
- **Required, not optional.** An optional field is how a library ends up with half
  of them blank, and a property that is only sometimes present cannot be filtered
  or counted. The validator rejects a value it has no name for.
- The **library** filters on it. The **review screen** shows it per exercise and
  counts the routine's mix — `spinalLoadMix` returns counts in a fixed order and
  leaves out directions nobody prescribed.
- **Nothing selects, warns, reorders or excludes by it.** The counting function
  documents that in its own header, and a test asserts the counts and nothing
  else. The app's job here is to make a property visible to the person qualified
  to weigh it.

## Consequences

- Seventeen exercises now carry a judgement about their mechanics, made by reading
  the movement each one already describes. They are as provisional as the target
  bands and the cue dictionary, and belong on the same list of things a
  physiotherapist has yet to go through.
- Two of them took a decision worth writing down. `mcgill-curl-up` is `neutral`,
  not `flexion`: the exercise is built to keep the lumbar curve — hands under the
  low back, "your lower back never flattens" — so the flexion happens above it.
  `glute-bridge` is `neutral` for the same kind of reason: the movement is hip
  extension, and the cue when the lumbar spine joins in is to lower the hips.
- `cat-camel` is the only `mixed` exercise in the library. A single value cannot
  say that a repetition passes through two directions, and splitting the field
  into a per-phase property would push a clinical distinction into the phase
  machine, which exists to count.
- The field describes the **lumbar** spine specifically, which is why a thoracic
  rotation is `rotation` rather than something more precise. A library that grows
  past the lower back will need this revisited rather than extended.
