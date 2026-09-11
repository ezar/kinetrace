/**
 * Translation.
 *
 * Dictionaries only, Spanish first. Cue and camera tip keys come from the
 * exercise library, so the engine can emit a key and the app can say it.
 */

import { EXERCISE_TEXT } from '@kinetrace/exercises';
import { en } from './en.js';
import { es, type TranslationKey } from './es.js';

export type Language = 'es' | 'en';
export type { TranslationKey };

export const LANGUAGES: Language[] = ['es', 'en'];

export const LANGUAGE_NAMES: Record<Language, string> = {
  es: 'Español',
  en: 'English',
};

const DICTIONARIES: Record<Language, Record<string, string>> = { es, en };

/** Interpolate `{name}` placeholders. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

/**
 * Translate a key. Unknown keys fall back to the exercise library dictionary,
 * then to Spanish, then to the key itself, so a missing string is visible in
 * development but never blank in production.
 */
export function translate(
  language: Language,
  key: string,
  params?: Record<string, string | number>,
): string {
  const fromApp = DICTIONARIES[language][key] ?? es[key as TranslationKey];
  if (fromApp) return interpolate(fromApp, params);
  const fromLibrary = EXERCISE_TEXT[key];
  if (fromLibrary) return interpolate(fromLibrary[language], params);
  return key;
}

export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'es';
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es';
}
