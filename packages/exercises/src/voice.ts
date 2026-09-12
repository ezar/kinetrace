/**
 * What the user can say, in Spanish and in English.
 *
 * The engine's matcher holds no words, so this is the whole vocabulary. Keep it
 * small: every phrase added is another thing the recogniser can hear by
 * accident in a room where somebody is breathing hard and counting out loud.
 *
 * Phrases are written properly spelled, accents and all. The matcher strips
 * them before comparing, so it makes no difference there — but the help screen
 * prints this list to the user, and «fin de la sesion» reads as a typo.
 */

import type { VoiceCommand, VoiceGrammar } from '@kinetrace/engine';
import type { Localized } from './types.js';

type PhraseSet = { es: readonly string[]; en: readonly string[] };

export const VOICE_PHRASES: Readonly<Record<VoiceCommand, PhraseSet>> = {
  pause: {
    es: ['pausa', 'espera', 'un momento'],
    en: ['pause', 'wait', 'hold on'],
  },
  resume: {
    es: ['sigue', 'seguimos', 'continúa', 'vamos'],
    en: ['continue', 'resume', 'keep going', 'carry on'],
  },
  next: {
    es: ['siguiente', 'siguiente ejercicio', 'salta'],
    en: ['next', 'next exercise', 'skip'],
  },
  repeat: {
    es: ['repite', 'otra vez', 'qué hago'],
    en: ['repeat', 'again', 'say that again'],
  },
  // Only fires on an exact match: see the engine's grammar module.
  stop: {
    es: ['terminar', 'parar', 'fin de la sesión'],
    en: ['stop', 'finish', 'end session'],
  },
};

/** The grammar to hand the matcher for one language. */
export function voiceGrammar(language: 'es' | 'en'): VoiceGrammar {
  const grammar: Record<string, readonly string[]> = {};
  for (const [command, phrases] of Object.entries(VOICE_PHRASES)) {
    grammar[command] = phrases[language];
  }
  return grammar as VoiceGrammar;
}

/** One example phrase per command, for the help line on the session screen. */
export const VOICE_EXAMPLES: Readonly<Record<VoiceCommand, Localized>> = {
  pause: { es: 'pausa', en: 'pause' },
  resume: { es: 'sigue', en: 'continue' },
  next: { es: 'siguiente', en: 'next' },
  repeat: { es: 'repite', en: 'repeat' },
  stop: { es: 'terminar', en: 'finish' },
};
