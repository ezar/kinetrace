/**
 * Repetition state machine.
 *
 * Phases form a cycle. The machine only ever advances to the next phase in the
 * cycle, and only once that phase's condition has held continuously for its
 * minimum dwell time. Jitter around a threshold therefore cannot produce a
 * transition, and the overlap between phase thresholds provides the hysteresis.
 */

import type { MetricFrame } from '../types.js';
import { evaluateCondition, type Condition } from '../rules/conditions.js';

export interface PhaseDef {
  /** Phase name, unique inside the exercise. */
  id: string;
  /** Condition that must hold to enter this phase. */
  when: Condition;
  /** How long `when` must hold continuously before the phase is entered, in milliseconds. */
  minDwellMs: number;
}

/** Inclusive range of a metric, in degrees. */
export interface TargetBand {
  min: number;
  max: number;
}

export interface RepTargets {
  /** Whether a good repetition drives the primary metric up or down. */
  direction: 'increase' | 'decrease';
  /** Range the peak of the repetition should land in, in degrees. */
  band: TargetBand;
  /** Range outside which the engine raises a safety stop, in degrees. */
  safety?: TargetBand;
}

export interface RepMachineConfig {
  phases: PhaseDef[];
  /** Metric slot used for peak tracking and for conditions that omit `metric`. */
  primaryMetric: string;
  targets: RepTargets;
}

export type RepEvent =
  | { type: 'phase'; phaseId: string; timestampMs: number }
  | {
      type: 'rep';
      /** 1-based index of the repetition inside the set. */
      index: number;
      /** Best value of the primary metric during the repetition, in degrees. */
      peak: number;
      /** True when the peak reached the target band. */
      good: boolean;
      timestampMs: number;
    };

export interface RepMachineState {
  phaseId: string | null;
  /** Repetitions that reached the target band. */
  reps: number;
  /** Repetitions that completed the cycle but fell short of the target band. */
  partials: number;
  /** Peak of the primary metric in the repetition under way, in degrees. */
  currentPeak: number;
  /** Peaks of every completed repetition, in degrees. */
  peaks: number[];
}

export class RepMachine {
  private index: number | null = null;
  private candidateSince: number | null = null;
  private reps = 0;
  private partials = 0;
  private peaks: number[] = [];
  private peak: number;
  private cycleStarted = false;

  constructor(private readonly config: RepMachineConfig) {
    if (config.phases.length < 2) {
      throw new Error('A repetition cycle needs at least two phases');
    }
    this.peak = this.initialPeak();
  }

  private initialPeak(): number {
    return this.config.targets.direction === 'increase'
      ? Number.NEGATIVE_INFINITY
      : Number.POSITIVE_INFINITY;
  }

  get state(): RepMachineState {
    const phase = this.index === null ? null : (this.config.phases[this.index]?.id ?? null);
    return {
      phaseId: phase,
      reps: this.reps,
      partials: this.partials,
      currentPeak: this.peak,
      peaks: [...this.peaks],
    };
  }

  /** True when the peak of a repetition counts as reaching the physio's target band. */
  isGoodPeak(peak: number): boolean {
    const { direction, band } = this.config.targets;
    return direction === 'increase' ? peak >= band.min : peak <= band.max;
  }

  reset(): void {
    this.index = null;
    this.candidateSince = null;
    this.reps = 0;
    this.partials = 0;
    this.peaks = [];
    this.peak = this.initialPeak();
    this.cycleStarted = false;
  }

  update(frame: MetricFrame): RepEvent[] {
    const events: RepEvent[] = [];
    const sample = frame.samples[this.config.primaryMetric];
    if (sample && Number.isFinite(sample.value)) {
      this.peak =
        this.config.targets.direction === 'increase'
          ? Math.max(this.peak, sample.value)
          : Math.min(this.peak, sample.value);
    }

    if (this.index === null) {
      // Latch onto whichever phase currently describes the body, without counting.
      const matched = this.config.phases.findIndex((phase) =>
        evaluateCondition(phase.when, frame, this.config.primaryMetric),
      );
      if (matched >= 0) {
        this.index = matched;
        this.cycleStarted = matched === 0;
        this.peak = this.initialPeak();
        events.push({
          type: 'phase',
          phaseId: this.config.phases[matched]?.id ?? '',
          timestampMs: frame.timestampMs,
        });
      }
      return events;
    }

    const nextIndex = (this.index + 1) % this.config.phases.length;
    const nextPhase = this.config.phases[nextIndex];
    if (!nextPhase) return events;

    if (!evaluateCondition(nextPhase.when, frame, this.config.primaryMetric)) {
      this.candidateSince = null;
      return events;
    }

    this.candidateSince ??= frame.timestampMs;
    if (frame.timestampMs - this.candidateSince < nextPhase.minDwellMs) return events;

    this.index = nextIndex;
    this.candidateSince = null;
    events.push({ type: 'phase', phaseId: nextPhase.id, timestampMs: frame.timestampMs });

    if (nextIndex === 0) {
      if (this.cycleStarted) {
        const peak = this.peak;
        const good = Number.isFinite(peak) && this.isGoodPeak(peak);
        if (good) this.reps += 1;
        else this.partials += 1;
        this.peaks.push(peak);
        events.push({
          type: 'rep',
          index: this.reps + this.partials,
          peak,
          good,
          timestampMs: frame.timestampMs,
        });
      }
      this.cycleStarted = true;
      this.peak = this.initialPeak();
    }

    return events;
  }
}
