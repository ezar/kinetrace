/**
 * Group OCR lines into candidate exercise blocks.
 *
 * Physiotherapy sheets are lists: a bullet or a number starts an exercise and
 * the following indented or short lines belong to it. Layout does most of the
 * work here, which keeps the language model's job small.
 */

import type { OcrLine } from './types.js';

const BULLET = /^\s*([-•*·–—]|\d{1,2}[.)]|[a-z][.)])\s+/i;

/** True when a line looks like the start of a new exercise. */
export function startsBlock(line: OcrLine, previous: OcrLine | null): boolean {
  if (BULLET.test(line.text)) return true;
  if (!previous) return true;
  // A clear vertical gap also starts a block.
  const gap = line.box.y - (previous.box.y + previous.box.height);
  return gap > previous.box.height * 0.8;
}

/** Join OCR lines into one string per exercise, in reading order. */
export function groupIntoBlocks(lines: readonly OcrLine[]): string[] {
  const sorted = [...lines].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const blocks: string[] = [];
  let current: string[] = [];
  let previous: OcrLine | null = null;

  for (const line of sorted) {
    const text = line.text.trim();
    if (!text) continue;
    if (startsBlock(line, previous) && current.length > 0) {
      blocks.push(current.join(' '));
      current = [];
    }
    current.push(text.replace(BULLET, ''));
    previous = line;
  }
  if (current.length > 0) blocks.push(current.join(' '));
  return blocks.filter((block) => block.trim().length > 2);
}
