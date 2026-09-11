/**
 * Lexical structuring.
 *
 * Doubles as the fallback when no language model is available and as the
 * cross-check on whatever the model returned. It needs no download, so the
 * import flow always works, just less well.
 */

import { matchExercise, type ExerciseDefinition } from '@kinetrace/exercises';
import { exerciseNamePart, parsePrescription } from './parse.js';
import type { ImportedItem, StructuringProvider } from './types.js';

export function structureLexically(
  blocks: readonly string[],
  exercises: readonly ExerciseDefinition[],
): ImportedItem[] {
  return blocks.map((block) => {
    const name = exerciseNamePart(block);
    const match = matchExercise(name, exercises);
    const prescription = parsePrescription(block);
    return {
      sourceText: block,
      exerciseId: match?.exerciseId ?? null,
      confidence: match ? Math.min(0.9, match.confidence) : 0,
      origin: match ? 'lexical' : 'unmatched',
      ...prescription,
    };
  });
}

/** Structuring provider that uses nothing but the library's own names. */
export function createLexicalStructurer(
  exercises: readonly ExerciseDefinition[],
): StructuringProvider {
  return {
    id: 'lexical',
    sizeMb: 0,
    isAvailable: async () => true,
    structure: async (blocks) => structureLexically(blocks, exercises),
  };
}
