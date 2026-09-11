/**
 * The import pipeline.
 *
 * Photo -> OCR -> blocks -> structuring -> lexical cross-check -> review.
 * Nothing is saved without the user seeing it: the import is an accelerator,
 * never a silent action.
 */

import { libraryIndex, type ExerciseDefinition } from '@kinetrace/exercises';
import { groupIntoBlocks } from './blocks.js';
import { structureLexically } from './lexical.js';
import { parsePrescription } from './parse.js';
import type { ImportResult, ImportedItem, OcrProvider, StructuringProvider } from './types.js';

export interface PipelineOptions {
  ocr: OcrProvider;
  /** Omitted or unavailable means the lexical matcher does the structuring alone. */
  structuring?: StructuringProvider;
  exercises: readonly ExerciseDefinition[];
  onProgress?: (stage: 'ocr' | 'structuring', fraction: number) => void;
}

/**
 * Merge the model's answer with the lexical matcher's.
 *
 * Agreement raises confidence, disagreement lowers it and flags the item for
 * review. A model id that the matcher cannot corroborate is kept, but never at
 * full confidence.
 */
export function crossCheck(
  modelItems: readonly ImportedItem[],
  lexicalItems: readonly ImportedItem[],
): ImportedItem[] {
  return modelItems.map((item, index) => {
    const lexical = lexicalItems[index];
    if (!lexical) return item;

    const merged: ImportedItem = {
      ...item,
      sets: item.sets ?? lexical.sets,
      reps: item.reps ?? lexical.reps,
      holdSeconds: item.holdSeconds ?? lexical.holdSeconds,
      sides: item.sides ?? lexical.sides,
    };

    if (item.exerciseId && lexical.exerciseId === item.exerciseId) {
      return {
        ...merged,
        origin: 'model+lexical',
        confidence: Math.min(1, Math.max(item.confidence, lexical.confidence) + 0.1),
      };
    }
    if (item.exerciseId && lexical.exerciseId && lexical.exerciseId !== item.exerciseId) {
      return { ...merged, origin: 'model', confidence: Math.min(item.confidence, 0.45) };
    }
    if (!item.exerciseId && lexical.exerciseId) {
      return {
        ...merged,
        ...lexical,
        origin: 'lexical',
        confidence: Math.min(lexical.confidence, 0.6),
      };
    }
    if (item.exerciseId) return { ...merged, confidence: Math.min(item.confidence, 0.7) };
    return { ...merged, origin: 'unmatched', confidence: 0 };
  });
}

export async function importSheet(image: Blob, options: PipelineOptions): Promise<ImportResult> {
  const warnings: string[] = [];
  const ocr = await options.ocr.recognize(image, (fraction) =>
    options.onProgress?.('ocr', fraction),
  );
  const blocks = groupIntoBlocks(ocr.lines);
  const lexicalItems = structureLexically(blocks, options.exercises);

  let items = lexicalItems;
  let structuringEngine = 'lexical';

  const structuring = options.structuring;
  if (structuring && (await structuring.isAvailable())) {
    try {
      const modelItems = await structuring.structure(
        blocks,
        libraryIndex(options.exercises),
        (fraction) => options.onProgress?.('structuring', fraction),
      );
      items = crossCheck(modelItems, lexicalItems);
      structuringEngine = structuring.id;
    } catch (error) {
      warnings.push(
        `The language model failed (${error instanceof Error ? error.message : 'unknown error'}), so names were matched by text only.`,
      );
    }
  } else if (structuring) {
    warnings.push('The language model is not downloaded, so names were matched by text only.');
  }

  // Whatever the model said, numbers that are plainly on the line win.
  items = items.map((item) => {
    const parsed = parsePrescription(item.sourceText);
    return {
      ...item,
      sets: item.sets ?? parsed.sets,
      reps: item.reps ?? parsed.reps,
      holdSeconds: item.holdSeconds ?? parsed.holdSeconds,
      sides: item.sides ?? parsed.sides,
    };
  });

  if (items.every((item) => !item.exerciseId)) {
    warnings.push(
      'Nothing on the sheet matched the library. Check the photo or add the exercises by hand.',
    );
  }

  return {
    items,
    sourceText: ocr.lines.map((line) => line.text).join('\n'),
    engine: { ocr: ocr.engine, structuring: structuringEngine },
    warnings,
  };
}
