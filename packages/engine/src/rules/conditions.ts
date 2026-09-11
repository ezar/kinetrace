/**
 * Conditions over metric signals.
 *
 * Conditions are plain data so that exercises can express rep phases and form
 * rules without any code. They are evaluated once per frame against the metric
 * frame produced by the evaluator.
 */

import type { MetricFrame, MetricSample } from '../types.js';

/** Signal derived from a metric sample that a condition can test. */
export type MetricSignal =
  'value' | 'absValue' | 'velocity' | 'absVelocity' | 'stability' | 'confidence';

/** Test on a single metric signal. At least one bound must be given. */
export interface MetricCondition {
  /** Metric slot name declared by the exercise. Defaults to the primary metric. */
  metric?: string;
  /** Signal to read from the sample. Defaults to `value`. */
  signal?: MetricSignal;
  /** Condition holds while the signal is strictly above this bound. */
  above?: number;
  /** Condition holds while the signal is strictly below this bound. */
  below?: number;
}

export type Condition =
  | MetricCondition
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  /** Always true. Useful for transitional phases that only need a dwell time. */
  | { always: true };

function readSignal(sample: MetricSample, signal: MetricSignal): number {
  switch (signal) {
    case 'value':
      return sample.value;
    case 'absValue':
      return Math.abs(sample.value);
    case 'velocity':
      return sample.velocity;
    case 'absVelocity':
      return Math.abs(sample.velocity);
    case 'stability':
      return sample.stability;
    case 'confidence':
      return sample.confidence;
  }
}

/**
 * Evaluate a condition against one metric frame.
 *
 * @param primaryMetric Slot name used when a condition omits `metric`.
 * @returns `false` when a referenced metric is missing or not finite.
 */
export function evaluateCondition(
  condition: Condition,
  frame: MetricFrame,
  primaryMetric: string,
): boolean {
  if ('always' in condition) return true;
  if ('all' in condition) {
    return condition.all.every((child) => evaluateCondition(child, frame, primaryMetric));
  }
  if ('any' in condition) {
    return condition.any.some((child) => evaluateCondition(child, frame, primaryMetric));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, frame, primaryMetric);
  }

  const sample = frame.samples[condition.metric ?? primaryMetric];
  if (!sample || !Number.isFinite(sample.value)) return false;
  const signal = readSignal(sample, condition.signal ?? 'value');
  if (!Number.isFinite(signal)) return false;
  if (condition.above !== undefined && !(signal > condition.above)) return false;
  if (condition.below !== undefined && !(signal < condition.below)) return false;
  return condition.above !== undefined || condition.below !== undefined;
}

/** Collect every metric slot name a condition references. */
export function conditionMetrics(condition: Condition, primaryMetric: string): string[] {
  if ('always' in condition) return [];
  if ('all' in condition) {
    return condition.all.flatMap((child) => conditionMetrics(child, primaryMetric));
  }
  if ('any' in condition) {
    return condition.any.flatMap((child) => conditionMetrics(child, primaryMetric));
  }
  if ('not' in condition) return conditionMetrics(condition.not, primaryMetric);
  return [condition.metric ?? primaryMetric];
}
