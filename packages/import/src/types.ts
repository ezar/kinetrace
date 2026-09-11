/**
 * Sheet import types.
 *
 * The pipeline is photo -> OCR -> structuring -> lexical cross-check -> review.
 * The two model-backed stages sit behind these interfaces so that the heavy
 * browser implementations (Florence-2, WebLLM) can be swapped for Tesseract, a
 * built-in browser model, or nothing at all.
 */

/** A line of text the OCR found, with where it sat on the page. */
export interface OcrLine {
  text: string;
  /** Bounding box in normalised page coordinates, `[0, 1]`. */
  box: { x: number; y: number; width: number; height: number };
  /** Detector confidence, `[0, 1]`. */
  confidence: number;
}

export interface OcrResult {
  lines: OcrLine[];
  /** Identifier of the model that produced the text, shown in the review screen. */
  engine: string;
}

export interface OcrProvider {
  readonly id: string;
  /** Approximate download size in megabytes, shown before the model is fetched. */
  readonly sizeMb: number;
  isAvailable(): Promise<boolean>;
  recognize(image: Blob, onProgress?: (fraction: number) => void): Promise<OcrResult>;
}

/** One exercise as it appears on the sheet, before the user reviews it. */
export interface ImportedItem {
  /** The text the line came from, always kept so the user can check it. */
  sourceText: string;
  /** Library exercise id, or null when nothing matched confidently. */
  exerciseId: string | null;
  /** `[0, 1]`. Lowered when the model and the lexical matcher disagree. */
  confidence: number;
  sets?: number;
  reps?: number;
  holdSeconds?: number;
  /** Whether the sheet asks for both sides. */
  sides?: 'both' | 'left' | 'right';
  notes?: string;
  /** How the mapping was reached, shown as a badge in the review screen. */
  origin: 'model' | 'lexical' | 'model+lexical' | 'unmatched';
}

export interface StructuringProvider {
  readonly id: string;
  readonly sizeMb: number;
  isAvailable(): Promise<boolean>;
  /**
   * Turn OCR blocks into structured items. Implementations must return items in
   * the same order as the blocks and must use `null` rather than guess.
   */
  structure(
    blocks: string[],
    libraryIndex: Array<{ id: string; es: string; en: string; synonyms: string[] }>,
    onProgress?: (fraction: number) => void,
  ): Promise<ImportedItem[]>;
}

export interface ImportResult {
  items: ImportedItem[];
  /** The OCR text, kept so the user can see what was read. Never the photo. */
  sourceText: string;
  engine: { ocr: string; structuring: string };
  warnings: string[];
}
