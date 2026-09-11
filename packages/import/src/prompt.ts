/** Prompt used to turn OCR blocks into structured routine items. */

import { OUTPUT_SCHEMA } from './schema.js';

export interface PromptInput {
  blocks: readonly string[];
  libraryIndex: ReadonlyArray<{ id: string; es: string; en: string; synonyms: string[] }>;
  /** Validation errors from a previous attempt, for the single retry. */
  previousErrors?: string[];
}

export function buildStructuringPrompt({
  blocks,
  libraryIndex,
  previousErrors,
}: PromptInput): string {
  const index = libraryIndex
    .map((entry) => `${entry.id} | ${entry.es} | ${entry.en} | ${entry.synonyms.join(', ')}`)
    .join('\n');
  const lines = blocks.map((block, position) => `${position + 1}. ${block}`).join('\n');
  const retry = previousErrors?.length
    ? `\nYour previous answer was rejected:\n${previousErrors.map((error) => `- ${error}`).join('\n')}\nFix those problems.\n`
    : '';

  return `You convert a physiotherapy exercise sheet into structured data.

Exercise library (id | Spanish name | English name | synonyms):
${index}

Rules:
- Return one item per numbered line, in the same order.
- exerciseId must be an id from the library above. If you are not sure, return null. Never invent an id.
- Copy the line into sourceText exactly as given.
- Only fill sets, reps and holdSeconds with numbers that appear on the line.
- Answer with JSON only, no explanation, matching this schema:
${OUTPUT_SCHEMA}
${retry}
Lines:
${lines}`;
}
