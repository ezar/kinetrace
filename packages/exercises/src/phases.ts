/**
 * When, inside one repetition, each movement begins.
 *
 * The exercise DSL declares phases as *conditions* on a metric — "the cat phase
 * is spine flexion below 84 degrees" — which is what the repetition machine
 * needs in order to count, and which says nothing about when in the cycle that
 * happens. The voice needs the other thing: a moment, early enough that "round
 * your back" still has a back to round.
 *
 * Rather than have somebody write the order down a second time, it is derived.
 * The reference motion is synthesised into landmarks and run through the same
 * metric evaluator a camera session uses, so the figure on screen and the voice
 * cannot drift apart: they are the same keyframes.
 *
 * Two things the derivation is careful about, both learned by looking at the
 * numbers it produced:
 *
 * - **A phase band is not a position.** The bands are narrow on purpose, with a
 *   gap between them, so that jitter never counts as a repetition. The glute
 *   bridge only enters the `top` band when the hips are already well up — far
 *   too late to be told to lift them. So the mark is walked back from the band
 *   to where that movement began: the last instant the body was still, or the
 *   last time it was travelling the other way.
 * - **`minDwellMs` is deliberately ignored.** Dwell exists to stop jitter being
 *   counted; here it would only delay the word.
 */

import {
  MetricEvaluator,
  evaluateCondition,
  synthesizeFrames,
  type MetricFrame,
} from '@kinetrace/engine';
import { metricsForSide, referenceSide } from './runner.js';
import type { ExerciseDefinition } from './types.js';

/** A moment inside a repetition at which the body starts moving into a phase. */
export interface PhaseMark {
  /** Phase being moved into. */
  phase: string;
  /** Where in the repetition the movement starts, as a fraction in `[0, 1)`. */
  at: number;
}

/** Frames per second used for the derivation. Fine enough to place a word within 17 ms. */
const DERIVE_FPS = 60;
/**
 * Three cycles, of which only the middle one is kept. The first is spent while
 * the filter settles; the third is there because the return to the starting
 * position departs in one cycle and arrives in the next, so the last transition
 * of any run is always incomplete.
 */
const DERIVE_CYCLES = 3;
/**
 * Share of the repetition's fastest speed below which the body counts as still.
 * Every keyframe of a reference motion is a still point, because the poses are
 * eased in and out, so this only has to clear the noise of the filter.
 */
const STILL_FRACTION = 0.1;
/**
 * A mark this close to the end of the cycle is the first movement of the *next*
 * repetition, arriving a filtered instant early, and is pinned to the start.
 * Nothing real begins in the last twentieth of a repetition and finishes in it.
 */
const WRAP_TOLERANCE = 0.05;

interface DerivedFrame {
  timestampMs: number;
  velocity: number;
  phase: string | undefined;
}

/** The phase whose condition holds on this frame, if any. Declaration order wins. */
function holdingPhase(exercise: ExerciseDefinition, frame: MetricFrame): string | undefined {
  for (const phase of exercise.phases) {
    if (evaluateCondition(phase.when, frame, exercise.primaryMetric)) return phase.id;
  }
  return undefined;
}

/**
 * Index at which the movement that reaches `arrival` began.
 *
 * Walk back from the moment the phase band is entered for as long as the body
 * is still travelling the same way at speed. It stops at a keyframe, where the
 * eased motion brings the body to rest, or at the instant the movement reversed
 * — the top of a bridge is both. `departure`, the moment the previous phase was
 * entered, is the floor: a movement cannot have begun before the phase it
 * leaves was reached.
 */
function movementStart(
  frames: readonly DerivedFrame[],
  departure: number,
  arrival: number,
  threshold: number,
): number {
  const direction = Math.sign(frames[arrival]?.velocity ?? 0);
  let start = arrival;
  while (start > departure) {
    const previous = frames[start - 1]?.velocity ?? 0;
    if (Math.abs(previous) <= threshold) break;
    if (direction !== 0 && Math.sign(previous) !== direction) break;
    start -= 1;
  }
  return start;
}

/**
 * Derive where each movement of one repetition begins.
 *
 * Returns an empty timeline for an exercise with a single phase — a plank has
 * nothing to call out — and for any reference motion that never leaves one
 * phase, which is a fact about the library worth surfacing rather than hiding.
 */
export function phaseTimeline(exercise: ExerciseDefinition): PhaseMark[] {
  if (exercise.phases.length < 2) return [];

  // Measured on the limb the reference motion actually works, not on whichever
  // one the camera sees better. See `referenceSide`.
  const evaluator = new MetricEvaluator(metricsForSide(exercise.metrics, referenceSide(exercise)), {
    view: exercise.view.orientation,
  });
  const frames: DerivedFrame[] = synthesizeFrames(exercise.reference, {
    view: exercise.view.orientation,
    fps: DERIVE_FPS,
    cycles: DERIVE_CYCLES,
  }).map((frame) => {
    const metrics = evaluator.update(frame);
    return {
      timestampMs: frame.timestampMs,
      velocity: metrics.samples[exercise.primaryMetric]?.velocity ?? 0,
      phase: holdingPhase(exercise, metrics),
    };
  });

  // Where each phase was first held, in order, ignoring the gaps in between.
  const entries: Array<{ phase: string; index: number }> = [];
  for (const [index, frame] of frames.entries()) {
    if (frame.phase === undefined) continue;
    if (frame.phase !== entries[entries.length - 1]?.phase) {
      entries.push({ phase: frame.phase, index });
    }
  }

  const peakSpeed = frames.reduce((peak, frame) => Math.max(peak, Math.abs(frame.velocity)), 0);
  const threshold = peakSpeed * STILL_FRACTION;

  const cycleMs = exercise.reference.cycleSeconds * 1000;
  const marks: PhaseMark[] = [];
  for (let step = 1; step < entries.length; step += 1) {
    const from = entries[step - 1];
    const to = entries[step];
    if (!from || !to) continue;
    const index = movementStart(frames, from.index, to.index, threshold);
    marks.push({ phase: to.phase, at: (frames[index]?.timestampMs ?? 0) / cycleMs });
  }

  return marks
    .filter((mark) => mark.at >= 1 && mark.at < 2)
    .map((mark) => ({
      phase: mark.phase,
      at: mark.at - 1 >= 1 - WRAP_TOLERANCE ? 0 : mark.at - 1,
    }))
    .sort((a, b) => a.at - b.at);
}

/**
 * The same thing, remembered.
 *
 * Deriving a timeline synthesises and evaluates a thousand frames, which is
 * nothing once and noticeable in the middle of a set. Exercise definitions are
 * frozen module constants, so caching on the object itself is safe and lets a
 * routine that hand-edits one still get its own answer.
 */
const TIMELINES = new WeakMap<ExerciseDefinition, PhaseMark[]>();

export function phaseMarks(exercise: ExerciseDefinition): readonly PhaseMark[] {
  const cached = TIMELINES.get(exercise);
  if (cached) return cached;
  const derived = phaseTimeline(exercise);
  TIMELINES.set(exercise, derived);
  return derived;
}
