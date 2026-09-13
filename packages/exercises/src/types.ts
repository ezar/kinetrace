/**
 * Exercise DSL.
 *
 * Exercises are data, never code. Everything the engine needs to count, time,
 * correct and demonstrate an exercise lives in one of these objects, and
 * `validateExercise` checks it before the app ever loads it.
 *
 * If a new exercise cannot be expressed here, the DSL is missing a primitive:
 * add the primitive to the engine with tests, then add the exercise.
 */

import type {
  BodySide,
  MetricId,
  PhaseDef,
  ReferenceMotion,
  RepTargets,
  RuleDef,
  ViewOrientation,
} from '@kinetrace/engine';

/** Text carried by the exercise data itself. UI copy lives in the app dictionaries. */
export interface Localized {
  es: string;
  en: string;
}

/**
 * Ordered instructions, in both languages.
 *
 * Carried by the exercise rather than the app dictionary, like its name, and
 * required rather than optional: an exercise nobody can explain has no business
 * being prescribed, and making the field optional is how a library ends up with
 * half of them blank.
 */
export interface LocalizedSteps {
  es: string[];
  en: string[];
}

/** Body area the exercise targets, used by the library filters. */
export type ExerciseArea = 'lowerBack' | 'core' | 'hips' | 'thoracic' | 'neckShoulders';

/** Starting position, used by the library filters and by the camera guidance. */
export type ExercisePosition = 'standing' | 'supine' | 'prone' | 'quadruped' | 'sideLying';

/**
 * How the movement loads the lumbar spine.
 *
 * A mechanical description of the exercise, in the same family as `area` and
 * `position`: what the lower back is asked to do while the exercise happens.
 *
 * - `flexion` — the lumbar curve is deliberately reduced or reversed.
 * - `extension` — it is deliberately increased.
 * - `rotation` — the trunk turns.
 * - `neutral` — the lumbar spine is asked to hold still while something else
 *   moves, which is the point of most of the stability work.
 * - `mixed` — the repetition passes through more than one of these.
 *
 * It is here because a prescription for a lower back is partly a choice about
 * direction, and until this field existed neither the library nor the review
 * screen could say which way an exercise went. It describes the movement; it
 * does not recommend one, and nothing in the app selects exercises by it.
 * Like the cue dictionary and the how-to steps, it wants a professional's eye.
 */
export type SpinalLoad = 'flexion' | 'extension' | 'rotation' | 'neutral' | 'mixed';

/**
 * Where a number in an exercise file came from.
 *
 * - `derived` — read off the replay tool running the engine over this
 *   exercise's own reference motion. Internally consistent: the thresholds sit
 *   where the movement actually crosses them.
 * - `authored` — chosen by whoever wrote the exercise, with no source behind
 *   it. Not a placeholder and not a mistake; just nobody's clinical judgement.
 *
 * There is deliberately no third value yet. A number taken from a clinical
 * source needs to name that source, and adding the value without the citation
 * alongside it is how `authored` numbers end up looking sourced.
 */
export type NumberSource = 'derived' | 'authored';

/**
 * Where this exercise's two families of numbers came from.
 *
 * The app shows angles and dosage side by side, in the same typeface, and until
 * this field existed they looked equally well founded. They are not. The
 * thresholds and bands were derived; the sets, repetitions, hold and rest were
 * written down by hand, and no clinical guideline gives them — a 2024
 * systematic review of low back pain guidelines is titled, in as many words,
 * that the guidelines are silent on exercise dosage.
 *
 * So the honest thing is not to go looking for a citation these numbers can
 * never have. It is to say which is which, and to make a professional's
 * numbers the ones that count.
 */
export interface Provenance {
  /** Phase thresholds, the target band and the safety stop. */
  targets: NumberSource;
  /** Sets, repetitions, hold seconds, rest seconds and any tempo. */
  dose: NumberSource;
}

/** Where the phone or laptop should sit. */
export type CameraHeight = 'floor' | 'chair' | 'standing';

/**
 * How reliably landmarks capture this exercise. Small spinal movements seen from
 * the floor are honestly harder to track than a squat, and the library says so.
 */
export type TrackingConfidence = 'high' | 'medium' | 'low';

/** One metric slot of an exercise. */
export interface ExerciseMetric {
  id: MetricId;
  side: BodySide;
  /** Report the absolute value, for metrics whose sign only indicates direction. */
  absolute?: boolean;
  /** Metric specific options, e.g. `{ distal: 'knee' }` for `trunkLineDeviation`. */
  options?: Record<string, string | number>;
}

export interface ExerciseView {
  orientation: ViewOrientation;
  cameraHeight: CameraHeight;
  /** Suggested distance between the camera and the subject, in metres. */
  distanceMetres: number;
}

export interface ExerciseDefaults {
  sets: number;
  /** Repetitions per set. Present when `mode` is `reps`. */
  reps?: number;
  /** Hold duration per set, in seconds. Present when `mode` is `hold`. */
  holdSeconds?: number;
  /** Rest between sets, in seconds. */
  restSeconds: number;
}

export interface ExerciseDefinition {
  id: string;
  names: Localized;
  /** Alternative names used to match a physiotherapist's sheet during import. */
  synonyms: { es: string[]; en: string[] };
  /**
   * How to do it, a step at a time, for somebody who has never seen it.
   *
   * These describe the movement the rest of this object already encodes — the
   * starting position, the phases, what moves and what does not — in the words
   * a person needs rather than the numbers an engine needs. They are not
   * clinical advice and they carry no dosage: a physiotherapist's instructions
   * replace them, and `physioNote` is where those go.
   */
  howTo: LocalizedSteps;
  area: ExerciseArea;
  position: ExercisePosition;
  /** What the lumbar spine is asked to do while this happens. */
  spinalLoad: SpinalLoad;
  /** Where the numbers in this file came from. */
  provenance: Provenance;
  equipment: 'none' | 'mat';
  view: ExerciseView;
  /** Key into the camera tip dictionary, e.g. `tip.gluteBridge`. */
  cameraTipKey: string;
  /** Metric slots, keyed by the name that phases and rules reference. */
  metrics: Record<string, ExerciseMetric>;
  /** Slot name used for counting, for the big number on screen and for progress charts. */
  primaryMetric: string;
  mode: 'reps' | 'hold';
  /**
   * Worked one limb at a time, so a whole set belongs to one side and the side
   * is part of both the prescription and the history.
   *
   * Movements that alternate *within* a set — a bird dog, a dead bug — are not
   * unilateral by this definition: the worked side changes every repetition, so
   * there is no side to prescribe and `side: 'auto'` is the right answer.
   */
  unilateral?: true;
  /** Repetition cycle. Hold exercises declare a single resting phase for context. */
  phases: PhaseDef[];
  /**
   * Default target band. These are defaults only: a physiotherapist's numbers
   * replace them per profile.
   */
  targets: RepTargets;
  hold?: {
    /** Maximum standard deviation over a second that still counts as held, in degrees. */
    stabilityToleranceDeg: number;
  };
  rules: RuleDef[];
  /** Optional pacing, in seconds per phase. */
  tempo?: Array<{ phase: string; seconds: number }>;
  defaults: ExerciseDefaults;
  trackingConfidence: TrackingConfidence;
  /** Keyframes used for the animated demo, the fixtures and the tests. */
  reference: ReferenceMotion;
}

/** Every exercise carries the same reminder; the UI renders it from this key. */
export const DEFAULT_RANGE_NOTICE_KEY = 'library.defaultRangesNotice';
