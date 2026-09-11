/**
 * Confidence gate.
 *
 * When the detector loses the body, counting has to stop rather than invent
 * repetitions. The gate adds the hysteresis: a short dropout is ignored, a
 * sustained one pauses the set and asks the user to step back into view.
 */

export interface ConfidenceGateOptions {
  /** Pose confidence below which tracking counts as lost, `[0, 1]`. */
  threshold?: number;
  /** How long confidence must stay low before tracking is declared lost, in milliseconds. */
  lostAfterMs?: number;
  /** How long confidence must stay good before tracking is declared recovered, in milliseconds. */
  recoverAfterMs?: number;
}

export type TrackingEvent =
  | { type: 'trackingLost'; timestampMs: number }
  | { type: 'trackingRecovered'; timestampMs: number };

const DEFAULTS = { threshold: 0.5, lostAfterMs: 1000, recoverAfterMs: 300 } as const;

export class ConfidenceGate {
  private lost = false;
  private lowSince: number | null = null;
  private goodSince: number | null = null;

  constructor(private readonly options: ConfidenceGateOptions = {}) {}

  get isLost(): boolean {
    return this.lost;
  }

  reset(): void {
    this.lost = false;
    this.lowSince = null;
    this.goodSince = null;
  }

  update(confidence: number, timestampMs: number): TrackingEvent | null {
    const { threshold, lostAfterMs, recoverAfterMs } = { ...DEFAULTS, ...this.options };
    if (confidence < threshold) {
      this.goodSince = null;
      this.lowSince ??= timestampMs;
      if (!this.lost && timestampMs - this.lowSince >= lostAfterMs) {
        this.lost = true;
        return { type: 'trackingLost', timestampMs };
      }
      return null;
    }

    this.lowSince = null;
    this.goodSince ??= timestampMs;
    if (this.lost && timestampMs - this.goodSince >= recoverAfterMs) {
      this.lost = false;
      return { type: 'trackingRecovered', timestampMs };
    }
    return null;
  }
}
