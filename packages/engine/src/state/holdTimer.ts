/**
 * Hold (isometric) timer.
 *
 * Time only accumulates while the primary metric sits inside the target band
 * and the movement is stable. Leaving the band pauses the timer; the engine
 * reports the lapse after a grace period so that the cue scheduler can ask for
 * a correction without nagging on a momentary wobble.
 */

import type { MetricFrame } from '../types.js';
import type { TargetBand } from './repMachine.js';

export interface HoldConfig {
  /** Metric slot the hold is measured on. */
  primaryMetric: string;
  /** Range the metric must stay inside, in degrees. */
  band: TargetBand;
  /** Maximum standard deviation over the last second that still counts as held, in degrees. */
  stabilityToleranceDeg: number;
  /** Hold duration requested by the routine, in milliseconds. */
  targetMs: number;
  /** How long the metric may sit outside the band before the engine reports it, in milliseconds. */
  graceMs?: number;
}

export type HoldEvent =
  | { type: 'holdStart'; timestampMs: number }
  | { type: 'holdLost'; timestampMs: number; value: number }
  | { type: 'holdResumed'; timestampMs: number }
  | { type: 'holdComplete'; timestampMs: number; heldMs: number };

export interface HoldState {
  /** Time accumulated inside the band, in milliseconds. */
  heldMs: number;
  holding: boolean;
  complete: boolean;
}

const DEFAULT_GRACE_MS = 1000;

export class HoldTimer {
  private heldMs = 0;
  private holding = false;
  private complete = false;
  private started = false;
  private lastTimestampMs: number | null = null;
  private outsideSince: number | null = null;
  private reportedLoss = false;

  constructor(private readonly config: HoldConfig) {}

  get state(): HoldState {
    return { heldMs: this.heldMs, holding: this.holding, complete: this.complete };
  }

  reset(): void {
    this.heldMs = 0;
    this.holding = false;
    this.complete = false;
    this.started = false;
    this.lastTimestampMs = null;
    this.outsideSince = null;
    this.reportedLoss = false;
  }

  update(frame: MetricFrame): HoldEvent[] {
    const events: HoldEvent[] = [];
    const sample = frame.samples[this.config.primaryMetric];
    const previousTimestamp = this.lastTimestampMs;
    this.lastTimestampMs = frame.timestampMs;
    if (this.complete || !sample || !Number.isFinite(sample.value)) return events;

    const inBand = sample.value >= this.config.band.min && sample.value <= this.config.band.max;
    const steady = sample.stability <= this.config.stabilityToleranceDeg;
    const holdingNow = inBand && steady;

    if (holdingNow) {
      if (!this.started) {
        this.started = true;
        events.push({ type: 'holdStart', timestampMs: frame.timestampMs });
      } else if (!this.holding && this.reportedLoss) {
        events.push({ type: 'holdResumed', timestampMs: frame.timestampMs });
      }
      this.outsideSince = null;
      this.reportedLoss = false;
      if (previousTimestamp !== null && this.holding) {
        this.heldMs += Math.max(0, frame.timestampMs - previousTimestamp);
      }
      this.holding = true;
      if (this.heldMs >= this.config.targetMs) {
        this.complete = true;
        this.holding = false;
        events.push({
          type: 'holdComplete',
          timestampMs: frame.timestampMs,
          heldMs: this.heldMs,
        });
      }
      return events;
    }

    this.holding = false;
    if (!this.started) return events;
    this.outsideSince ??= frame.timestampMs;
    const graceMs = this.config.graceMs ?? DEFAULT_GRACE_MS;
    if (!this.reportedLoss && frame.timestampMs - this.outsideSince >= graceMs) {
      this.reportedLoss = true;
      events.push({ type: 'holdLost', timestampMs: frame.timestampMs, value: sample.value });
    }
    return events;
  }
}
