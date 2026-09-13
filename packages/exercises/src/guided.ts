/**
 * The spoken script for a set done without a camera.
 *
 * Sometimes the phone cannot be propped up: no room, no light, somebody asleep
 * in the next room. What is left is a voice that counts. This turns one set of
 * a routine into what to say and when to say it — and nothing else. There is no
 * measurement here, and the app must not pretend otherwise.
 *
 * Two kinds of line, because they need different clocks:
 *
 * - The **preamble** and **epilogue** are spoken back to back, each one after
 *   the last has finished. Speech synthesis knows how long a sentence takes and
 *   this module does not, so it does not guess: the caller waits for `onend`.
 * - The **rhythm** is a timeline in milliseconds from the moment the work
 *   starts. That one is a clock, and the clock is the point.
 *
 * The pace is not invented. Every exercise in the library declares the duration
 * of one repetition of its reference motion — the pace its animated demo moves
 * at — and a physiotherapist's tempo replaces it where one is prescribed.
 */

import type { ExerciseDefinition } from './types.js';

/** A line to speak: a key into the dictionary, and what to fill it with. */
export interface GuidedLine {
  key: string;
  params?: Record<string, string | number>;
}

/** A line with a time, in milliseconds from the start of the work. */
export interface GuidedBeat extends GuidedLine {
  atMs: number;
}

export interface GuidedSet {
  preamble: GuidedLine[];
  /** Spoken against a clock. Empty for a set nobody can pace. */
  rhythm: GuidedBeat[];
  /** How long the work lasts, in milliseconds. */
  workMs: number;
  epilogue: GuidedLine[];
}

export interface GuidedInput {
  exercise: ExerciseDefinition;
  /** Name of the exercise in the language being spoken. */
  name: string;
  /** Set number inside this exercise, from 1. */
  setNumber: number;
  totalSets: number;
  reps?: number;
  holdSeconds?: number;
  /** Prescribed side, for a unilateral exercise. */
  side?: 'left' | 'right';
  /** Seconds per phase, when a professional set a pace. */
  tempo?: ReadonlyArray<{ phase: string; seconds: number }>;
  /** A line from the professional, read out before the set. */
  physioNote?: string;
}

/** Counted individually at the end of a hold, because that is when it hurts. */
const FINAL_COUNTDOWN_SECONDS = 5;
/** A hold long enough to be worth a warning before the final count. */
const TEN_TO_GO_FROM_SECONDS = 15;
/** A hold long enough that the midpoint is a landmark rather than noise. */
const HALFWAY_FROM_SECONDS = 40;
/** Seconds counted down before the work starts. */
const LEAD_IN_SECONDS = 3;

/**
 * Seconds one repetition should take.
 *
 * A prescribed tempo is the sum of its phases: a rest of 1.5 s and a top of 2 s
 * is a three and a half second repetition. Without one, the reference motion's
 * own cycle — which is the pace the exercise's demo animates at, chosen by
 * whoever authored it.
 */
export function repSeconds(input: Pick<GuidedInput, 'exercise' | 'tempo'>): number {
  const tempo = input.tempo ?? input.exercise.tempo;
  if (tempo && tempo.length > 0) {
    const total = tempo.reduce((sum, target) => sum + target.seconds, 0);
    if (total > 0) return total;
  }
  return input.exercise.reference.cycleSeconds;
}

/** The seconds of a hold that get spoken, largest first. */
export function holdMarks(seconds: number): number[] {
  const marks = new Set<number>();
  if (seconds >= HALFWAY_FROM_SECONDS) marks.add(Math.round(seconds / 2));
  if (seconds >= TEN_TO_GO_FROM_SECONDS) marks.add(10);
  for (let n = Math.min(FINAL_COUNTDOWN_SECONDS, Math.floor(seconds) - 1); n >= 1; n -= 1) {
    marks.add(n);
  }
  return [...marks].filter((mark) => mark > 0 && mark < seconds).sort((a, b) => b - a);
}

export function guidedScript(input: GuidedInput): GuidedSet {
  const isHold = input.exercise.mode === 'hold';
  const preamble: GuidedLine[] = [
    {
      key: input.side ? 'guided.exerciseSide' : 'guided.exercise',
      params: { name: input.name, ...(input.side ? { side: input.side } : {}) },
    },
  ];

  // The professional wrote it to be read before this set, so read it.
  if (input.physioNote?.trim()) {
    preamble.push({ key: 'guided.note', params: { note: input.physioNote.trim() } });
  }

  const holdSeconds = input.holdSeconds ?? 0;
  const reps = input.reps ?? 0;
  preamble.push(
    isHold
      ? {
          key: 'guided.doseHold',
          params: { set: input.setNumber, sets: input.totalSets, seconds: holdSeconds },
        }
      : {
          key: 'guided.doseReps',
          params: { set: input.setNumber, sets: input.totalSets, reps },
        },
  );
  preamble.push({ key: 'guided.getReady' });
  for (let n = LEAD_IN_SECONDS; n >= 1; n -= 1) {
    preamble.push({ key: 'guided.count', params: { n } });
  }
  preamble.push({ key: isHold ? 'guided.hold' : 'guided.begin' });

  const rhythm: GuidedBeat[] = [];
  let workMs: number;

  if (isHold) {
    workMs = Math.max(0, holdSeconds) * 1000;
    for (const mark of holdMarks(holdSeconds)) {
      rhythm.push({
        atMs: (holdSeconds - mark) * 1000,
        key: mark === 10 ? 'guided.remaining' : 'guided.count',
        params: mark === 10 ? { seconds: mark } : { n: mark },
      });
    }
  } else {
    // Each number lands on a repetition that is finished, which is what a coach
    // counts and what somebody on a mat wants to hear: how many are done.
    const stepMs = repSeconds(input) * 1000;
    for (let rep = 1; rep <= reps; rep += 1) {
      rhythm.push({ atMs: rep * stepMs, key: 'guided.rep', params: { n: rep } });
    }
    workMs = reps * stepMs;
  }

  return { preamble, rhythm, workMs, epilogue: [{ key: 'guided.setDone' }] };
}

/** What to say while resting, and when. `atMs` runs from the start of the rest. */
export function restScript(seconds: number): { preamble: GuidedLine[]; rhythm: GuidedBeat[] } {
  if (seconds <= 0) return { preamble: [], rhythm: [] };
  const preamble: GuidedLine[] = [{ key: 'guided.rest', params: { seconds } }];
  const rhythm: GuidedBeat[] = [];
  // Enough warning to get back into position, and only when there is time for
  // the warning to mean anything.
  if (seconds > LEAD_IN_SECONDS * 2) {
    rhythm.push({ atMs: (seconds - LEAD_IN_SECONDS) * 1000, key: 'guided.back' });
  }
  return { preamble, rhythm };
}
