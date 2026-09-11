/** Home: who is training, what they are doing today, and one big Start. */

import type { JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_ROUTINE_IDS, getExercise } from '@kinetrace/exercises';
import { db, type Routine } from '../db/schema.js';
import { saveRoutine, streakFromDates } from '../db/repositories.js';
import { estimateMinutes } from '../session/plan.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { EmptyState } from '../components/EmptyState.js';
import { ProfileChip } from '../components/ProfileChip.js';
import { ExerciseDemo } from '../components/ExerciseDemo.js';
import { PlayIcon, PlusIcon } from '../components/icons.js';

/** Up to four exercises are shown as thumbnails; the rest become a count. */
const THUMBNAILS = 4;

export function HomeScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const activeProfileId = useSettingsStore((state) => state.activeProfileId);

  const profiles = useLiveQuery(() => db.profiles.toArray(), [], []);
  const profile = profiles.find((entry) => entry.id === activeProfileId) ?? profiles[0];
  const routines = useLiveQuery(
    () =>
      profile
        ? db.routines.where('profileId').equals(profile.id).reverse().sortBy('updatedAt')
        : [],
    [profile?.id],
    [],
  );
  const sessions = useLiveQuery(
    () => (profile ? db.sessions.where('profileId').equals(profile.id).toArray() : []),
    [profile?.id],
    [],
  );

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
    const id = await saveRoutine({
      profileId: profile.id,
      name: t('home.starterRoutine'),
      exercises,
    });
    navigate(`/routines/${id}`);
  };

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
  const last = [...completed].sort((a, b) => b.startedAt - a.startedAt)[0];
  const [today, ...rest] = routines;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[13px] text-muted">{t('home.greeting')}</span>
          <h1 className="text-[26px] font-bold tracking-tight">{profile?.name}</h1>
        </div>
        <Link to="/profiles" aria-label={t('home.switchProfile')}>
          {profile ? <ProfileChip profile={profile} /> : null}
        </Link>
      </header>

      {today ? (
        <TodayCard routine={today} language={language} />
      ) : (
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
      )}

      <section className="flex gap-2.5">
        <div className="card flex flex-1 items-center gap-3 px-4 py-3.5">
          <div className="flex flex-col">
            <span className="text-[26px] font-bold leading-tight">{streak}</span>
            <span className="text-[13px] text-muted">
              {t('home.streakDays', { count: streak })}
            </span>
          </div>
          {completed.length > 0 ? (
            <StreakBars dates={completed.map((session) => session.startedAt)} />
          ) : null}
        </div>
        <div className="card flex flex-1 flex-col justify-center px-4 py-3.5">
          <span className="text-[17px] font-semibold leading-tight">
            {last
              ? new Date(last.startedAt).toLocaleDateString(language, {
                  day: 'numeric',
                  month: 'short',
                })
              : t('home.never')}
          </span>
          <span className="text-[13px] text-muted">{t('home.lastSession')}</span>
        </div>
      </section>

      {rest.length > 0 ? (
        <section className="flex flex-col">
          {rest.map((routine) => (
            <Link
              key={routine.id}
              to={`/session/${routine.id}`}
              className="flex items-center justify-between border-b border-line py-3.5"
            >
              <span className="text-[16px]">{routine.name}</span>
              <span className="text-[14px] text-muted">
                {t('routine.estimated', { minutes: estimateMinutes(routine) })}
              </span>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted">
        <Link to="/routines/new" className="flex items-center gap-2 py-2 text-[16px]">
          <PlusIcon size={19} />
          {t('routine.new')}
        </Link>
        <Link to="/import" className="py-2 text-[15px] underline underline-offset-4">
          {t('home.importSheet')}
        </Link>
      </section>

      <p className="pt-1 text-xs leading-relaxed text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}

/** The one thing this screen is for. */
function TodayCard({
  routine,
  language,
}: {
  routine: Routine;
  language: 'es' | 'en';
}): JSX.Element {
  const { t } = useTranslation();
  const shown = routine.exercises.slice(0, THUMBNAILS);
  const remaining = routine.exercises.length - shown.length;

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
          {t('home.today')}
        </span>
        <h2 className="text-[22px] font-bold tracking-tight">{routine.name}</h2>
        <span className="text-[14px] text-muted">
          {routine.exercises.length} ·{' '}
          {t('routine.estimated', { minutes: estimateMinutes(routine) })}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        {shown.map((entry, index) => {
          const exercise = getExercise(entry.exerciseId);
          return (
            <div
              key={`${entry.exerciseId}-${index}`}
              className="flex aspect-square flex-1 items-center justify-center rounded-2xl bg-canvas"
              title={exercise?.names[language] ?? entry.customNote}
            >
              {exercise ? (
                <ExerciseDemo
                  reference={exercise.reference}
                  view={exercise.view.orientation}
                  className="h-full w-full text-ink"
                  still
                />
              ) : (
                <span className="text-[13px] text-muted">?</span>
              )}
            </div>
          );
        })}
        {remaining > 0 ? (
          <div className="flex aspect-square flex-1 items-center justify-center rounded-2xl bg-canvas text-[15px] font-semibold text-muted">
            +{remaining}
          </div>
        ) : null}
      </div>

      <Link
        to={`/session/${routine.id}`}
        className="btn-primary mt-5 h-[60px] w-full text-[19px] font-semibold"
      >
        <PlayIcon size={22} />
        {t('common.start')}
      </Link>
      <Link
        to={`/routines/${routine.id}`}
        className="mt-2 block py-2 text-center text-[14px] text-muted underline underline-offset-4"
      >
        {t('common.edit')}
      </Link>
    </section>
  );
}

/** Five weeks of turning up, as a sparkline rather than another number. */
function StreakBars({ dates }: { dates: readonly number[] }): JSX.Element {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const days = new Set(dates.map((date) => new Date(date).toDateString()));
  const weeks = Array.from({ length: 5 }, (_, index) => {
    const weekStart = Date.now() - (4 - index) * 7 * DAY_MS;
    let count = 0;
    for (let day = 0; day < 7; day += 1) {
      if (days.has(new Date(weekStart + day * DAY_MS).toDateString())) count += 1;
    }
    return count;
  });
  const peak = Math.max(1, ...weeks);

  return (
    <div className="ml-auto flex h-6 items-end gap-[3px]" aria-hidden="true">
      {weeks.map((count, index) => (
        <span
          key={index}
          className="w-[7px] rounded-[3px] bg-accent"
          style={{
            height: `${Math.max(12, (count / peak) * 100)}%`,
            opacity: count === 0 ? 0.25 : 1,
          }}
        />
      ))}
    </div>
  );
}
