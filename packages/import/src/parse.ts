/**
 * Pull sets, repetitions and hold times out of a line of a sheet.
 *
 * Handles the shapes a Spanish or English sheet actually uses: "3x10",
 * "3 series de 12", "2 sets of 15", "mantener 30 s", "hold for 30 seconds",
 * "cada lado", "each side".
 */

export interface ParsedPrescription {
  sets?: number;
  reps?: number;
  holdSeconds?: number;
  sides?: 'both' | 'left' | 'right';
}

const SETS_BY_REPS = /(\d{1,2})\s*[x×]\s*(\d{1,3})/i;
const SETS_WORDS = /(\d{1,2})\s*(?:series|sets|tandas)/i;
const REPS_WORDS = /(\d{1,3})\s*(?:repeticiones|reps?|repes|veces)/i;
const REPS_OF = /(?:de|of)\s*(\d{1,3})\s*(?:repeticiones|reps?|veces)?/i;
const HOLD_SECONDS =
  /(?:mantener|manten|aguantar|sostener|hold(?:ing)?(?:\s*for)?)?\s*(\d{1,3})\s*(?:segundos|segs?|seg|s\b|seconds?|sec\b)/i;
const HOLD_MINUTES = /(\d{1,2})\s*(?:minutos?|mins?\b)/i;
const BOTH_SIDES = /cada\s+lado|ambos\s+lados|each\s+side|both\s+sides|por\s+lado/i;
const LEFT_ONLY = /(?:lado\s+)?izquierd[oa]|left\s+side/i;
const RIGHT_ONLY = /(?:lado\s+)?derech[oa]|right\s+side/i;

export function parsePrescription(text: string): ParsedPrescription {
  const result: ParsedPrescription = {};

  const byReps = SETS_BY_REPS.exec(text);
  if (byReps) {
    result.sets = Number(byReps[1]);
    result.reps = Number(byReps[2]);
  } else {
    const sets = SETS_WORDS.exec(text);
    if (sets) result.sets = Number(sets[1]);
    const reps = REPS_WORDS.exec(text) ?? (sets ? REPS_OF.exec(text.slice(sets.index)) : null);
    if (reps) result.reps = Number(reps[1]);
  }

  const holdMinutes = HOLD_MINUTES.exec(text);
  const holdSeconds = HOLD_SECONDS.exec(text);
  if (holdMinutes) result.holdSeconds = Number(holdMinutes[1]) * 60;
  else if (holdSeconds) {
    const seconds = Number(holdSeconds[1]);
    // "3x10" already consumed those numbers; a hold has to be its own figure.
    if (!byReps || (seconds !== result.sets && seconds !== result.reps)) {
      result.holdSeconds = seconds;
    }
  }

  if (BOTH_SIDES.test(text)) result.sides = 'both';
  else if (LEFT_ONLY.test(text)) result.sides = 'left';
  else if (RIGHT_ONLY.test(text)) result.sides = 'right';

  return result;
}

/** Strip the prescription numbers so only the exercise name is matched. */
export function exerciseNamePart(text: string): string {
  return text
    .replace(SETS_BY_REPS, ' ')
    .replace(SETS_WORDS, ' ')
    .replace(REPS_WORDS, ' ')
    .replace(HOLD_SECONDS, ' ')
    .replace(HOLD_MINUTES, ' ')
    .replace(BOTH_SIDES, ' ')
    .replace(/[:,;.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
