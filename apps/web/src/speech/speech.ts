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

  /** Say a cue, cancelling anything still being spoken. */
  say(text: string): void {
    if (!this.enabled || !this.isAvailable || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LOCALES[this.language];
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    this.lastSpokenAt = Date.now();
  }

  get busySince(): number {
    return this.lastSpokenAt;
  }

  cancel(): void {
    if (this.isAvailable) speechSynthesis.cancel();
  }
}
