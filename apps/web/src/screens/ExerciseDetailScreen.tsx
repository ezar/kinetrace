/** One exercise: the demo, where to put the camera, and what is measured. */

import type { JSX } from 'react';
import { useParams } from 'react-router-dom';
import { getExercise, metricDescription, metricLabel } from '@kinetrace/exercises';
import { metricLandmarkIndices } from '@kinetrace/engine';
import { ExerciseDemo } from '../components/ExerciseDemo.js';
import { AngleGauge } from '../components/AngleGauge.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { useTranslation } from '../i18n/useTranslation.js';

export function ExerciseDetailScreen(): JSX.Element {
  const { exerciseId } = useParams();
  const { t, language } = useTranslation();
  const exercise = exerciseId ? getExercise(exerciseId) : undefined;

  if (!exercise) return <p className="text-muted">{t('library.empty')}</p>;

  const metric = exercise.metrics[exercise.primaryMetric];
  const { band, safety } = exercise.targets;
  const gaugeMin = safety?.min ?? band.min - 30;
  const gaugeMax = safety?.max ?? band.max + 30;

  return (
    <div className="space-y-5">
      <ScreenHeader
        title={exercise.names[language]}
        subtitle={`${t(`area.${exercise.area}`)} · ${t(`position.${exercise.position}`)}`}
        back
      />

      <div className="card p-4">
        <ExerciseDemo
          reference={exercise.reference}
          view={exercise.view.orientation}
          highlight={metricLandmarkIndices(metric?.id ?? 'hipFlexion', metric?.side ?? 'auto')}
          className="mx-auto h-40 w-full rounded-2xl bg-canvas text-ink"
        />
      </div>

      {/* The same steps the session shows before this exercise: written once,
          in the library, where the rest of its text already lives. */}
      <section className="card p-4">
        <h2 className="font-medium">{t('library.howTo')}</h2>
        <ol className="mt-2 flex flex-col gap-2">
          {exercise.howTo[language].map((instruction, index) => (
            <li key={instruction} className="flex gap-3 leading-relaxed">
              <span className="w-5 shrink-0 text-right tabular-nums text-muted">{index + 1}</span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-4">
        <h2 className="font-medium">{t('library.camera')}</h2>
        <p className="mt-1 text-muted">{t(exercise.cameraTipKey)}</p>
        <p className="mt-2 text-sm text-muted">
          {t(`view.${exercise.view.orientation}`)} · {exercise.view.distanceMetres} m
        </p>
      </section>

      <section className="card p-4">
        <h2 className="font-medium">{t('library.tracked')}</h2>
        <p className="mt-1 text-muted">{metricLabel(metric?.id ?? 'hipFlexion', language)}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {metricDescription(metric?.id ?? 'hipFlexion', language)}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <AngleGauge
            value={(band.min + band.max) / 2}
            band={band}
            min={gaugeMin}
            max={gaugeMax}
            {...(safety ? { safety } : {})}
            className="h-24 w-24 shrink-0"
          />
          <div>
            <p className="text-sm text-muted">{t('library.targetRange')}</p>
            <p className="text-xl font-semibold">
              {band.min}–{band.max}°
            </p>
            <p className="mt-1 text-sm text-muted">{t('library.defaultRangesNotice')}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {t(`library.tracking.${exercise.trackingConfidence}`)}
        </p>
      </section>

      <section className="card p-4">
        <h2 className="font-medium">{t('routine.settings')}</h2>
        <p className="mt-1 text-muted">
          {exercise.defaults.sets} {t('common.sets')} ·{' '}
          {exercise.mode === 'hold'
            ? `${exercise.defaults.holdSeconds} ${t('common.seconds')}`
            : `${exercise.defaults.reps} ${t('common.reps')}`}{' '}
          · {exercise.defaults.restSeconds} s {t('common.rest')}
        </p>
      </section>
    </div>
  );
}
