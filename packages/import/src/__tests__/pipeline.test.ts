import { describe, expect, it } from 'vitest';
import { EXERCISES } from '@kinetrace/exercises';
import { groupIntoBlocks } from '../blocks.js';
import { exerciseNamePart, parsePrescription } from '../parse.js';
import { structureLexically } from '../lexical.js';
import { validateStructuredItems } from '../schema.js';
import { buildStructuringPrompt } from '../prompt.js';
import { crossCheck, importSheet } from '../pipeline.js';
import type { ImportedItem, OcrLine, OcrProvider, StructuringProvider } from '../types.js';

function line(text: string, y: number, x = 0.1): OcrLine {
  return { text, box: { x, y, width: 0.8, height: 0.04 }, confidence: 0.9 };
}

/** A plausible Spanish sheet, of the kind a physiotherapist prints out. */
const SHEET: OcrLine[] = [
  line('Ejercicios para casa', 0.05),
  line('1. Puente de glúteos 3x12', 0.15),
  line('2. Plancha frontal, mantener 30 segundos, 3 series', 0.25),
  line('3. Bicho muerto 3 series de 10 cada lado', 0.35),
  line('4. Gato-vaca 2x10, despacio', 0.45),
  line('5. Bicicleta estática 20 minutos', 0.55),
];

describe('groupIntoBlocks', () => {
  it('starts a block at every bullet or number', () => {
    const blocks = groupIntoBlocks(SHEET);
    expect(blocks).toHaveLength(6);
    expect(blocks[1]).toContain('Puente de glúteos');
  });

  it('joins continuation lines into the block above them', () => {
    const blocks = groupIntoBlocks([
      line('1. Puente de glúteos', 0.2),
      {
        ...line('sin arquear la espalda', 0.241),
        box: { x: 0.15, y: 0.241, width: 0.5, height: 0.04 },
      },
      line('2. Plancha frontal', 0.32),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toBe('Puente de glúteos sin arquear la espalda');
  });
});

describe('parsePrescription', () => {
  it('reads the Spanish shapes', () => {
    expect(parsePrescription('Puente de glúteos 3x12')).toMatchObject({ sets: 3, reps: 12 });
    expect(parsePrescription('3 series de 10 repeticiones')).toMatchObject({ sets: 3, reps: 10 });
    expect(parsePrescription('mantener 30 segundos')).toMatchObject({ holdSeconds: 30 });
    expect(parsePrescription('2x10 cada lado')).toMatchObject({ sides: 'both' });
    expect(parsePrescription('plancha 1 minuto')).toMatchObject({ holdSeconds: 60 });
  });

  it('reads the English shapes', () => {
    expect(parsePrescription('3 sets of 12 reps')).toMatchObject({ sets: 3, reps: 12 });
    expect(parsePrescription('hold for 45 seconds each side')).toMatchObject({
      holdSeconds: 45,
      sides: 'both',
    });
  });

  it('does not mistake repetition counts for a hold', () => {
    expect(parsePrescription('3x12').holdSeconds).toBeUndefined();
  });

  it('strips the prescription from the name', () => {
    expect(exerciseNamePart('Puente de glúteos 3x12, cada lado')).toBe('Puente de glúteos');
  });
});

describe('structureLexically', () => {
  it('maps the sheet onto library ids and leaves the rest unmatched', () => {
    const items = structureLexically(groupIntoBlocks(SHEET), EXERCISES);
    const byId = items.map((item) => item.exerciseId);
    expect(byId).toContain('glute-bridge');
    expect(byId).toContain('front-plank');
    expect(byId).toContain('dead-bug');
    expect(byId).toContain('cat-camel');
    const bicycle = items.find((item) => item.sourceText.includes('Bicicleta'));
    expect(bicycle?.exerciseId).toBeNull();
    expect(bicycle?.origin).toBe('unmatched');
  });

  it('carries the prescription through', () => {
    const items = structureLexically(groupIntoBlocks(SHEET), EXERCISES);
    const plank = items.find((item) => item.exerciseId === 'front-plank');
    expect(plank).toMatchObject({ sets: 3, holdSeconds: 30 });
  });
});

describe('validateStructuredItems', () => {
  const known = new Set(EXERCISES.map((exercise) => exercise.id));

  it('accepts a well formed answer', () => {
    const { items, issues } = validateStructuredItems(
      [
        {
          sourceText: 'Puente 3x12',
          exerciseId: 'glute-bridge',
          confidence: 0.9,
          sets: 3,
          reps: 12,
        },
      ],
      known,
    );
    expect(issues).toHaveLength(0);
    expect(items[0]).toMatchObject({ exerciseId: 'glute-bridge', sets: 3, reps: 12 });
  });

  it('rejects an invented exercise id but keeps the line', () => {
    const { items, issues } = validateStructuredItems(
      [{ sourceText: 'Algo raro', exerciseId: 'moon-walk', confidence: 1 }],
      known,
    );
    expect(issues[0]?.message).toContain('moon-walk');
    expect(items[0]?.exerciseId).toBeNull();
  });

  it('rejects impossible numbers', () => {
    const { issues } = validateStructuredItems(
      [{ sourceText: 'Puente', exerciseId: 'glute-bridge', confidence: 1, reps: 9000 }],
      known,
    );
    expect(issues.some((issue) => issue.message.includes('reps'))).toBe(true);
  });

  it('rejects anything that is not an array', () => {
    expect(validateStructuredItems({ items: [] }, known).issues).toHaveLength(1);
  });
});

describe('buildStructuringPrompt', () => {
  it('includes every library id and the retry errors', () => {
    const prompt = buildStructuringPrompt({
      blocks: ['Puente de glúteos 3x12'],
      libraryIndex: [{ id: 'glute-bridge', es: 'Puente', en: 'Bridge', synonyms: ['puente'] }],
      previousErrors: ['unknown exerciseId "moon-walk"'],
    });
    expect(prompt).toContain('glute-bridge');
    expect(prompt).toContain('Never invent an id');
    expect(prompt).toContain('moon-walk');
  });
});

describe('crossCheck', () => {
  const base: ImportedItem = {
    sourceText: 'Puente de glúteos 3x12',
    exerciseId: 'glute-bridge',
    confidence: 0.8,
    origin: 'model',
  };

  it('raises confidence when both agree', () => {
    const [item] = crossCheck([base], [{ ...base, confidence: 0.7, origin: 'lexical' }]);
    expect(item?.origin).toBe('model+lexical');
    expect(item?.confidence).toBeGreaterThan(0.8);
  });

  it('lowers confidence when they disagree', () => {
    const [item] = crossCheck(
      [base],
      [{ ...base, exerciseId: 'front-plank', confidence: 0.8, origin: 'lexical' }],
    );
    expect(item?.confidence).toBeLessThanOrEqual(0.45);
  });

  it('uses the lexical match when the model gave up', () => {
    const [item] = crossCheck(
      [{ ...base, exerciseId: null, confidence: 0, origin: 'unmatched' }],
      [{ ...base, confidence: 0.8, origin: 'lexical' }],
    );
    expect(item?.exerciseId).toBe('glute-bridge');
    expect(item?.origin).toBe('lexical');
  });
});

describe('importSheet', () => {
  const ocr: OcrProvider = {
    id: 'test-ocr',
    sizeMb: 0,
    isAvailable: async () => true,
    recognize: async () => ({ lines: SHEET, engine: 'test-ocr' }),
  };

  it('works with no language model at all', async () => {
    const result = await importSheet(new Blob(), { ocr, exercises: EXERCISES });
    expect(result.engine.structuring).toBe('lexical');
    expect(result.items.filter((item) => item.exerciseId).length).toBeGreaterThanOrEqual(4);
    expect(result.sourceText).toContain('Puente de glúteos');
  });

  it('falls back and warns when the language model fails', async () => {
    const failing: StructuringProvider = {
      id: 'broken',
      sizeMb: 900,
      isAvailable: async () => true,
      structure: async () => {
        throw new Error('out of memory');
      },
    };
    const result = await importSheet(new Blob(), {
      ocr,
      structuring: failing,
      exercises: EXERCISES,
    });
    expect(result.engine.structuring).toBe('lexical');
    expect(result.warnings[0]).toContain('out of memory');
  });

  it('reports progress for both stages', async () => {
    const stages: string[] = [];
    const structuring: StructuringProvider = {
      id: 'stub-llm',
      sizeMb: 900,
      isAvailable: async () => true,
      structure: async (blocks, _index, onProgress) => {
        onProgress?.(1);
        return blocks.map((block) => ({
          sourceText: block,
          exerciseId: null,
          confidence: 0,
          origin: 'unmatched' as const,
        }));
      },
    };
    await importSheet(new Blob(), {
      ocr: {
        ...ocr,
        recognize: async (_image, onProgress) => {
          onProgress?.(1);
          return { lines: SHEET, engine: 'test-ocr' };
        },
      },
      structuring,
      exercises: EXERCISES,
      onProgress: (stage) => stages.push(stage),
    });
    expect(stages).toEqual(['ocr', 'structuring']);
  });
});
