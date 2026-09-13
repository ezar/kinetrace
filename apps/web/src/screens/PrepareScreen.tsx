/**
 * How the exercise is done, before doing it.
 *
 * Between the routine and the mat there is a question neither of them answers:
 * what *is* a bird dog? The library screen answers it, but nobody browses the
 * library on the way to the mat. So the exercises that are still unfamiliar get
 * shown here — the steps the library carries, and the same animated figure,
 * built from the exercise's own reference motion.
 *
 * It is a step, not a wall. `primerFor` decides who sees it; it stops on its
 * own once an exercise has been done and once the first sessions are behind
 * somebody; and "I know this one" stops it for good, undoably, from settings.
 *
 * The list of exercises to show is taken once, when the data first arrives, and
 * then left alone. Dismissing one rewrites what `primerFor` would answer, and
 * walking a list that reshuffles underneath you skips the next card.
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExerciseDemo } from '../components/ExerciseDemo.js';
import { db } from '../db/schema.js';
import { dismissDemo, exerciseExperience } from '../db/repositories.js';
import { buildPlan } from '../session/plan.js';
import { primerFor } from '../session/primer.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';

export function PrepareScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();
  const routineId = Number(params['routineId']);
  const guided = search.get('mode') === 'guided';
  const showDemo = useSettingsStore((state) => state.showDemo);
  // Settings arrive from the database a frame later, and until they do every
  // one of them reads as its default. Deciding anything on that would show the
  // wrong thing, or nothing, to somebody who asked for the opposite.
  const settingsLoaded = useSettingsStore((state) => state.loaded);

  const routine = useLiveQuery(() => db.routines.get(routineId), [routineId]);
  /**
   * Whose history this is, taken from the routine rather than from the active
   * profile in settings.
   *
   * The store's copy can lag the database — a profile created a moment ago is
   * written straight through, and the store only catches up on the next load —
   * and reading it here skipped the demonstration for exactly the person who
   * had never seen anything. A routine knows whose it is, always.
   */
  const profileId = routine?.profileId;
  const experience = useLiveQuery(
    () => (profileId === undefined ? undefined : exerciseExperience(profileId)),
    [profileId],
  );
  const plan = useMemo(() => (routine ? buildPlan(routine) : []), [routine]);

  const [ids, setIds] = useState<string[] | undefined>();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (ids !== undefined || !settingsLoaded || !routine || !experience) return;
    setIds(primerFor(plan, experience, showDemo));
  }, [ids, settingsLoaded, routine, experience, plan, showDemo]);

  // The session this is on the way to. Everything here either shows it first or
  // gets out of the way.
  const resume = search.get('resume');
  const session = `${guided ? '/guided' : '/session'}/${routineId}${resume ? `?resume=${resume}` : ''}`;

  if (!routine || ids === undefined) return <div className="min-h-full bg-canvas" />;
  if (ids.length === 0) return <Navigate to={session} replace />;

  const exerciseId = ids[Math.min(step, ids.length - 1)];
  const item = plan.find((candidate) => candidate.exerciseId === exerciseId);
  const exercise = item?.exercise;
  if (!exercise || exerciseId === undefined) return <Navigate to={session} replace />;

  const last = step >= ids.length - 1;
  const advance = (): void => {
    if (last) navigate(session, { replace: true });
    else setStep(step + 1);
  };
  const known = (): void => {
    if (profileId !== undefined) void dismissDemo(profileId, exerciseId);
    advance();
  };

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-5 px-5 pb-6 pt-5">
      <header className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{t('prepare.title')}</span>
        {ids.length > 1 ? (
          <span className="text-sm text-muted">
            {step + 1} / {ids.length}
          </span>
        ) : null}
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-balance">
            {exercise.names[language]}
          </h1>
          <p className="text-muted">
            {t(`area.${exercise.area}`)} · {t(`position.${exercise.position}`)}
          </p>
        </div>

        <ExerciseDemo
          reference={exercise.reference}
          view={exercise.view.orientation}
          className="mx-auto h-44 w-full rounded-2xl bg-surface text-ink"
        />

        {/* The steps, which are the half of this that can be read at your own
            pace. The figure shows the shape; these say what to do with it. */}
        <ol className="flex flex-col gap-2">
          {exercise.howTo[language].map((instruction, index) => (
            <li key={instruction} className="flex gap-3 leading-relaxed">
              <span className="w-5 shrink-0 text-right tabular-nums text-muted">{index + 1}</span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>

        {/* `totalSets` counts within a side, so for an exercise done one leg at
            a time this card promised half the work: two sets, then four done.
            The plan already knows — it holds one item per set per side. */}
        <p className="text-muted">
          {exercise.mode === 'hold'
            ? t('prepare.dosageHold', { sets: item.totalSets, seconds: item.holdSeconds ?? 0 })
            : t('prepare.dosageReps', { sets: item.totalSets, reps: item.reps ?? 0 })}
          {plan.filter((candidate) => candidate.exerciseId === exerciseId).length > item.totalSets
            ? ` · ${t('prepare.eachSide')}`
            : null}
        </p>

        {/* Where to put the phone only matters when the phone is going to look. */}
        {guided ? null : <p className="text-sm text-muted">{t(exercise.cameraTipKey)}</p>}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <button className="btn-primary h-14 w-full text-[17px] font-semibold" onClick={advance}>
          {last ? t('prepare.start') : t('common.continue')}
        </button>
        <button className="btn-ghost self-center px-4 py-2 text-sm" onClick={known}>
          {t('prepare.known')}
        </button>
      </div>
    </div>
  );
}
