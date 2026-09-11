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

/** Body area the exercise targets, used by the library filters. */
export type ExerciseArea = 'lowerBack' | 'core' | 'hips' | 'thoracic' | 'neckShoulders';

/** Starting position, used by the library filters and by the camera guidance. */
export type ExercisePosition = 'standing' | 'supine' | 'prone' | 'quadruped' | 'sideLying';

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
  area: ExerciseArea;
  position: ExercisePosition;
  equipment: 'none' | 'mat';
  view: ExerciseView;
  /** Key into the camera tip dictionary, e.g. `tip.gluteBridge`. */
  cameraTipKey: string;
  /** Metric slots, keyed by the name that phases and rules reference. */
  metrics: Record<string, ExerciseMetric>;
  /** Slot name used for counting, for the big number on screen and for progress charts. */
  primaryMetric: string;
  mode: 'reps' | 'hold';
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
