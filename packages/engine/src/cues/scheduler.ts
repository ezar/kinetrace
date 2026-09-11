/**
 * Cue scheduler.
 *
 * Rules and the repetition machine both produce cue candidates. The scheduler
 * decides which single cue the user gets: safety first, then form, then praise,
 * with a global gap between corrective cues so that the app coaches instead of
 * nagging.
 */

import type { CueCandidate, CuePriority } from '../rules/engine.js';

export interface CueSchedulerOptions {
  /** Minimum time between two corrective cues, in milliseconds. */
  correctiveGapMs?: number;
  /** Minimum time between two encouragement cues, in milliseconds. */
  encouragementGapMs?: number;
}

export interface ScheduledCue extends CueCandidate {
  /** Cues are spoken through a single utterance channel so they never overlap. */
  speak: boolean;
}

const PRIORITY_ORDER: Record<CuePriority, number> = {
  safety: 0,
  form: 1,
  encouragement: 2,
};

const DEFAULT_CORRECTIVE_GAP_MS = 4000;
const DEFAULT_ENCOURAGEMENT_GAP_MS = 1500;

export class CueScheduler {
  private lastCorrectiveAt: number | null = null;
  private lastEncouragementAt: number | null = null;

  constructor(private readonly options: CueSchedulerOptions = {}) {}

  reset(): void {
    this.lastCorrectiveAt = null;
    this.lastEncouragementAt = null;
  }

  /**
   * Pick at most one cue from this frame's candidates.
   *
   * Safety cues ignore the global gap; they are the only cues allowed to
   * interrupt. Everything else waits its turn.
   */
  select(candidates: readonly CueCandidate[], timestampMs: number): ScheduledCue | null {
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );

    const correctiveGapMs = this.options.correctiveGapMs ?? DEFAULT_CORRECTIVE_GAP_MS;
    const encouragementGapMs = this.options.encouragementGapMs ?? DEFAULT_ENCOURAGEMENT_GAP_MS;

    for (const candidate of sorted) {
      if (candidate.priority === 'safety') {
        this.lastCorrectiveAt = timestampMs;
        return { ...candidate, speak: true };
      }
      if (candidate.priority === 'form') {
        if (
          this.lastCorrectiveAt !== null &&
          timestampMs - this.lastCorrectiveAt < correctiveGapMs
        ) {
          continue;
        }
        this.lastCorrectiveAt = timestampMs;
        return { ...candidate, speak: true };
      }
      if (
        this.lastEncouragementAt !== null &&
        timestampMs - this.lastEncouragementAt < encouragementGapMs
      ) {
        continue;
      }
      this.lastEncouragementAt = timestampMs;
      return { ...candidate, speak: true };
    }
    return null;
  }
}
