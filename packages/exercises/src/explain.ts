/**
 * Saying out loud what a rule watches for.
 *
 * A professional signing off on an exercise needs to know what the app will
 * say to their patient and when. The conditions are plain data, so they can be
 * read back as a sentence rather than left as a shape nobody outside the
 * repository can interpret.
 *
 * Both languages come back together, the way every other piece of text in the
 * library does.
 */

import type { Condition, MetricSignal } from '@kinetrace/engine';
import { metricLabel } from './dictionary.js';
import type { ExerciseDefinition, Localized } from './types.js';

const SIGNAL_PHRASE: Record<MetricSignal, (metric: string, language: 'es' | 'en') => string> = {
  value: (metric) => metric,
  absValue: (metric, language) =>
    language === 'es' ? `la magnitud de ${metric}` : `the size of ${metric}`,
  velocity: (metric, language) =>
    language === 'es' ? `la velocidad de ${metric}` : `the speed of ${metric}`,
  absVelocity: (metric, language) =>
    language === 'es' ? `la velocidad de ${metric}` : `the speed of ${metric}`,
  stability: (metric, language) =>
    language === 'es' ? `el temblor de ${metric}` : `the wobble in ${metric}`,
  confidence: (metric, language) =>
    language === 'es' ? `la confianza en ${metric}` : `the confidence in ${metric}`,
};

/** Degrees for an angle, degrees per second for a rate, nothing for a fraction. */
function unitOf(signal: MetricSignal): string {
  if (signal === 'velocity' || signal === 'absVelocity') return '°/s';
  return signal === 'confidence' ? '' : '°';
}

function joinPhrases(parts: string[], word: string): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} ${word} ${parts[parts.length - 1]}`;
}

function describeIn(
  condition: Condition,
  exercise: ExerciseDefinition,
  language: 'es' | 'en',
): string {
  if ('always' in condition) return language === 'es' ? 'siempre' : 'always';
  if ('not' in condition) {
    const inner = describeIn(condition.not, exercise, language);
    return language === 'es' ? `no ${inner}` : `not ${inner}`;
  }
  if ('all' in condition) {
    const parts = condition.all.map((inner) => describeIn(inner, exercise, language));
    return joinPhrases(parts, language === 'es' ? 'y' : 'and');
  }
  if ('any' in condition) {
    const parts = condition.any.map((inner) => describeIn(inner, exercise, language));
    return joinPhrases(parts, language === 'es' ? 'o' : 'or');
  }

  const slot = condition.metric ?? exercise.primaryMetric;
  const metric = exercise.metrics[slot];
  const name = metric ? metricLabel(metric.id, language).toLowerCase() : slot;
  const signal = condition.signal ?? 'value';
  const subject = SIGNAL_PHRASE[signal](name, language);
  const unit = unitOf(signal);
  const format = (value: number): string => `${value}${unit ? ` ${unit}` : ''}`;

  const { above, below } = condition;
  if (above !== undefined && below !== undefined) {
    return language === 'es'
      ? `${subject} entre ${format(above)} y ${format(below)}`
      : `${subject} between ${format(above)} and ${format(below)}`;
  }
  if (above !== undefined) {
    return language === 'es'
      ? `${subject} por encima de ${format(above)}`
      : `${subject} above ${format(above)}`;
  }
  if (below !== undefined) {
    return language === 'es'
      ? `${subject} por debajo de ${format(below)}`
      : `${subject} below ${format(below)}`;
  }
  return language === 'es' ? `${subject} sin límite` : `${subject} with no bound`;
}

/** One condition, as a sentence, in both languages. */
export function describeCondition(condition: Condition, exercise: ExerciseDefinition): Localized {
  return {
    es: describeIn(condition, exercise, 'es'),
    en: describeIn(condition, exercise, 'en'),
  };
}
