/**
 * Earcons.
 *
 * Four very short tones that never compete with the spoken cues: a good
 * repetition, a partial one, the end of a set, and pause. Synthesised with the
 * Web Audio API, so there are no audio files to ship.
 */

export type Earcon = 'goodRep' | 'partialRep' | 'setComplete' | 'pause';

interface ToneSpec {
  /** Frequencies in hertz, played in order. */
  notes: number[];
  /** Duration of each note in seconds. */
  noteSeconds: number;
  gain: number;
}

const TONES: Record<Earcon, ToneSpec> = {
  goodRep: { notes: [880], noteSeconds: 0.07, gain: 0.12 },
  partialRep: { notes: [440], noteSeconds: 0.09, gain: 0.1 },
  setComplete: { notes: [660, 880, 1320], noteSeconds: 0.09, gain: 0.12 },
  pause: { notes: [520, 390], noteSeconds: 0.1, gain: 0.1 },
};

export class EarconPlayer {
  private context: AudioContext | null = null;

  constructor(private enabled: boolean) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Browsers only allow audio after a user gesture; call this from the start button. */
  unlock(): void {
    if (!this.enabled) return;
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  play(earcon: Earcon): void {
    if (!this.enabled) return;
    this.context ??= new AudioContext();
    const context = this.context;
    if (context.state === 'suspended') void context.resume();

    const spec = TONES[earcon];
    spec.notes.forEach((frequency, index) => {
      const start = context.currentTime + index * spec.noteSeconds;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      // A short envelope, so the tone reads as a tick rather than a beep.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(spec.gain, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.noteSeconds);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + spec.noteSeconds + 0.02);
    });
  }
}
