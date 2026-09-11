/**
 * The guided session, in far mode.
 *
 * The phone is on the floor two or three metres away: enormous numbers, one
 * line of cue text, a stick figure that reads across the room, and no small
 * controls. Everything can be driven from the mat with gestures.
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SetupAssistant, metricLandmarkIndices, type SetupState } from '@kinetrace/engine';
import { metricLabel } from '@kinetrace/exercises';
import { db } from '../db/schema.js';
import { finishSession } from '../db/repositories.js';
import { useSessionRunner } from '../session/useSessionRunner.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { StickFigure } from '../components/StickFigure.js';
import { AngleGauge } from '../components/AngleGauge.js';
import { RepCounter } from '../components/RepCounter.js';
import { CueBanner, type CueTone } from '../components/CueBanner.js';
import { SilhouetteGuide } from '../components/SilhouetteGuide.js';
import type { Routine } from '../db/schema.js';
import type { SetupCheck } from '@kinetrace/engine';

/**
 * Shown while the pose model has not seen anybody yet. Without this the setup
 * screen would be blank exactly when the user most needs to know what to fix.
 */
const NO_BODY_CHECKS: SetupCheck[] = [
  { id: 'bodyVisible', status: 'failed', tipKey: 'setup.tip.wholeBody' },
  { id: 'framing', status: 'pending', tipKey: null },
  { id: 'view', status: 'pending', tipKey: null },
  { id: 'detection', status: 'pending', tipKey: null },
];

export function SessionScreen(): JSX.Element {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const settings = useSettingsStore();
  const [routine, setRoutine] = useState<Routine | undefined>();
  const [showPreview, setShowPreview] = useState(settings.showCameraPreview);

  useEffect(() => {
    if (!routineId) return;
    void db.routines.get(Number(routineId)).then(setRoutine);
  }, [routineId]);

  const session = useSessionRunner(routine, settings.activeProfileId);
  const exercise = session.item?.exercise;

  // The camera setup assistant runs until every check has been stable for two seconds.
  const assistantRef = useRef<SetupAssistant | null>(null);
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const requiredLandmarks = useMemo(() => {
    if (!exercise) return [];
    return Object.values(exercise.metrics).flatMap((metric) =>
      metricLandmarkIndices(metric.id, metric.side),
    );
  }, [exercise]);

  useEffect(() => {
    if (!exercise) return;
    assistantRef.current = new SetupAssistant({
      requiredView: exercise.view.orientation,
      requiredLandmarks,
    });
    setSetupState(null);
  }, [exercise, requiredLandmarks]);

  const inSetup = session.stage === 'setup' || session.stage === 'loading';
  useEffect(() => {
    if (!inSetup || !session.frame || !assistantRef.current) return;
    const state = assistantRef.current.update(session.frame);
    setSetupState(state);
    // The assistant blocks the session until the landmarks it needs have been
    // stable, then starts it: nobody is near the phone to press anything.
    if (state.ready && session.stage === 'setup') session.begin();
  }, [inSetup, session]);

  const primaryMetric = exercise ? exercise.metrics[exercise.primaryMetric] : undefined;
  const highlight = primaryMetric
    ? metricLandmarkIndices(primaryMetric.id, primaryMetric.side)
    : [];

  const cueTone: CueTone = session.state?.unsafe
    ? 'safety'
    : session.state?.tracking === 'lost'
      ? 'safety'
      : 'correction';

  const endSession = async (): Promise<void> => {
    const id = await session.finish();
    if (id !== undefined) {
      await finishSession(id, {});
      navigate(`/summary/${id}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  if (!routine) return <div className="p-8 text-muted">{t('common.loading')}</div>;

  return (
    <div className="far-mode relative flex min-h-full flex-col">
      {/* The preview is optional: tracking works with it off, and off is private and cheap. */}
      <video
        ref={session.videoRef}
        className={`absolute inset-0 h-full w-full object-cover ${
          showPreview ? 'opacity-25' : 'opacity-0'
        }`}
        playsInline
        muted
      />

      <div className="relative flex min-h-full flex-col p-5">
        <header className="flex items-start justify-between gap-3 text-canvas/relaxed opacity-80">
          <div>
            <p className="text-lg">{exercise?.names[language] ?? session.item?.customNote}</p>
            <p className="text-sm">
              {t('session.set', {
                current: session.item?.setNumber ?? 1,
                total: session.item?.totalSets ?? 1,
              })}
            </p>
          </div>
          <button className="btn-ghost text-canvas" onClick={() => void endSession()}>
            {t('session.end')}
          </button>
        </header>

        {inSetup ? (
          <SetupPanel
            state={setupState}
            cameraStatus={session.cameraStatus}
            cameraError={session.cameraError}
            modelLoading={session.modelLoading}
            checks={setupState?.checks ?? NO_BODY_CHECKS}
            reference={exercise?.reference}
            onStart={() => void session.start()}
          />
        ) : session.stage === 'rest' ? (
          <RestPanel
            seconds={session.restRemainingSeconds}
            nextName={exercise?.names[language] ?? ''}
            tip={exercise ? t(exercise.cameraTipKey) : ''}
            onSkip={session.skipSet}
          />
        ) : session.stage === 'finished' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <p className="text-far-sm">{t('common.done')}</p>
            <button className="btn-primary bg-canvas text-ink" onClick={() => void endSession()}>
              {t('common.finish')}
            </button>
          </div>
        ) : (
          <ActivePanel
            session={session}
            highlight={highlight}
            metricName={primaryMetric ? metricLabel(primaryMetric.id, language) : ''}
          />
        )}

        <footer className="mt-4 flex items-center justify-between gap-3">
          <button
            className="btn-ghost text-canvas"
            onClick={() => setShowPreview((current) => !current)}
          >
            {showPreview ? t('session.previewOff') : t('session.togglePreview')}
          </button>
          <p className="text-sm opacity-60">{t('session.gestureHelp')}</p>
          <button className="btn-ghost text-canvas" onClick={session.togglePause}>
            {session.stage === 'paused' ? t('session.resume') : t('session.paused')}
          </button>
        </footer>

        <div className="mt-3 h-1.5 w-full rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${Math.round(session.progress * 100)}%` }}
          />
        </div>
      </div>

      {session.stage === 'paused' ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-ink/90">
          <p className="text-far-sm">{t('session.paused')}</p>
          <button className="btn-primary bg-canvas text-ink" onClick={session.togglePause}>
            {t('session.resume')}
          </button>
          <button className="btn-ghost text-canvas" onClick={() => void endSession()}>
            {t('session.end')}
          </button>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
        <CueBanner text={session.cueText} tone={cueTone} />
      </div>
    </div>
  );
}

interface ActivePanelProps {
  session: ReturnType<typeof useSessionRunner>;
  highlight: readonly number[];
  metricName: string;
}

function ActivePanel({ session, highlight, metricName }: ActivePanelProps): JSX.Element {
  const { t } = useTranslation();
  const exercise = session.item?.exercise;
  const state = session.state;
  const lost = state?.tracking === 'lost';
  const band = session.item?.band ?? exercise?.targets.band ?? { min: 0, max: 180 };
  const safety = exercise?.targets.safety;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      {lost ? <p className="text-far-cue text-safety">{t('session.lost')}</p> : null}

      <div className="flex w-full items-center justify-center gap-8">
        {session.frame ? (
          <StickFigure
            landmarks={session.frame.world.length ? session.frame.world : session.frame.image}
            space={session.frame.world.length ? 'world' : 'image'}
            highlight={highlight}
            stroke="#f7f5f2"
            highlightStroke="#d9702f"
            strokeWidth={3}
            className="h-56 w-40 shrink-0"
          />
        ) : (
          <div className="h-56 w-40" />
        )}

        {exercise?.mode === 'hold' ? (
          <RepCounter
            value={Math.floor((state?.heldMs ?? 0) / 1000)}
            total={session.item?.holdSeconds}
            caption={t('session.holdFor', { seconds: session.item?.holdSeconds ?? 0 })}
          />
        ) : (
          <RepCounter
            value={state?.reps ?? 0}
            total={session.item?.reps}
            caption={
              state && state.partials > 0
                ? `${state.partials} ${t('summary.partials').toLowerCase()}`
                : undefined
            }
          />
        )}
      </div>

      <div className="flex items-center gap-5">
        <AngleGauge
          value={state?.primaryValue ?? Number.NaN}
          band={band}
          min={safety?.min ?? band.min - 30}
          max={safety?.max ?? band.max + 30}
          safety={safety}
          far
          label={metricName}
          className="h-32 w-32"
        />
        <div>
          <p className="text-far-sm font-semibold">
            {Number.isFinite(state?.primaryValue) ? Math.round(state?.primaryValue ?? 0) : '—'}°
          </p>
          <p className="text-lg opacity-70">
            {metricName} · {band.min}–{band.max}°
          </p>
        </div>
      </div>
    </div>
  );
}

interface SetupPanelProps {
  state: SetupState | null;
  checks: readonly SetupCheck[];
  cameraStatus: string;
  cameraError?: string;
  modelLoading: boolean;
  reference?: Parameters<typeof SilhouetteGuide>[0]['reference'];
  onStart: () => void;
}

function SetupPanel({
  state,
  checks,
  cameraStatus,
  cameraError,
  modelLoading,
  reference,
  onStart,
}: SetupPanelProps): JSX.Element {
  const { t } = useTranslation();

  if (cameraStatus === 'idle') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <p className="text-far-sm">{t('setup.title')}</p>
        <button className="btn-primary bg-canvas text-ink" onClick={onStart}>
          {t('common.start')}
        </button>
        <p className="max-w-md opacity-70">{t('setup.cameraHelp')}</p>
      </div>
    );
  }

  if (cameraStatus === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-far-cue text-safety">{t('setup.cameraError')}</p>
        <p className="opacity-70">{cameraError}</p>
        <button className="btn-secondary" onClick={onStart}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-5">
      {reference ? (
        <SilhouetteGuide reference={reference} className="absolute inset-0 h-full w-full" />
      ) : null}
      <p className="text-far-cue">{modelLoading ? t('setup.modelLoading') : t('setup.title')}</p>

      <ul className="z-10 space-y-2 text-xl">
        {checks.map((check) => (
          <li key={check.id} className="flex items-center gap-3">
            <span aria-hidden="true">{check.status === 'ok' ? '✓' : '·'}</span>
            <span className={check.status === 'ok' ? 'opacity-60' : ''}>
              {t(`setup.check.${check.id}`)}
            </span>
            {check.tipKey ? <span className="text-accent">{t(check.tipKey)}</span> : null}
          </li>
        ))}
      </ul>

      {state?.ready ? (
        <p className="z-10 text-far-cue text-accent">{t('setup.ready')}</p>
      ) : (
        <p className="z-10 opacity-70">{t('setup.holdStill')}</p>
      )}
    </div>
  );
}

interface RestPanelProps {
  seconds: number;
  nextName: string;
  tip: string;
  onSkip: () => void;
}

function RestPanel({ seconds, nextName, tip, onSkip }: RestPanelProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <p className="text-xl opacity-70">{t('session.rest')}</p>
      <p className="text-far font-semibold">{seconds}</p>
      <p className="text-far-cue">{t('session.restNext', { name: nextName })}</p>
      <p className="max-w-lg text-lg opacity-70">{tip}</p>
      <button className="btn-primary bg-canvas text-ink" onClick={onSkip}>
        {t('common.skip')}
      </button>
    </div>
  );
}
