/**
 * Validation of what the local language model returns.
 *
 * The model is prompted with a strict JSON schema and the library index. Its
 * answer is still checked here: unknown ids, impossible numbers and missing
 * fields are rejected rather than trusted, and the caller retries once with the
 * error before falling back to the lexical matcher.
 */

import type { ImportedItem } from './types.js';

export interface SchemaIssue {
  index: number;
  message: string;
}

export interface ValidationOutcome {
  items: ImportedItem[];
  issues: SchemaIssue[];
}

const MAX_SETS = 20;
const MAX_REPS = 200;
const MAX_HOLD_SECONDS = 600;

function optionalNumber(
  value: unknown,
  max: number,
  index: number,
  field: string,
  issues: SchemaIssue[],
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) {
    issues.push({ index, message: `${field} must be a number between 1 and ${max}` });
    return undefined;
  }
  return Math.round(value);
}

/** Validate the model's JSON against the schema and the library. */
export function validateStructuredItems(
  raw: unknown,
  knownIds: ReadonlySet<string>,
): ValidationOutcome {
  const issues: SchemaIssue[] = [];
  if (!Array.isArray(raw)) {
    return { items: [], issues: [{ index: -1, message: 'expected a JSON array of items' }] };
  }

  const items: ImportedItem[] = [];
  raw.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      issues.push({ index, message: 'expected an object' });
      return;
    }
    const record = entry as Record<string, unknown>;
    const sourceText = typeof record.sourceText === 'string' ? record.sourceText.trim() : '';
    if (!sourceText) {
      issues.push({ index, message: 'sourceText is required' });
      return;
    }

    let exerciseId: string | null = null;
    if (typeof record.exerciseId === 'string' && record.exerciseId.length > 0) {
      if (knownIds.has(record.exerciseId)) {
        exerciseId = record.exerciseId;
      } else {
        issues.push({ index, message: `unknown exerciseId "${record.exerciseId}"` });
      }
    }

    const confidence =
      typeof record.confidence === 'number' && record.confidence >= 0 && record.confidence <= 1
        ? record.confidence
        : 0.5;

    const sides = record.sides;
    items.push({
      sourceText,
      exerciseId,
      confidence: exerciseId ? confidence : 0,
      origin: exerciseId ? 'model' : 'unmatched',
      sets: optionalNumber(record.sets, MAX_SETS, index, 'sets', issues),
      reps: optionalNumber(record.reps, MAX_REPS, index, 'reps', issues),
      holdSeconds: optionalNumber(
        record.holdSeconds,
        MAX_HOLD_SECONDS,
        index,
        'holdSeconds',
        issues,
      ),
      sides: sides === 'both' || sides === 'left' || sides === 'right' ? sides : undefined,
      notes:
        typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim() : undefined,
    });
  });

  return { items, issues };
}

/** The JSON shape the model is asked for, embedded in the prompt. */
export const OUTPUT_SCHEMA = `[
  {
    "sourceText": string,        // the line exactly as it appears on the sheet
    "exerciseId": string | null, // an id from the library index, or null
    "confidence": number,        // 0 to 1
    "sets": number | null,
    "reps": number | null,
    "holdSeconds": number | null,
    "sides": "both" | "left" | "right" | null,
    "notes": string | null
  }
]`;
