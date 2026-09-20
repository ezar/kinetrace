/**
 * What a routine's citation is still worth.
 *
 * A routine built from a published programme carries the document's name, and
 * every screen that shows those numbers wants to know one thing before it
 * repeats the claim: are these still the document's numbers? The moment
 * somebody changes a dose, the citation stops covering it. It is still where
 * the routine came from; it is no longer what the routine says.
 *
 * Nothing is stored to answer that. The programme is right there, so the
 * comparison is made against it every time rather than trusted to a flag that
 * an edit somewhere else could forget to clear.
 */

import {
  PROGRAMMES,
  getExercise,
  programmeDoses,
  type Programme,
  type ProgrammeDose,
} from '@kinetrace/exercises';
import type { RoutineExercise, RoutineSource } from '../db/schema.js';

/** The transcription a routine cites, if this build of the library still has it. */
export function routineProgramme(source: RoutineSource | undefined): Programme | undefined {
  if (!source) return undefined;
  return PROGRAMMES.find((programme) => programme.id === source.programmeId);
}

function sameTempo(entry: RoutineExercise, dose: ProgrammeDose): boolean {
  const printed = dose.tempo ?? [];
  const current = entry.tempo ?? [];
  if (printed.length !== current.length) return false;
  return printed.every((target, index) => {
    const mine = current[index];
    return mine?.phase === target.phase && mine.seconds === target.seconds;
  });
}

/**
 * Whether the range on this entry is still the one the transcription implies.
 *
 * Where the document prints a range, that is the number to match. Where it
 * prints none the entry inherits the library's, and it may be carrying that
 * inherited value explicitly rather than as a blank: the review screen fills
 * every default in so the professional is looking at the numbers that will
 * actually be used, and a signature saves them. A default written down is
 * still the default, so it counts as unchanged — otherwise opening the review
 * screen would be enough to make the app stop citing the document.
 */
function sameBand(entry: RoutineExercise, dose: ProgrammeDose): boolean {
  const expected = dose.band ?? getExercise(dose.exerciseId)?.targets.band;
  if (!expected) return entry.band === undefined;
  if (!entry.band) return dose.band === undefined;
  return entry.band.min === expected.min && entry.band.max === expected.max;
}

/** Whether this entry still carries exactly the dose the programme prints. */
export function matchesProgrammeDose(entry: RoutineExercise, dose: ProgrammeDose): boolean {
  return (
    entry.sets === dose.sets &&
    entry.reps === dose.reps &&
    entry.holdSeconds === dose.holdSeconds &&
    entry.restSeconds === dose.restSeconds &&
    sameTempo(entry, dose) &&
    sameBand(entry, dose)
  );
}

/** The dose a programme prints for an exercise, if it prints one. */
export function programmeDoseFor(
  programme: Programme,
  exerciseId: string,
): ProgrammeDose | undefined {
  return programmeDoses(programme).find((dose) => dose.exerciseId === exerciseId);
}

/**
 * Whether a routine is still the transcription: the same exercises, in the
 * document's order, each with the dose it printed. Anything else — a changed
 * number, a reordering, an exercise added or dropped — and it is somebody's
 * routine that started from a document, which is a different sentence.
 */
export function isUnchangedTranscription(
  entries: readonly RoutineExercise[],
  programme: Programme,
): boolean {
  const printed = programmeDoses(programme);
  if (entries.length !== printed.length) return false;
  return printed.every((dose, index) => {
    const entry = entries[index];
    return (
      entry !== undefined &&
      entry.exerciseId === dose.exerciseId &&
      matchesProgrammeDose(entry, dose)
    );
  });
}
