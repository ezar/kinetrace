# 1. Fixtures are synthetic, and stored as recipes

**Status:** accepted · **Date:** 2025-09-11

## Context

The specification asks for `fixtures/landmarks/`: recorded landmark sequences of each
exercise performed well and with typical errors, with unit tests asserting repetition
counts, hold times and which rules fire.

Nobody has recorded those sequences yet. The engine still needs to be testable now,
and the thresholds in the library still need to be chosen from measured values rather
than guessed.

## Decision

Two kinds of fixture, materialised into the same `PoseFrame[]`:

- **`recorded`** carries real landmarks captured from a camera. This is the ground
  truth and the preferred kind.
- **`synthetic`** carries the recipe to rebuild a sequence from the exercise's own
  reference motion: the view, the frame rate, the number of repetitions, the noise
  seed, and the deliberate deviations that should trip a rule.

The starter library ships synthetic fixtures. They come from a kinematic body model
(`packages/engine/src/synth/`) that turns joint angles into the 33 MediaPipe
landmarks, in world and image space, with plausible occlusion and noise.

Synthetic fixtures are stored as the recipe rather than the landmarks: a few hundred
bytes that a reviewer can read, instead of a megabyte of numbers they cannot.

## Consequences

- The engine has tests today, and the thresholds in the library were tuned against
  measured ranges and velocities rather than intuition.
- One model produces the animated demos, the fixtures and the tests, so an exercise
  authored once behaves the same in all three.
- Synthetic landmarks are cleaner than real ones. They cannot show whether the pose
  model loses a hip in a supine position, whether visibility collapses with the phone
  on the floor, or how much a real person wobbles. Those questions stay open until
  `docs/devices.md` is filled in from real hardware.
- The tuned thresholds are therefore provisional. Recorded fixtures replace the
  synthetic ones exercise by exercise; the tests do not change when they do.
