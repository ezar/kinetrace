/**
 * Spoken cues.
 *
 * One utterance channel: a new cue replaces whatever is queued rather than
 * stacking, because a coach who talks over themselves is worse than a silent
 * one. Web Speech Synthesis uses the system voices, so nothing is downloaded
 * and nothing is sent anywhere.
 */

import type { Language } from '../i18n/index.js';

const LOCALES: Record<Language, string> = { es: 'es-ES', en: 'en-GB' };

export class Speaker {
  private voice: SpeechSynthesisVoice | null = null;
  private lastSpokenAt = 0;

  constructor(
    private language: Language,
    private enabled: boolean,
  ) {
    this.pickVoice();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.addEventListener('voiceschanged', () => this.pickVoice());
    }
  }

  private pickVoice(): void {
    if (typeof speechSynthesis === 'undefined') return;
    const locale = LOCALES[this.language];
    const voices = speechSynthesis.getVoices();
    this.voice =
      voices.find((voice) => voice.lang === locale) ??
      voices.find((voice) => voice.lang.startsWith(this.language)) ??
      null;
  }

  setLanguage(language: Language): void {
    this.language = language;
    this.pickVoice();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.cancel();
  }

  get isAvailable(): boolean {
    return typeof speechSynthesis !== 'undefined';
  }

  /**
   * Say a cue, cancelling anything still being spoken.
   *
   * @param onEnd Called once when the utterance finishes, is interrupted, or
   *   cannot be spoken at all. The guided session speaks a line at a time and
   *   waits for this rather than guessing how long a sentence takes; it is
   *   called exactly once either way, so a caller can await it safely.
   */
  say(text: string, onEnd?: () => void): void {
    if (!this.enabled || !this.isAvailable || !text) {
      onEnd?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LOCALES[this.language];
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    if (onEnd) {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        onEnd();
      };
      utterance.addEventListener('end', finish);
      utterance.addEventListener('error', finish);
    }
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    this.lastSpokenAt = Date.now();
  }

  /**
   * Wake the voice from inside a user gesture.
   *
   * Safari on iOS only lets speech synthesis start from a real tap, and the
   * guided session's first sentence is spoken from an effect a tick later —
   * outside the gesture, which on a phone can leave the whole session mute. A
   * silent utterance spoken from the button handler opens the channel; every
   * line after it inherits the permission.
   *
   * Harmless where it is not needed: a space is not read aloud.
   */
  unlock(): void {
    if (!this.enabled || !this.isAvailable) return;
    try {
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      speechSynthesis.speak(primer);
    } catch {
      // A browser that refuses this is a browser that was never going to speak.
    }
  }

  get busySince(): number {
    return this.lastSpokenAt;
  }

  cancel(): void {
    if (this.isAvailable) speechSynthesis.cancel();
  }
}
