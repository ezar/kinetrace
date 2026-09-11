# Device matrix

Frame rate and pose confidence measured while running the real session screen, with
the camera preview on, for one 30 second front plank and one set of twelve glute
bridges.

| Device       | Browser | Model | Delegate | Median fps | Mean pose confidence | Notes             |
| ------------ | ------- | ----- | -------- | ---------- | -------------------- | ----------------- |
| _to measure_ |         |       |          |            |                      | maker's iPhone    |
| _to measure_ |         |       |          |            |                      | mid-range Android |
| _to measure_ |         |       |          |            |                      | laptop            |

The performance budget from the specification: 24 fps or more with `lite` on a 2022
mid-range Android, 30 fps with `full` on recent phones and laptops, cue latency under
300 ms, first interactive under 3 s.

## How to measure

1. `pnpm build && pnpm preview`, open the app on the device and run a routine.
2. The frame rate is the rate `requestVideoFrameCallback` delivers frames at; the
   pose confidence is `metrics.poseConfidence`, the mean landmark visibility of the
   torso and legs.
3. Record the model variant the app chose (Settings shows it) and whether the GPU
   delegate was used; the adapter falls back to CPU silently when it has to.

## The blocking question from the specification

Floor-level cameras and lying exercises reduce landmark confidence because of
occlusion and unusual angles. Before M1 is called done, measure confidence for the
supine and quadruped exercises with the phone on the floor. If `full` is not enough,
`heavy` is available on laptops and the affected exercises should declare a lower
`trackingConfidence` so the library says so.

Until these rows are filled in from real hardware, the numbers in the library were
tuned on synthetic landmark fixtures; see
`docs/decisions/0001-synthetic-fixtures.md`.
