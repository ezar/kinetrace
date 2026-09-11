/**
 * One Euro filter: adaptive low-pass filtering for noisy signals.
 *
 * Casiez, Roussel & Vogel (2012), "1€ Filter: A Simple Speed-based Low-pass
 * Filter for Noisy Input in Interactive Systems".
 *
 * Rehabilitation movements are much slower than hand tracking, so the defaults
 * here use a lower minimum cutoff (less jitter, slightly more lag) than the
 * values normally used for fingertips.
 */

export interface OneEuroParams {
  /** Minimum cutoff frequency in hertz. Lower = smoother when still. */
  minCutoffHz: number;
  /** Speed coefficient. Higher = less lag when moving fast. */
  beta: number;
  /** Cutoff frequency in hertz for the derivative estimate. */
  derivativeCutoffHz: number;
}

/** Defaults tuned for slow rehabilitation movements at 24-30 fps. */
export const REHAB_FILTER_PARAMS: OneEuroParams = {
  minCutoffHz: 0.8,
  beta: 0.02,
  derivativeCutoffHz: 1.0,
};

function smoothingFactor(deltaSeconds: number, cutoffHz: number): number {
  const r = 2 * Math.PI * cutoffHz * deltaSeconds;
  return r / (r + 1);
}

function exponentialSmoothing(alpha: number, value: number, previous: number): number {
  return alpha * value + (1 - alpha) * previous;
}

/** One Euro filter over a single scalar signal. */
export class OneEuroFilter {
  /** Last raw sample. The derivative is estimated from raw samples, not filtered ones. */
  private previousRaw: number | null = null;
  private previousValue: number | null = null;
  private previousDerivative = 0;
  private previousTimestampMs: number | null = null;
  /** Absolute difference between raw and filtered value on the last update, in input units. */
  private lastResidual = 0;

  constructor(private readonly params: OneEuroParams = REHAB_FILTER_PARAMS) {}

  /**
   * Feed one sample.
   *
   * @param value Raw sample value.
   * @param timestampMs Sample timestamp in milliseconds.
   * @returns The filtered value in the same units as `value`.
   */
  filter(value: number, timestampMs: number): number {
    if (!Number.isFinite(value)) return this.previousValue ?? 0;

    if (
      this.previousValue === null ||
      this.previousRaw === null ||
      this.previousTimestampMs === null
    ) {
      this.previousRaw = value;
      this.previousValue = value;
      this.previousTimestampMs = timestampMs;
      this.lastResidual = 0;
      return value;
    }

    const deltaSeconds = Math.max((timestampMs - this.previousTimestampMs) / 1000, 1e-4);
    const rawDerivative = (value - this.previousRaw) / deltaSeconds;
    const derivativeAlpha = smoothingFactor(deltaSeconds, this.params.derivativeCutoffHz);
    const derivative = exponentialSmoothing(
      derivativeAlpha,
      rawDerivative,
      this.previousDerivative,
    );

    const cutoff = this.params.minCutoffHz + this.params.beta * Math.abs(derivative);
    const alpha = smoothingFactor(deltaSeconds, cutoff);
    const filtered = exponentialSmoothing(alpha, value, this.previousValue);

    this.lastResidual = Math.abs(value - filtered);
    this.previousRaw = value;
    this.previousValue = filtered;
    this.previousDerivative = derivative;
    this.previousTimestampMs = timestampMs;
    return filtered;
  }

  /** Smoothed derivative of the signal, in input units per second. */
  get derivative(): number {
    return this.previousDerivative;
  }

  /** Absolute difference between the last raw sample and its filtered value. */
  get residual(): number {
    return this.lastResidual;
  }

  reset(): void {
    this.previousRaw = null;
    this.previousValue = null;
    this.previousDerivative = 0;
    this.previousTimestampMs = null;
    this.lastResidual = 0;
  }
}

/**
 * One Euro filter applied independently to every coordinate of every landmark.
 *
 * Visibility is passed through untouched; a landmark that disappears keeps its
 * last filtered position so that transient detection gaps do not snap the
 * skeleton, and the confidence gate upstream decides whether to keep counting.
 */
export class LandmarkFilter {
  private filters: OneEuroFilter[][] = [];
  /** Mean residual across all coordinates of the last filtered frame, in input units. */
  private meanResidual = 0;

  constructor(private readonly params: OneEuroParams = REHAB_FILTER_PARAMS) {}

  filter<T extends { x: number; y: number; z: number; visibility: number }>(
    landmarks: readonly T[],
    timestampMs: number,
  ): T[] {
    let residualSum = 0;
    let residualCount = 0;

    const result = landmarks.map((landmark, index) => {
      let axes = this.filters[index];
      if (!axes) {
        axes = [
          new OneEuroFilter(this.params),
          new OneEuroFilter(this.params),
          new OneEuroFilter(this.params),
        ];
        this.filters[index] = axes;
      }
      const [fx, fy, fz] = axes as [OneEuroFilter, OneEuroFilter, OneEuroFilter];
      const filtered = {
        ...landmark,
        x: fx.filter(landmark.x, timestampMs),
        y: fy.filter(landmark.y, timestampMs),
        z: fz.filter(landmark.z, timestampMs),
      };
      residualSum += fx.residual + fy.residual + fz.residual;
      residualCount += 3;
      return filtered;
    });

    this.meanResidual = residualCount > 0 ? residualSum / residualCount : 0;
    return result;
  }

  /** Mean absolute residual of the last frame. High values mean the pose is noisy. */
  get residual(): number {
    return this.meanResidual;
  }

  reset(): void {
    this.filters = [];
    this.meanResidual = 0;
  }
}
