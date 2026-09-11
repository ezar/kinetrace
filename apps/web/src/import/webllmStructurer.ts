/**
 * Structuring with a local language model.
 *
 * Runs Qwen2.5 Instruct in the browser through WebLLM. The weights are
 * hundreds of megabytes, so this provider reports itself unavailable until the
 * user has accepted the download; without it the import still works through the
 * lexical matcher, just less well.
 *
 * The model's answer is validated against the schema and the library index; on
 * a validation failure it is asked once more with the errors, and after that the
 * caller falls back to the lexical matcher.
 */

import {
  buildStructuringPrompt,
  validateStructuredItems,
  type ImportedItem,
  type StructuringProvider,
} from '@kinetrace/import';

/** Small enough for a phone, large enough to follow a JSON schema. */
const SMALL_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
/** Used when the device reports enough memory. */
const LARGE_MODEL = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';

export interface WebLlmOptions {
  /** Set once the user has accepted the download in the import screen. */
  allowDownload: boolean;
  onProgress?: (fraction: number, text: string) => void;
}

function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

function pickModel(): string {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return memory >= 8 ? LARGE_MODEL : SMALL_MODEL;
}

export function createWebLlmStructurer(options: WebLlmOptions): StructuringProvider {
  const modelId = typeof navigator === 'undefined' ? SMALL_MODEL : pickModel();

  return {
    id: modelId,
    sizeMb: modelId === LARGE_MODEL ? 1800 : 950,
    isAvailable: async () => options.allowDownload && hasWebGpu(),

    async structure(blocks, libraryIndex, onProgress) {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          options.onProgress?.(report.progress, report.text);
        },
      });

      const knownIds = new Set(libraryIndex.map((entry) => entry.id));
      let previousErrors: string[] | undefined;

      // One retry with the validation errors, then the caller falls back.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        onProgress?.(attempt === 0 ? 0.5 : 0.8);
        const completion = await engine.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: buildStructuringPrompt({ blocks, libraryIndex, previousErrors }),
            },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content ?? '[]';
        let parsed: unknown;
        try {
          parsed = JSON.parse(extractJson(content));
        } catch {
          previousErrors = ['the answer was not valid JSON'];
          continue;
        }

        const { items, issues } = validateStructuredItems(parsed, knownIds);
        if (issues.length === 0 && items.length > 0) {
          onProgress?.(1);
          return alignToBlocks(items, blocks);
        }
        previousErrors = issues.map((issue) => `item ${issue.index + 1}: ${issue.message}`);
      }

      throw new Error('the model did not return a valid routine');
    },
  };
}

/** Models sometimes wrap JSON in prose or a code fence. */
function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return candidate.trim();
}

/**
 * Keep one item per block, in order, whatever the model returned. A short
 * answer is padded with unmatched items so the review screen shows every line.
 */
function alignToBlocks(items: ImportedItem[], blocks: readonly string[]): ImportedItem[] {
  return blocks.map(
    (block, index) =>
      items[index] ?? {
        sourceText: block,
        exerciseId: null,
        confidence: 0,
        origin: 'unmatched' as const,
      },
  );
}
