/** Home: who is training, what they are doing today, and a big Start. */

import type { JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_ROUTINE_IDS, getExercise } from '@kinetrace/exercises';
import { db } from '../db/schema.js';
import { saveRoutine, streakFromDates } from '../db/repositories.js';
import { estimateMinutes } from '../session/plan.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { EmptyState } from '../components/EmptyState.js';
import { ProfileChip } from '../components/ProfileChip.js';

export function HomeScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const activeProfileId = useSettingsStore((state) => state.activeProfileId);

  const profiles = useLiveQuery(() => db.profiles.toArray(), [], []);
  const profile = profiles.find((entry) => entry.id === activeProfileId) ?? profiles[0];
  const routines = useLiveQuery(
    () => (profile ? db.routines.where('profileId').equals(profile.id).toArray() : []),
    [profile?.id],
    [],
  );
  const sessions = useLiveQuery(
    () => (profile ? db.sessions.where('profileId').equals(profile.id).toArray() : []),
    [profile?.id],
    [],
  );

  if (profiles.length === 0) {
    return (
      <EmptyState
        title={t('profiles.empty')}
        description={t('app.tagline')}
        action={
          <Link to="/profiles" className="btn-primary">
            {t('profiles.add')}
          </Link>
        }
      />
    );
  }

  const completed = sessions.filter((session) => session.endedAt !== undefined);
  const streak = streakFromDates(completed.map((session) => session.startedAt));
  const last = completed.sort((a, b) => b.startedAt - a.startedAt)[0];

  /** Seed the maker's own back routine, so a new profile has something to do. */
  const createStarterRoutine = async (): Promise<void> => {
    if (!profile) return;
    const exercises = DEFAULT_ROUTINE_IDS.flatMap((id) => {
      const exercise = getExercise(id);
      if (!exercise) return [];
      return [
        {
          exerciseId: id,
          sets: exercise.defaults.sets,
          reps: exercise.defaults.reps,
          holdSeconds: exercise.defaults.holdSeconds,
          restSeconds: exercise.defaults.restSeconds,
        },
      ];
    });
    const id = await saveRoutine({ profileId: profile.id, name: t('home.today'), exercises });
    navigate(`/routines/${id}`);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-muted">{t('app.name')}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{profile?.name}</h1>
        </div>
        <Link to="/profiles" aria-label={t('home.switchProfile')}>
          {profile ? <ProfileChip profile={profile} /> : null}
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-sm text-muted">{t('home.streak')}</p>
          <p className="text-3xl font-semibold">{streak}</p>
          <p className="text-sm text-muted">{t('home.streakDays', { count: streak })}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">{t('home.lastSession')}</p>
          <p className="text-lg font-medium">
            {last
              ? new Date(last.startedAt).toLocaleDateString(language, {
                  day: 'numeric',
                  month: 'short',
                })
              : t('home.never')}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">{t('home.routines')}</h2>
        {routines.length === 0 ? (
          <EmptyState
            title={t('home.noRoutine')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => void createStarterRoutine()}>
                  {t('home.createRoutine')}
                </button>
                <Link to="/import" className="btn-secondary">
                  {t('home.importSheet')}
                </Link>
              </div>
            }
          />
        ) : (
          <ul className="space-y-3">
            {routines.map((routine) => (
              <li key={routine.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium">{routine.name}</p>
                    <p className="text-sm text-muted">
                      {routine.exercises.length} ·{' '}
                      {t('routine.estimated', { minutes: estimateMinutes(routine) })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/routines/${routine.id}`} className="btn-secondary px-4 py-2">
                      {t('common.edit')}
                    </Link>
                    <Link to={`/session/${routine.id}`} className="btn-primary px-6 py-2">
                      {t('common.start')}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <Link to="/routines/new" className="btn-secondary">
          {t('routine.new')}
        </Link>
        <Link to="/import" className="btn-secondary">
          {t('home.importSheet')}
        </Link>
      </section>

      <p className="pt-2 text-sm text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}
