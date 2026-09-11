/**
 * Lexical exercise matching.
 *
 * Used twice by the sheet import: to build the index the local language model
 * is prompted with, and afterwards to cross-check whatever it returned. A
 * disagreement between the two lowers the confidence badge instead of silently
 * picking one.
 */

import type { ExerciseDefinition } from './types.js';

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance between two normalised strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const insertion = (current[j - 1] ?? 0) + 1;
      const deletion = (previous[j] ?? 0) + 1;
      current[j] = Math.min(substitution, insertion, deletion);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Similarity in `[0, 1]`, 1 meaning identical. */
export function similarity(a: string, b: string): number {
  const normalisedA = normalize(a);
  const normalisedB = normalize(b);
  const longest = Math.max(normalisedA.length, normalisedB.length);
  if (longest === 0) return 0;
  const base = 1 - levenshtein(normalisedA, normalisedB) / longest;
  // A candidate contained in the source text is a strong signal even when the
  // surrounding words push the edit distance up ("3x10 puente de glúteos").
  // Both sides need enough characters for containment to mean anything.
  const shortest = Math.min(normalisedA.length, normalisedB.length);
  const contained =
    shortest >= 4 && (normalisedA.includes(normalisedB) || normalisedB.includes(normalisedA))
      ? 0.85
      : 0;
  return Math.max(base, contained);
}

/**
 * Minimum similarity for a lexical match. Set by trial against the sheet
 * fixtures: lower and unrelated activities ("bicicleta estática") start
 * matching exercises that merely share a word.
 */
export const MATCH_THRESHOLD = 0.72;

export interface MatchResult {
  exerciseId: string;
  /** `[0, 1]`, from the best matching name or synonym. */
  confidence: number;
  /** The name or synonym that produced the match. */
  matchedOn: string;
}

/** All the strings an exercise can be recognised by. */
export function exerciseAliases(exercise: ExerciseDefinition): string[] {
  return [exercise.names.es, exercise.names.en, ...exercise.synonyms.es, ...exercise.synonyms.en];
}

/** Best lexical match for a line of a physiotherapist's sheet. */
export function matchExercise(
  text: string,
  exercises: readonly ExerciseDefinition[],
): MatchResult | null {
  if (normalize(text).length < 4) return null;
  let best: MatchResult | null = null;
  for (const exercise of exercises) {
    for (const alias of exerciseAliases(exercise)) {
      const score = similarity(text, alias);
      if (!best || score > best.confidence) {
        best = { exerciseId: exercise.id, confidence: score, matchedOn: alias };
      }
    }
  }
  return best && best.confidence >= MATCH_THRESHOLD ? best : null;
}

/** Compact index handed to the local language model during sheet import. */
export function libraryIndex(
  exercises: readonly ExerciseDefinition[],
): Array<{ id: string; es: string; en: string; synonyms: string[] }> {
  return exercises.map((exercise) => ({
    id: exercise.id,
    es: exercise.names.es,
    en: exercise.names.en,
    synonyms: [...exercise.synonyms.es, ...exercise.synonyms.en],
  }));
}
