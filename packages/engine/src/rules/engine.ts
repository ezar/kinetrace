/**
 * Form rules.
 *
 * A rule is a condition over metrics that must hold continuously for
 * `sustainMs` before it produces a cue candidate. Rules never speak: they
 * propose, and the cue scheduler decides what the user actually hears.
 */

import type { MetricFrame } from '../types.js';
import { evaluateCondition, type Condition } from './conditions.js';

/** Cue priority. Safety always wins, encouragement always loses. */
export type CuePriority = 'safety' | 'form' | 'encouragement';

export interface RuleDef {
  id: string;
  priority: CuePriority;
  /** Condition that describes the problem. */
  when: Condition;
  /** How long the condition must hold before the rule fires, in milliseconds. */
  sustainMs: number;
  /** Minimum time between two firings of this rule, in milliseconds. */
  cooldownMs: number;
  /** Key into the cue dictionary shipped with the exercise library. */
  cueKey: string;
  /** Phases the rule is evaluated in. Omitted means every phase. */
  phases?: string[];
  /** Metric slot whose rounded value is passed to the cue as the `value` parameter. */
  valueFrom?: string;
}

export interface CueCandidate {
  ruleId: string;
  cueKey: string;
  priority: CuePriority;
  timestampMs: number;
  /** Values interpolated into the cue text by the UI layer. */
  params?: Record<string, number>;
}

interface RuleState {
  activeSince: number | null;
  lastFiredAt: number | null;
}

export class RuleEngine {
  private readonly states = new Map<string, RuleState>();

  constructor(
    private readonly rules: readonly RuleDef[],
    private readonly primaryMetric: string,
  ) {
    for (const rule of rules) {
      this.states.set(rule.id, { activeSince: null, lastFiredAt: null });
    }
  }

  reset(): void {
    for (const state of this.states.values()) {
      state.activeSince = null;
      state.lastFiredAt = null;
    }
  }

  /**
   * Evaluate every rule against one frame.
   *
   * @param phaseId Current phase of the repetition machine, or `null` in hold mode.
   * @returns Cue candidates whose sustain time and cooldown have both elapsed.
   */
  update(frame: MetricFrame, phaseId: string | null): CueCandidate[] {
    const candidates: CueCandidate[] = [];
    for (const rule of this.rules) {
      const state = this.states.get(rule.id);
      if (!state) continue;

      const phaseMatches =
        !rule.phases ||
        rule.phases.length === 0 ||
        (phaseId !== null && rule.phases.includes(phaseId));
      const holds = phaseMatches && evaluateCondition(rule.when, frame, this.primaryMetric);

      if (!holds) {
        state.activeSince = null;
        continue;
      }

      state.activeSince ??= frame.timestampMs;
      if (frame.timestampMs - state.activeSince < rule.sustainMs) continue;
      if (state.lastFiredAt !== null && frame.timestampMs - state.lastFiredAt < rule.cooldownMs) {
        continue;
      }

      state.lastFiredAt = frame.timestampMs;
      state.activeSince = frame.timestampMs;
      const candidate: CueCandidate = {
        ruleId: rule.id,
        cueKey: rule.cueKey,
        priority: rule.priority,
        timestampMs: frame.timestampMs,
      };
      if (rule.valueFrom) {
        const sample = frame.samples[rule.valueFrom];
        if (sample && Number.isFinite(sample.value)) {
          candidate.params = { value: Math.round(sample.value) };
        }
      }
      candidates.push(candidate);
    }
    return candidates;
  }
}
