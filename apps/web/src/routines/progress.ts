/**
 * The series behind the progress chart.
 *
 * Apart from the screen for the same reason the report's aggregation is: the
 * rules are not obvious. The best day depends on the direction the metric
 * moves, days with no measurement are a gap in the line rather than a zero,
 * and a unilateral exercise is two subjects rather than one — plotting both
 * limbs as a single line would report the better one and hide the weaker,
 * which in rehabilitation is the one being treated.
 */

import type { PrescribedSide, SetRecord } from '../db/schema.js';

/** One line on the chart: an exercise, or one limb of a unilateral exercise. */
export interface Subject {
  exerciseId: string;
  side?: PrescribedSide;
}

export interface DayPoint {
  /** ISO date, `YYYY-MM-DD`. */
  day: string;
  /** Best range of the day in degrees, or null on a day that produced none. */
  rom: number | null;
  reps: number;
  /** Mean percentage of repetitions that reached the band, that day. */
  good: number;
  /** A set from that day, so the chart can open the skeleton replay. */
  setId: number;
}

export function subjectKey(subject: Subject): string {
  return subject.side ? `${subject.exerciseId}|${subject.side}` : subject.exerciseId;
}

/** Every exercise-and-side the history holds, in the order it first appears. */
export function subjectsIn(sets: readonly SetRecord[]): Subject[] {
  const seen = new Map<string, Subject>();
  for (const set of sets) {
    if (set.measured === false) continue;
    const subject: Subject = set.side
      ? { exerciseId: set.exerciseId, side: set.side }
      : { exerciseId: set.exerciseId };
    const key = subjectKey(subject);
    if (!seen.has(key)) seen.set(key, subject);
  }
  return [...seen.values()];
}

function belongsTo(set: SetRecord, subject: Subject): boolean {
  return set.exerciseId === subject.exerciseId && set.side === subject.side;
}

/**
 * One point per day the subject was trained, oldest first.
 *
 * @param decreasing True for a metric whose target is a smaller angle, where
 *   the best day is the lowest peak rather than the highest.
 */
export function dailySeries(
  sets: readonly SetRecord[],
  subject: Subject,
  decreasing: boolean,
): DayPoint[] {
  const byDay = new Map<string, { rom: number[]; reps: number; good: number[]; setId: number }>();
  for (const set of sets) {
    if (!belongsTo(set, subject)) continue;
    // A guided set measured nothing, so it has no place on a chart of range.
    // It is not a bad day; it is a day with no reading, and drawing it would
    // invent a dip that never happened.
    if (set.measured === false) continue;
    const day = new Date(set.startedAt).toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { rom: [], reps: 0, good: [], setId: set.id };
    // A peak of zero means the set produced no measurement; it is not a day at
    // zero degrees, so it stays out of the range and leaves a gap in the line.
    if (set.romMax > 0) bucket.rom.push(set.romMax);
    bucket.reps += set.reps;
    bucket.good.push(set.goodRepPct);
    byDay.set(day, bucket);
  }

  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, bucket]) => ({
      day,
      rom: bucket.rom.length
        ? Math.round(decreasing ? Math.min(...bucket.rom) : Math.max(...bucket.rom))
        : null,
      reps: bucket.reps,
      good: Math.round(bucket.good.reduce((total, value) => total + value, 0) / bucket.good.length),
      setId: bucket.setId,
    }));
}
