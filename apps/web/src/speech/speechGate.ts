/**
 * When to bother transcribing.
 *
 * Running Whisper four times a second on an empty room would cost battery and
 * invent words out of noise, so a cheap energy gate decides. It is deliberately
 * dumb: loudness over an adaptive noise floor is speech, a short silence after
 * speech closes an utterance, and that is what gets transcribed.
 *
 * The floor follows the room asymmetrically: it drops fast when things go
 * quiet and climbs slowly when they do not. That asymmetry is what stops a
 * steady hum — a fan, a washing machine, traffic — from reading as somebody
 * talking forever, while a real command, which lasts about a second, is over
 * long before the floor notices it.
 */

export interface SpeechGateOptions {
  /** Quiet ticks that close an utterance. */
  silenceTicks?: number;
  /** Ticks of continuous speech after which the window is transcribed anyway. */
  windowTicks?: number;
  /** Floor under the threshold, so a silent room never triggers. */
  minRms?: number;
  /** How far over the noise floor counts as speech. */
  floorMultiple?: number;
  /** How fast the noise floor drops when the room goes quiet, `[0, 1]` per tick. */
  floorFall?: number;
  /** How fast it climbs when the room does not, `[0, 1]` per tick. Slow on
   *  purpose: speech must outrun it. */
  floorRise?: number;
}

const DEFAULTS = {
  silenceTicks: 2,
  windowTicks: 8,
  minRms: 0.012,
  floorMultiple: 2.5,
  floorFall: 0.25,
  floorRise: 0.01,
} as const;

export class SpeechGate {
  private readonly options: Required<SpeechGateOptions>;
  private noiseFloor: number;
  private speechTicks = 0;
  private silenceTicks = 0;

  constructor(options: SpeechGateOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.noiseFloor = this.options.minRms;
  }

  /** Loudness above which this tick counts as speech. */
  get threshold(): number {
    return Math.max(this.options.minRms, this.noiseFloor * this.options.floorMultiple);
  }

  reset(): void {
    this.speechTicks = 0;
    this.silenceTicks = 0;
  }

  /**
   * Called instead of `push` while the app's own voice is coming out of the
   * speaker. The utterance in progress is abandoned rather than transcribed,
   * and the noise floor is left alone so a cue does not raise it.
   */
  suspend(): void {
    this.reset();
  }

  /** Feed one tick of loudness. True means transcribe the window now. */
  push(rms: number): boolean {
    const loud = rms >= this.threshold;
    const rate = rms < this.noiseFloor ? this.options.floorFall : this.options.floorRise;
    this.noiseFloor = this.noiseFloor * (1 - rate) + rms * rate;

    if (!loud) {
      this.silenceTicks += 1;
      const ended = this.speechTicks > 0 && this.silenceTicks >= this.options.silenceTicks;
      if (this.silenceTicks >= this.options.silenceTicks) this.speechTicks = 0;
      return ended;
    }

    this.silenceTicks = 0;
    this.speechTicks += 1;
    // Somebody talking through the whole window is not saying a command, but
    // transcribe once anyway rather than wait for a pause that may not come.
    if (this.speechTicks >= this.options.windowTicks) {
      this.speechTicks = 0;
      return true;
    }
    return false;
  }
}
