/**
 * OCR with Tesseract.
 *
 * The fallback engine of the sheet import: no WebGPU needed, works everywhere,
 * and good enough on a clean printout. The heavy part is imported lazily, so a
 * user who never imports a sheet never downloads it.
 */

import type { OcrLine, OcrProvider, OcrResult } from '@kinetrace/import';
import type { Language } from '../i18n/index.js';

const TESSERACT_LANGUAGES: Record<Language, string> = { es: 'spa', en: 'eng' };

export function createTesseractOcr(language: Language): OcrProvider {
  return {
    id: 'tesseract',
    sizeMb: 15,
    isAvailable: async () => true,
    async recognize(image, onProgress): Promise<OcrResult> {
      const { createWorker } = await import('tesseract.js');
      // Both languages at once: sheets mix Spanish exercise names with English ones.
      const languages = [
        TESSERACT_LANGUAGES[language],
        TESSERACT_LANGUAGES[language === 'es' ? 'en' : 'es'],
      ].join('+');

      const worker = await createWorker(languages, 1, {
        logger: (message: { status: string; progress: number }) => {
          if (message.status === 'recognizing text') onProgress?.(message.progress);
        },
      });

      try {
        const { data } = await worker.recognize(image, {}, { blocks: true });
        // Boxes come back in pixels; normalise them with the widest block seen,
        // which is the page itself for any sheet that fills the photograph.
        const boxes = (data.blocks ?? []).map((block) => block.bbox);
        const width = Math.max(1, ...boxes.map((box) => box.x1));
        const height = Math.max(1, ...boxes.map((box) => box.y1));
        const lines: OcrLine[] = [];
        for (const block of data.blocks ?? []) {
          for (const paragraph of block.paragraphs ?? []) {
            for (const line of paragraph.lines ?? []) {
              lines.push({
                text: line.text.trim(),
                box: {
                  x: line.bbox.x0 / width,
                  y: line.bbox.y0 / height,
                  width: (line.bbox.x1 - line.bbox.x0) / width,
                  height: (line.bbox.y1 - line.bbox.y0) / height,
                },
                confidence: line.confidence / 100,
              });
            }
          }
        }
        return { lines: lines.filter((line) => line.text.length > 0), engine: 'tesseract' };
      } finally {
        await worker.terminate();
      }
    },
  };
}
