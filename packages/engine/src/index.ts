/**
 * Kinetrace engine.
 *
 * Framework-free TypeScript: landmarks in, metrics, repetitions, holds and cues
 * out. Nothing here touches the DOM, a camera or storage, so the same code runs
 * in the browser, in a worker, in Node for the replay tool and in the tests.
 */

export * from './types.js';
export * from './pose/landmarks.js';
export { OneEuroFilter, LandmarkFilter, REHAB_FILTER_PARAMS } from './filter/oneEuro.js';
export type { OneEuroParams } from './filter/oneEuro.js';
export * from './metrics/geometry.js';
export {
  METRIC_DEFINITIONS,
  METRIC_IDS,
  buildBodyFrame,
  getMetricDefinition,
  metricLandmarkIndices,
} from './metrics/definitions.js';
export type {
  MetricDefinition,
  MetricId,
  BodyFrame,
  MetricContext,
} from './metrics/definitions.js';
export { MetricEvaluator, meanVisibility, poseConfidence } from './metrics/evaluator.js';
export type { MetricSpec, MetricEvaluatorOptions } from './metrics/evaluator.js';
export { evaluateCondition, conditionMetrics } from './rules/conditions.js';
export type { Condition, MetricCondition, MetricSignal } from './rules/conditions.js';
export { RuleEngine } from './rules/engine.js';
export type { RuleDef, CueCandidate, CuePriority } from './rules/engine.js';
export { CueScheduler } from './cues/scheduler.js';
export type { ScheduledCue, CueSchedulerOptions } from './cues/scheduler.js';
export { RepMachine } from './state/repMachine.js';
export type {
  PhaseDef,
  RepEvent,
  RepMachineConfig,
  RepMachineState,
  RepTargets,
  TargetBand,
} from './state/repMachine.js';
export { HoldTimer } from './state/holdTimer.js';
export type { HoldConfig, HoldEvent, HoldState } from './state/holdTimer.js';
export { GestureDetector } from './gestures/detector.js';
export { GESTURE_MOTIONS } from './gestures/demo.js';
export type { GestureEvent, GestureOptions } from './gestures/detector.js';
export {
  matchVoiceCommand,
  normalizeTranscript,
  editDistance,
  VoiceCommandMatcher,
  VOICE_COMMANDS,
} from './voice/grammar.js';
export type {
  VoiceCommand,
  VoiceGrammar,
  VoiceMatch,
  VoiceMatchOptions,
  VoiceMatcherOptions,
} from './voice/grammar.js';
export { ConfidenceGate } from './session/confidenceGate.js';
export type { ConfidenceGateOptions, TrackingEvent } from './session/confidenceGate.js';
export { ExerciseRunner, BUILT_IN_CUES } from './session/runner.js';
export type {
  EngineEvent,
  ExerciseRunnerConfig,
  RunnerState,
  RunnerUpdate,
} from './session/runner.js';
export * from './synth/body.js';
export * from './synth/motion.js';
export { TrackRecorder, trackFrame, trackDurationMs, TRACK_FPS } from './replay/track.js';
export type { SkeletonTrack } from './replay/track.js';
export * from './setup/assistant.js';
export * from './synth/fixtures.js';
