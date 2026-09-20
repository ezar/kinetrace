/**
 * Exercise programmes published by somebody else, transcribed.
 *
 * ADR 7 left a hole on purpose. Every dose in the library is `authored` —
 * written by hand, with no source — and the provenance value `clinical` was
 * deliberately not created, because "a number taken from a clinical source has
 * to name it, and adding the value before there is a citation to go with it is
 * exactly how an authored number ends up looking sourced."
 *
 * This is the first citation. It is not a personalised prescription and must
 * never be shown as one: it is a printed patient programme from a professional
 * society, transcribed exactly, so that a routine built from it can say where
 * every number came from.
 *
 * Three rules hold everything here together.
 *
 * - **The document speaks for itself.** Each step keeps the publication's own
 *   title and its own instruction, verbatim and in the language it was printed
 *   in. They are a quotation, not UI copy, so they are not translated and they
 *   do not live in the dictionaries.
 * - **A step is matched only when the library has that exercise**, not
 *   something adjacent to it. Three of these ten have no match, each for a
 *   stated reason, and they are kept in the list rather than dropped — a
 *   programme the app can only partly run should say so on the part it
 *   cannot. The bar is the movement, not the name: two steps were matched
 *   here on their titles and had to be taken back out, because the library's
 *   exercise of that name asks the body to do something else. Three others
 *   were matched the other way round, by writing the exercise the document
 *   describes rather than bending the document to fit the library, and a
 *   fourth by adding the metric that exercise needed.
 * - **Nothing here is interpreted.** No ordering logic, no substitutions, no
 *   progression. Which of these a given person should do is the professional's
 *   call, and the routine this builds is unsigned like any other.
 */

import type { TargetBand, TempoTarget } from '@kinetrace/engine';

/** Where a programme was published. Enough to find the document again. */
export interface ProgrammeSource {
  /** Title as printed on the document. */
  title: string;
  /** The body that published it. */
  publisher: string;
  /** Year printed on the document, or the year of the file it came from. */
  year: number;
  url?: string;
}

/** The dose for one exercise, as this programme prints it. */
export interface ProgrammeDose {
  exerciseId: string;
  sets: number;
  /** Repetitions per set, for an exercise the library counts in repetitions. */
  reps?: number;
  /** Hold per set in seconds, for an exercise the library counts in time. */
  holdSeconds?: number;
  /**
   * Zero wherever the document is silent, which is everywhere: none of these
   * programmes print a rest. It only has a visible effect where sets is above
   * one, and there it is the honest reading — the document's repetitions run
   * one after another, not as sets with a pause between them.
   */
  restSeconds: number;
  /** The printed hold, expressed as the pace of the phase it belongs to. */
  tempo?: TempoTarget[];
  /**
   * The range the document asks for, when it prints one.
   *
   * A library exercise carries its own default band, chosen for the exercise
   * rather than for any one programme. Where a document states how far the
   * movement should go, the routine built from it carries that instead —
   * otherwise the app marks a repetition short while the person is doing
   * exactly what the paper told them. The conversion from the document's units
   * into degrees belongs with the step that needed it, and is written down
   * there.
   *
   * Be precise about what the two ends do, because they are not symmetric. The
   * engine decides a repetition on the near end alone: `isGoodPeak` asks
   * whether an increasing movement reached `min`, or a decreasing one reached
   * `max`, and says nothing about overshooting. That has been true of every
   * band in this library since the engine was written, and it is not this
   * field's business to change it. So the near end is the one that has to be
   * right — it is what stopped the leg raise calling a correct repetition
   * short — and the far end is the top of the range as printed, which the
   * screens show and a professional reads.
   */
  band?: TargetBand;
}

/**
 * Why a printed step has no exercise behind it.
 *
 * A code rather than a sentence, because the app renders it and ADR 3 keeps
 * text in the dictionaries. `notInLibrary` is an absence; `differentExercise`
 * is the dangerous one — the library has something with a similar name doing a
 * different movement, and matching them would be the exact mistake this file
 * exists to avoid.
 */
export type ProgrammeOmission = 'notInLibrary' | 'differentExercise';

/** One numbered step of a printed programme. */
export interface ProgrammeStep {
  /** Position in the document, from one. Kept so an omission stays visible. */
  step: number;
  /** The document's own name for the exercise, verbatim. */
  title: string;
  /** The document's own instruction, verbatim. */
  instruction: string;
  /** Series and repetitions exactly as printed, before any mapping. */
  printed: { sets: number; reps: number };
  /** The library exercise this step is, when the library has it. */
  dose?: ProgrammeDose;
  /** Set when there is no exercise, with the library id that was rejected. */
  omission?: { reason: ProgrammeOmission; near?: string };
}

export interface Programme {
  id: string;
  source: ProgrammeSource;
  steps: readonly ProgrammeStep[];
}

/**
 * SERMEF, "Programas de ejercicios para Columna Lumbar".
 *
 * Ten exercises over four pages, each with a drawing, an instruction and a
 * dose. The document prints no order of its own beyond the order of its pages,
 * no frequency, no progression and nothing about pain: everything it says is
 * below, and everything it does not say stays unsaid here.
 */
export const SERMEF_LUMBAR: Programme = {
  id: 'sermef-lumbar',
  source: {
    title: 'Programas de ejercicios para Columna Lumbar',
    publisher: 'Sociedad Española de Rehabilitación y Medicina Física (SERMEF)',
    year: 2013,
    url: 'http://www.sermef.es',
  },
  steps: [
    {
      step: 1,
      title: 'Báscula pélvica en supino',
      instruction:
        'Apretar el abdomen, contraer los glúteos y hacer que éstos se despeguen del suelo 1-2 cm, y aplanar la columna lumbar. Mantener 5 segundos y volver a la posición inicial.',
      printed: { sets: 1, reps: 10 },
      // Same name, same joint, further travel. The library's pelvic tilt ends
      // where this one begins: its fourth instruction is that the hips never
      // leave the floor, and this asks for the glutes to lift off it. Matching
      // them would put that instruction on screen underneath a quotation
      // asking for the opposite.
      omission: { reason: 'differentExercise', near: 'pelvic-tilt' },
    },
    {
      step: 2,
      title: 'Abdominales inferiores',
      instruction:
        'Flexionar los miembros inferiores, llevando las rodillas al pecho. Mantener 5 segundos y volver a la posición inicial.',
      printed: { sets: 1, reps: 10 },
      dose: {
        exerciseId: 'active-double-knee-raise',
        sets: 1,
        reps: 10,
        restSeconds: 0,
        tempo: [{ phase: 'top', seconds: 5 }],
      },
    },
    {
      step: 3,
      title: 'Abdominales superiores de frente (manos suelo)',
      instruction:
        'Elevar la parte superior del tronco unos 25 cm. Mantener 3 segundos y volver a la posición inicial.',
      printed: { sets: 1, reps: 10 },
      dose: {
        exerciseId: 'supine-trunk-curl',
        sets: 1,
        reps: 10,
        restSeconds: 0,
        tempo: [{ phase: 'top', seconds: 3 }],
      },
    },
    {
      step: 4,
      title: 'Abdominales superiores cruzados (manos suelo)',
      instruction:
        'Dirigir el hombro de un lado hacia la rodilla contralateral. Mantener 3 segundos y volver a la posición inicial. Repetir con el lado contrario.',
      printed: { sets: 1, reps: 10 },
      omission: { reason: 'notInLibrary' },
    },
    {
      step: 5,
      title: 'Puente',
      instruction:
        'Elevar la pelvis extendiendo ambas caderas hasta alinear los muslos con el tronco. Mantener 5 segundos y volver a la posición inicial.',
      printed: { sets: 1, reps: 10 },
      dose: {
        exerciseId: 'glute-bridge',
        sets: 1,
        reps: 10,
        restSeconds: 0,
        tempo: [{ phase: 'top', seconds: 5 }],
      },
    },
    {
      step: 6,
      title: 'Extensión de tronco en prono',
      instruction:
        'Extender el tronco en bloque desde la cintura hasta colocarlo en la misma línea que los miembros inferiores, con la cabeza alineada con el tronco. Mantener 5 segundos y volver a la posición inicial.',
      printed: { sets: 1, reps: 10 },
      dose: {
        exerciseId: 'prone-trunk-extension',
        sets: 1,
        reps: 10,
        restSeconds: 0,
        tempo: [{ phase: 'top', seconds: 5 }],
      },
    },
    {
      step: 7,
      title: 'Elevación de pierna extendida',
      instruction:
        'Elevar la pierna colocada arriba 20-30 cm. Mantener 5 segundos y volver a la posición inicial. Repetir con la otra pierna.',
      printed: { sets: 1, reps: 10 },
      dose: {
        exerciseId: 'side-lying-leg-raise',
        sets: 1,
        reps: 10,
        restSeconds: 0,
        tempo: [{ phase: 'top', seconds: 5 }],
        // The one step in this document that prints a distance rather than a
        // count. Twenty to thirty centimetres at the ankle is 13 to 20 degrees
        // of abduction on the body model's 0.86 m leg, rounded outwards by a
        // degree at each end so that somebody at either end of the printed
        // range is inside the band rather than on its edge. The library's own
        // default is wider, because a side-lying leg raise is not only ever
        // this document's.
        band: { min: 12, max: 21 },
      },
    },
    {
      step: 8,
      title: 'Estiramiento lumbosacro en suelo',
      instruction:
        'Flexionar las rodillas y las caderas hasta sentarse sobre los talones, flexionando a la vez el cuello. Deslizar las manos hacia delante al finalizar el movimiento. Mantener 10-30 segundos y volver a la posición inicial.',
      printed: { sets: 1, reps: 4 },
      // A hold has to be one number and the document prints a range, so this
      // takes the bottom of it. The printed instruction travels with the
      // routine, so the other end of the range is never lost.
      dose: { exerciseId: 'childs-pose', sets: 4, holdSeconds: 10, restSeconds: 0 },
    },
    {
      step: 9,
      title: 'Gato-camello',
      instruction:
        'Arquear la columna hacia arriba, flexionando el cuello. Mantener 5 segundos. Arquear la columna hacia abajo, extendiendo el cuello. Mantener 5 segundos.',
      printed: { sets: 1, reps: 5 },
      dose: {
        exerciseId: 'cat-camel',
        sets: 1,
        reps: 5,
        restSeconds: 0,
        tempo: [
          { phase: 'cat', seconds: 5 },
          { phase: 'camel', seconds: 5 },
        ],
      },
    },
    {
      step: 10,
      title: 'Elevación brazo-pierna alternativa',
      instruction:
        'Elevar el miembro superior hasta la horizontal. Mantener 5 segundos y volver a la posición inicial. Elevar el miembro inferior del lado contrario. Mantener 5 segundos y volver a la posición inicial. Repetir con las otras dos extremidades.',
      printed: { sets: 1, reps: 10 },
      // Arm, down, then the opposite leg, down. The library's bird dog lifts
      // both at once, which is the harder exercise this one leads up to.
      omission: { reason: 'differentExercise', near: 'bird-dog' },
    },
  ],
};

/** Every published programme, by id. One so far. */
export const PROGRAMMES: readonly Programme[] = [SERMEF_LUMBAR];

/** The steps a programme brings an exercise for, in the document's order. */
export function programmeDoses(programme: Programme): ProgrammeDose[] {
  return programme.steps.flatMap((step) => (step.dose ? [step.dose] : []));
}

/** The steps the library cannot run, in the document's order. */
export function programmeOmissions(programme: Programme): ProgrammeStep[] {
  return programme.steps.filter((step) => step.omission !== undefined);
}
