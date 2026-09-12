/**
 * Exercise runner: one set of one exercise.
 *
 * Wires the whole pipeline together — metrics, repetition machine or hold
 * timer, form rules, confidence gate and cue scheduler — and exposes a single
 * `update(frame)` call plus the state the session screen renders.
 */

import type { MetricFrame, PoseFrame, ViewOrientation } from '../types.js';
import { MetricEvaluator, type MetricSpec } from '../metrics/evaluator.js';
import { RepMachine, type PhaseDef, type RepEvent, type RepTargets } from '../state/repMachine.js';
import { HoldTimer, type HoldEvent } from '../state/holdTimer.js';
import { TempoMonitor, type TempoEvent, type TempoTarget } from '../state/tempoMonitor.js';
import { RuleEngine, type CueCandidate, type RuleDef } from '../rules/engine.js';
import { CueScheduler, type ScheduledCue } from '../cues/scheduler.js';
import { ConfidenceGate, type TrackingEvent } from './confidenceGate.js';

/** Cue keys the engine itself raises, independently of the exercise rules. */
export const BUILT_IN_CUES = {
  goodRep: 'engine.goodRep',
  partialRep: 'engine.partialRep',
  holdLost: 'engine.holdLost',
  holdComplete: 'engine.holdComplete',
  trackingLost: 'engine.trackingLost',
  safetyStop: 'engine.safetyStop',
  rushed: 'engine.rushed',
} as const;

export interface ExerciseRunnerConfig {
  /** Metric slots declared by the exercise, keyed by slot name. */
  metrics: Readonly<Record<string, MetricSpec>>;
  /** Slot name used by the repetition machine and by conditions that omit `metric`. */
  primaryMetric: string;
  view: ViewOrientation;
  mode: 'reps' | 'hold';
  phases: PhaseDef[];
  targets: RepTargets;
  rules: readonly RuleDef[];
  /** Repetitions requested by the routine. Only used to report progress. */
  targetReps?: number;
  /** Seconds each phase should take. Absent means pacing is not judged. */
  tempo?: readonly TempoTarget[];
  /** Hold configuration, required when `mode` is `hold`. */
  hold?: {
    stabilityToleranceDeg: number;
    /** Hold duration requested by the routine, in milliseconds. */
    targetMs: number;
  };
}

export type EngineEvent =
  RepEvent | HoldEvent | TrackingEvent | TempoEvent | { type: 'safetyStop'; timestampMs: number };

export interface RunnerState {
  phaseId: string | null;
  reps: number;
  partials: number;
  /** Percentage of completed repetitions that reached the target band, `[0, 100]`. */
  goodRepPct: number;
  /** Best peak across the set, in degrees. */
  romMax: number;
  /** Mean peak across the set, in degrees. */
  romMean: number;
  /** Peak of every completed repetition, in degrees. */
  peaks: number[];
  /** Accumulated hold time, in milliseconds. */
  heldMs: number;
  holdComplete: boolean;
  tracking: 'ok' | 'lost';
  /** True while the primary metric sits outside the exercise's safety range. */
  unsafe: boolean;
  /** Current value of the primary metric, in degrees. */
  primaryValue: number;
  /** Issue counts for the set, keyed by rule id. */
  issues: Record<string, number>;
}

export interface RunnerUpdate {
  metrics: MetricFrame;
  events: EngineEvent[];
  cue: ScheduledCue | null;
  state: RunnerState;
}

export class ExerciseRunner {
  private readonly evaluator: MetricEvaluator;
  private readonly repMachine: RepMachine | null;
  private readonly holdTimer: HoldTimer | null;
  private readonly rules: RuleEngine;
  private readonly scheduler = new CueScheduler();
  private readonly gate = new ConfidenceGate();
  private readonly tempo: TempoMonitor;
  private readonly issues: Record<string, number> = {};
  private unsafe = false;
  private safetyReported = false;

  constructor(private readonly config: ExerciseRunnerConfig) {
    this.evaluator = new MetricEvaluator(config.metrics, { view: config.view });
    this.tempo = new TempoMonitor(config.tempo ?? []);
    this.rules = new RuleEngine(config.rules, config.primaryMetric);
    this.repMachine =
      config.mode === 'reps'
        ? new RepMachine({
            phases: config.phases,
            primaryMetric: config.primaryMetric,
            targets: config.targets,
          })
        : null;
    this.holdTimer =
      config.mode === 'hold'
        ? new HoldTimer({
            primaryMetric: config.primaryMetric,
            band: config.targets.band,
            stabilityToleranceDeg: config.hold?.stabilityToleranceDeg ?? 4,
            targetMs: config.hold?.targetMs ?? 30_000,
          })
        : null;
  }

  reset(): void {
    this.evaluator.reset();
    this.repMachine?.reset();
    this.holdTimer?.reset();
    this.rules.reset();
    this.scheduler.reset();
    this.gate.reset();
    this.tempo.reset();
    for (const key of Object.keys(this.issues)) delete this.issues[key];
    this.unsafe = false;
    this.safetyReported = false;
  }

  update(frame: PoseFrame): RunnerUpdate {
    const metrics = this.evaluator.update(frame);
    const events: EngineEvent[] = [];
    const candidates: CueCandidate[] = [];

    const trackingEvent = this.gate.update(metrics.poseConfidence, metrics.timestampMs);
    if (trackingEvent) events.push(trackingEvent);
    if (trackingEvent?.type === 'trackingLost') {
      candidates.push({
        ruleId: 'engine.tracking',
        cueKey: BUILT_IN_CUES.trackingLost,
        priority: 'safety',
        timestampMs: metrics.timestampMs,
      });
    }

    // Counting pauses while the body is not tracked: better no count than a wrong one.
    if (!this.gate.isLost) {
      const safetyEvent = this.checkSafety(metrics, candidates);
      if (safetyEvent) events.push(safetyEvent);

      if (this.repMachine) {
        for (const event of this.repMachine.update(metrics)) {
          events.push(event);
          if (event.type === 'phase') {
            for (const rushed of this.tempo.enter(event.phaseId, event.timestampMs)) {
              events.push(rushed);
              candidates.push({
                ruleId: 'engine.rushed',
                cueKey: BUILT_IN_CUES.rushed,
                priority: 'form',
                timestampMs: rushed.timestampMs,
                params: { seconds: rushed.targetSeconds },
              });
            }
          }
          if (event.type !== 'rep') continue;
          candidates.push({
            ruleId: event.good ? 'engine.goodRep' : 'engine.partialRep',
            cueKey: event.good ? BUILT_IN_CUES.goodRep : BUILT_IN_CUES.partialRep,
            priority: event.good ? 'encouragement' : 'form',
            timestampMs: event.timestampMs,
            params: event.good
              ? { count: this.repMachine.state.reps }
              : { value: Math.round(event.peak) },
          });
        }
      }

      if (this.holdTimer) {
        for (const event of this.holdTimer.update(metrics)) {
          events.push(event);
          if (event.type === 'holdLost') {
            candidates.push({
              ruleId: 'engine.holdLost',
              cueKey: BUILT_IN_CUES.holdLost,
              priority: 'form',
              timestampMs: event.timestampMs,
              params: { value: Math.round(event.value) },
            });
          }
          if (event.type === 'holdComplete') {
            candidates.push({
              ruleId: 'engine.holdComplete',
              cueKey: BUILT_IN_CUES.holdComplete,
              priority: 'encouragement',
              timestampMs: event.timestampMs,
            });
          }
        }
      }

      const phaseId = this.repMachine?.state.phaseId ?? null;
      for (const candidate of this.rules.update(metrics, phaseId)) {
        this.issues[candidate.ruleId] = (this.issues[candidate.ruleId] ?? 0) + 1;
        candidates.push(candidate);
      }
    }

    const cue = this.scheduler.select(candidates, metrics.timestampMs);
    return { metrics, events, cue, state: this.buildState(metrics) };
  }

  private checkSafety(
    metrics: MetricFrame,
    candidates: CueCandidate[],
  ): { type: 'safetyStop'; timestampMs: number } | null {
    const safety = this.config.targets.safety;
    const sample = metrics.samples[this.config.primaryMetric];
    if (!safety || !sample || !Number.isFinite(sample.value)) {
      this.unsafe = false;
      return null;
    }
    const outside = sample.value < safety.min || sample.value > safety.max;
    this.unsafe = outside;
    if (!outside) {
      this.safetyReported = false;
      return null;
    }
    if (this.safetyReported) return null;
    this.safetyReported = true;
    candidates.push({
      ruleId: 'engine.safety',
      cueKey: BUILT_IN_CUES.safetyStop,
      priority: 'safety',
      timestampMs: metrics.timestampMs,
      params: { value: Math.round(sample.value) },
    });
    return { type: 'safetyStop', timestampMs: metrics.timestampMs };
  }

  private buildState(metrics: MetricFrame): RunnerState {
    const repState = this.repMachine?.state;
    const holdState = this.holdTimer?.state;
    const peaks = (repState?.peaks ?? []).filter((peak) => Number.isFinite(peak));
    const completed = (repState?.reps ?? 0) + (repState?.partials ?? 0);
    const direction = this.config.targets.direction;
    const romMax = peaks.length
      ? direction === 'increase'
        ? Math.max(...peaks)
        : Math.min(...peaks)
      : Number.NaN;
    const romMean = peaks.length
      ? peaks.reduce((sum, peak) => sum + peak, 0) / peaks.length
      : Number.NaN;
    const sample = metrics.samples[this.config.primaryMetric];

    return {
      phaseId: repState?.phaseId ?? null,
      reps: repState?.reps ?? 0,
      partials: repState?.partials ?? 0,
      goodRepPct: completed > 0 ? ((repState?.reps ?? 0) / completed) * 100 : 0,
      romMax,
      romMean,
      peaks,
      heldMs: holdState?.heldMs ?? 0,
      holdComplete: holdState?.complete ?? false,
      tracking: this.gate.isLost ? 'lost' : 'ok',
      unsafe: this.unsafe,
      primaryValue: sample?.value ?? Number.NaN,
      issues: { ...this.issues },
    };
  }
}
