/**
 * Every `{placeholder}` in a string has to be filled by the code that says it.
 *
 * Nothing stops a string from drifting away from its only call site: the
 * translator leaves an unknown placeholder alone rather than throwing, which is
 * right in production and silent everywhere else. `progress.targetDefault`
 * asked for `{min}` and `{max}` while the screen passed `{band}`, and the
 * progress screen shipped reading «Objetivo {min}–{max}°» until somebody looked
 * at it.
 *
 * So this walks the source instead: every `t('key', { ... })` call is matched
 * against the placeholders the string declares, in both languages. The key has
 * to be written out for the scan to see it, so a call that picks between two
 * keys at runtime goes unchecked — a limit worth knowing rather than a reason
 * to parse TypeScript here.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../en.js';
import { es } from '../es.js';

const SOURCE = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (entry === '__tests__') continue;
      found.push(...sourceFiles(path));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts')) found.push(path);
  }
  return found;
}

function placeholdersIn(template: string): Set<string> {
  return new Set([...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ''));
}

/**
 * The argument names of a `t('key', { a: …, b: … })` call.
 *
 * Only the top level matters, so the object is walked by brace depth rather
 * than parsed: a name is a key when it sits directly inside the argument.
 */
function argumentNames(source: string, from: number): Set<string> | undefined {
  let depth = 0;
  const names = new Set<string>();
  for (let i = from; i < source.length; i += 1) {
    const character = source[i] ?? '';
    if (character === '{' || character === '(' || character === '[') depth += 1;
    else if (character === '}' || character === ')' || character === ']') {
      depth -= 1;
      if (depth === 0) return names;
      continue;
    }
    if (depth !== 1) continue;
    const key = /^(\w+)\s*:/.exec(source.slice(i));
    if (key && (i === from || /[{,\s]/.test(source[i - 1] ?? ''))) {
      names.add(key[1] ?? '');
      i += key[0].length - 1;
    }
  }
  return undefined;
}

interface Call {
  file: string;
  key: string;
  names: Set<string>;
}

const calls: Call[] = [];
for (const file of sourceFiles(SOURCE)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*'([\w.]+)'\s*,\s*(?=\{)/g)) {
    const names = argumentNames(source, match.index + match[0].length);
    if (names) calls.push({ file: file.slice(SOURCE.length), key: match[1] ?? '', names });
  }
}

describe('translation placeholders', () => {
  it('finds the calls that pass arguments', () => {
    expect(calls.length).toBeGreaterThan(10);
  });

  it.each(['es', 'en'] as const)('are all filled in %s', (language) => {
    const dictionary: Record<string, string> = language === 'es' ? es : en;
    const missing: string[] = [];
    for (const call of calls) {
      const template = dictionary[call.key];
      if (template === undefined) continue;
      for (const placeholder of placeholdersIn(template)) {
        if (!call.names.has(placeholder)) {
          missing.push(`${call.key} wants {${placeholder}}, ${call.file} passes none`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('declares the same placeholders in both languages', () => {
    const different: string[] = [];
    for (const [key, spanish] of Object.entries(es)) {
      const english = (en as Record<string, string>)[key];
      if (english === undefined) continue;
      const a = [...placeholdersIn(spanish)].sort();
      const b = [...placeholdersIn(english)].sort();
      if (a.join() !== b.join()) different.push(`${key}: es ${a.join()} vs en ${b.join()}`);
    }
    expect(different).toEqual([]);
  });
});
