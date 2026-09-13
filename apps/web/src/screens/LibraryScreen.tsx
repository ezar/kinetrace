/** The exercise library: browse by area and position, see what is measured. */

import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EXERCISES,
  type ExerciseArea,
  type ExercisePosition,
  type SpinalLoad,
} from '@kinetrace/exercises';
import { metricLandmarkIndices } from '@kinetrace/engine';
import { ExerciseDemo } from '../components/ExerciseDemo.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { useTranslation } from '../i18n/useTranslation.js';

const AREAS: ExerciseArea[] = ['lowerBack', 'core', 'hips', 'thoracic', 'neckShoulders'];
const POSITIONS: ExercisePosition[] = [
  'standing',
  'kneeling',
  'supine',
  'prone',
  'quadruped',
  'sideLying',
];
const LOADS: SpinalLoad[] = ['neutral', 'flexion', 'extension', 'rotation', 'mixed'];

export function LibraryScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const [area, setArea] = useState<ExerciseArea | 'all'>('all');
  const [position, setPosition] = useState<ExercisePosition | 'all'>('all');
  const [load, setLoad] = useState<SpinalLoad | 'all'>('all');

  const filtered = useMemo(
    () =>
      EXERCISES.filter(
        (exercise) =>
          (area === 'all' || exercise.area === area) &&
          (position === 'all' || exercise.position === position) &&
          (load === 'all' || exercise.spinalLoad === load),
      ),
    [area, position, load],
  );

  return (
    <div>
      <ScreenHeader title={t('library.title')} subtitle={t('library.defaultRangesNotice')} />

      <div className="mb-5 space-y-2.5">
        <Filter
          label={t('library.filterArea')}
          options={AREAS.map((value) => ({ value, label: t(`area.${value}`) }))}
          value={area}
          onChange={(value) => setArea(value as ExerciseArea | 'all')}
          allLabel={t('library.all')}
        />
        <Filter
          label={t('library.filterPosition')}
          options={POSITIONS.map((value) => ({ value, label: t(`position.${value}`) }))}
          value={position}
          onChange={(value) => setPosition(value as ExercisePosition | 'all')}
          allLabel={t('library.all')}
        />
        <Filter
          label={t('library.filterLoad')}
          options={LOADS.map((value) => ({ value, label: t(`spinalLoad.${value}`) }))}
          value={load}
          onChange={(value) => setLoad(value as SpinalLoad | 'all')}
          allLabel={t('library.all')}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">{t('library.empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {filtered.map((exercise) => (
            <li key={exercise.id} className="card overflow-hidden">
              <Link to={`/library/${exercise.id}`} className="block p-3">
                <ExerciseDemo
                  reference={exercise.reference}
                  view={exercise.view.orientation}
                  highlight={metricLandmarkIndices(
                    exercise.metrics[exercise.primaryMetric]?.id ?? 'hipFlexion',
                    exercise.metrics[exercise.primaryMetric]?.side ?? 'auto',
                  )}
                  className="mx-auto h-24 w-full rounded-xl bg-canvas text-ink"
                />
                <p className="mt-2.5 text-[15px] font-semibold leading-tight">
                  {exercise.names[language]}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t(`area.${exercise.area}`)} · {t(`view.${exercise.view.orientation}`)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface FilterProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
}

function Filter({ label, options, value, onChange, allLabel }: FilterProps): JSX.Element {
  return (
    <div className="flex items-start gap-2">
      <span className="w-14 shrink-0 pt-1.5 text-xs text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {[{ value: 'all', label: allLabel }, ...options].map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`chip min-h-9 ${
              value === option.value ? 'border-ink bg-ink font-semibold text-canvas' : ''
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
