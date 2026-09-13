/**
 * The session with no camera.
 *
 * Big type, four controls, and a line of text that mirrors whatever the voice
 * just said — because the phone may be across the room, or it may be face down
 * on the sofa, and the session has to work either way.
 *
 * It looks deliberately unlike the measured session: no gauge, no skeleton, no
 * counter that claims to have seen anything. What it shows is the prescription,
 * a clock, and a figure doing the exercise.
 *
 * The figure is not decoration. Counting at somebody tells them how many are
 * left, not what to do, and this is the mode with nothing watching to correct
 * them — so it moves to the same clock the voice counts on, which makes it the
 * only thing on screen that answers "am I doing this right?".
 */

import type { JSX } from 'react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExerciseDemo } from '../components/ExerciseDemo.js';
import { db } from '../db/schema.js';
import { buildPlan } from '../session/plan.js';
import { useGuidedSession } from '../session/useGuidedSession.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';

export function GuidedSessionScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const routineId = Number(params['routineId']);
  const profileId = useSettingsStore((state) => state.activeProfileId);
  const routine = useLiveQuery(() => db.routines.get(routineId), [routineId]);
  const plan = useMemo(() => (routine ? buildPlan(routine) : []), [routine]);

  const session = useGuidedSession(plan, routineId, profileId);
  const { item } = session;
  const exercise = item?.exercise;

  if (!routine) return <div className="p-8 text-muted">{t('common.loading')}</div>;

  if (session.stage === 'finished') {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 px-5 py-10">
        <h1 className="text-[28px] font-bold tracking-tight">{t('guided.finished')}</h1>
        <p className="leading-relaxed text-muted">{t('guided.explain')}</p>
        <button
          className="btn-primary h-14 w-full text-[17px] font-semibold"
          onClick={() =>
            navigate(session.sessionId === undefined ? '/' : `/summary/${session.sessionId}`, {
              replace: true,
            })
          }
        >
          {t('common.continue')}
        </button>
      </div>
    );
  }

  if (session.stage === 'ready') {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 px-5 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">
            {t('guided.title')}
          </h1>
          <p className="text-muted">{routine.name}</p>
        </div>
        <div className="card p-4">
          <p className="leading-relaxed">{t('guided.explain')}</p>
        </div>
        <button
          className="btn-primary h-16 w-full text-[19px] font-semibold"
          onClick={session.begin}
        >
          {t('guided.start')}
        </button>
        <Link to="/" className="btn-ghost self-center px-4 py-2 text-sm">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const resting = session.stage === 'resting';
  // What the number means comes from the hook, so the screen and the voice can
  // never disagree and a pause cannot flip one into the other.
  const counting = session.counting === 'reps';

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-5 px-5 pb-6 pt-5">
      <header className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">
          {session.index + 1} / {session.total}
        </span>
        <span className="text-sm text-muted">
          {resting ? t('guided.resting') : t('guided.working')}
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-balance">
            {exercise ? exercise.names[language] : (item?.customNote ?? '')}
            {item?.side ? (
              <span className="font-normal text-muted"> · {t(`side.${item.side}`)}</span>
            ) : null}
          </h1>
          {item ? (
            <p className="text-muted">
              {exercise?.mode === 'hold'
                ? t('guided.doseHold', {
                    set: item.setNumber,
                    sets: item.totalSets,
                    seconds: item.holdSeconds ?? 0,
                  })
                : t('guided.doseReps', {
                    set: item.setNumber,
                    sets: item.totalSets,
                    reps: item.reps ?? 0,
                  })}
            </p>
          ) : null}
        </div>

        {/* What the exercise looks like, moving to the clock the voice counts
            on. A hold has nowhere to move to, so it shows the position. */}
        {exercise ? (
          <ExerciseDemo
            reference={exercise.reference}
            view={exercise.view.orientation}
            still={exercise.mode === 'hold'}
            {...(session.motion ? { clock: session.motion } : {})}
            className="mx-auto h-40 w-full max-w-xs rounded-2xl bg-surface text-ink"
          />
        ) : null}

        {/* One number, and it is the one that matters for this kind of set:
            which repetition you are on, or how long is left of the hold.
            Neither is a measurement — it is the prescription and a clock. */}
        <div className="flex items-baseline gap-3">
          <div
            className="font-bold leading-none tracking-tight tabular-nums"
            style={{ fontSize: 'clamp(3.5rem, 20vw, 5.5rem)' }}
          >
            {counting ? session.repsDone : session.remaining}
          </div>
          <span className="text-[17px] text-muted">
            {counting ? t('guided.ofReps', { total: item?.reps ?? 0 }) : t('guided.seconds')}
          </span>
        </div>

        <p className="min-h-[2.5rem] text-[20px] font-medium leading-snug" aria-live="polite">
          {session.stage === 'paused' ? t('session.paused') : session.spoken}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          className="btn-primary h-14 w-full text-[17px] font-semibold"
          onClick={session.togglePause}
        >
          {session.stage === 'paused' ? t('session.resume') : t('common.pause')}
        </button>
        <div className="flex gap-2">
          <button className="btn-secondary h-12 flex-1" onClick={session.redo}>
            {t('common.repeat')}
          </button>
          <button className="btn-secondary h-12 flex-1" onClick={session.skip}>
            {t('common.skip')}
          </button>
          <button className="btn-ghost h-12 flex-1" onClick={session.finish}>
            {t('session.end')}
          </button>
        </div>
      </div>
    </div>
  );
}
