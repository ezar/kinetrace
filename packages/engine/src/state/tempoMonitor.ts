/**
 * Pacing.
 *
 * "Lower it over three seconds" is one of the most repeated instructions in
 * rehabilitation, and until now an exercise could declare a tempo that nothing
 * read. This watches how long each phase of the cycle actually takes and says
 * something when one is rushed.
 *
 * Only rushing is flagged. Going slowly is rarely the error, and a coach that
 * chases somebody for taking their time is worse than one that says nothing —
 * the asymmetry is deliberate, not an omission.
 *
 * It needs no protection against the frames stopping, for a pleasant reason: an
 * absence makes a phase look *longer*, and a phase that took too long is
 * exactly what this never reports.
 */

export interface TempoTarget {
  /** Phase id from the exercise's own cycle. */
  phase: string;
  /** How long that phase is meant to take, in seconds. */
  seconds: number;
}

export interface TempoOptions {
  /**
   * A phase finished inside this share of its target counts as rushed.
   *
   * 0.75 was measured, not picked. Running the glute bridge — the one exercise
   * that declares a tempo — over synthetic repetitions at paces from six
   * seconds down to one and a half gives, for its two second top phase:
   *
   *     seconds per repetition   3.5    3.0    2.5    2.0    1.5
   *     share of the target      0.95   0.82   0.67   0.50   0.35
   *     velocity rule fires       no     no     no    yes    yes
   *
   * The velocity rule that already exists says nothing until two seconds a
   * repetition, which is well over twice the prescribed pace. A threshold of
   * 0.6 would only ever fire where that rule already has, and add nothing.
   * 0.75 covers the band it misses — around a fifth faster than prescribed and
   * up — while leaving a wide margin at the intended pace.
   */
  rushedBelow?: number;
  /** Targets shorter than this are not judged; the measurement noise is bigger. */
  minTargetSeconds?: number;
  /** Quiet time after saying something, in milliseconds. */
  cooldownMs?: number;
}

const DEFAULTS = {
  rushedBelow: 0.75,
  minTargetSeconds: 0.8,
  cooldownMs: 8000,
} as const;

export interface TempoEvent {
  type: 'rushed';
  phase: string;
  /** What it actually took, in seconds. */
  seconds: number;
  targetSeconds: number;
  timestampMs: number;
}

export class TempoMonitor {
  private readonly targets: Map<string, number>;
  private readonly options: Required<TempoOptions>;
  private current: { phase: string; enteredAtMs: number } | null = null;
  private lastCueAtMs: number | null = null;

  constructor(targets: readonly TempoTarget[] = [], options: TempoOptions = {}) {
    this.targets = new Map(targets.map((target) => [target.phase, target.seconds]));
    this.options = { ...DEFAULTS, ...options };
  }

  /** True when there is any tempo to hold somebody to. */
  get active(): boolean {
    return this.targets.size > 0;
  }

  reset(): void {
    this.current = null;
    this.lastCueAtMs = null;
  }

  /**
   * Tell the monitor the cycle has moved into a phase. The phase that just
   * ended is the one judged, because only now is its duration known.
   */
  enter(phase: string, timestampMs: number): TempoEvent[] {
    const previous = this.current;
    this.current = { phase, enteredAtMs: timestampMs };
    if (!previous) return [];

    const targetSeconds = this.targets.get(previous.phase);
    if (targetSeconds === undefined || targetSeconds < this.options.minTargetSeconds) return [];

    const seconds = (timestampMs - previous.enteredAtMs) / 1000;
    if (seconds <= 0 || seconds >= targetSeconds * this.options.rushedBelow) return [];

    const quiet =
      this.lastCueAtMs === null || timestampMs - this.lastCueAtMs >= this.options.cooldownMs;
    if (!quiet) return [];
    this.lastCueAtMs = timestampMs;
    return [
      {
        type: 'rushed',
        phase: previous.phase,
        seconds: Math.round(seconds * 10) / 10,
        targetSeconds,
        timestampMs,
      },
    ];
  }
}
