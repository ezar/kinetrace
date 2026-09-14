/**
 * The guided session, in far mode.
 *
 * The phone is on the floor two or three metres away: enormous numbers, one
 * line of cue text, a stick figure that reads across the room, and no small
 * controls. Everything can be driven from the mat with gestures.
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  SetupAssistant,
  metricLandmarkIndices,
  type RunnerState,
  type SetupState,
  type TargetBand,
} from '@kinetrace/engine';
import type { VoiceCommand } from '@kinetrace/engine';
import { metricLabel, VOICE_EXAMPLES } from '@kinetrace/exercises';
import { db } from '../db/schema.js';
import { finishSession } from '../db/repositories.js';
import { useSessionRunner } from '../session/useSessionRunner.js';
import { useVoiceCommands } from '../speech/useVoiceCommands.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { StickFigure } from '../components/StickFigure.js';
import { AngleGauge } from '../components/AngleGauge.js';
import { CueBanner, type CueTone } from '../components/CueBanner.js';
import { SilhouetteGuide } from '../components/SilhouetteGuide.js';
import { VoiceIndicator } from '../components/VoiceIndicator.js';
import { CameraIcon, CameraOffIcon, CheckIcon, EyeOffIcon, MicIcon } from '../components/icons.js';
import type { Routine } from '../db/schema.js';
import type { SetupCheck } from '@kinetrace/engine';

/**
 * Shown while the pose model has not seen anybody yet. Without this the setup
 * screen would be blank exactly when the user most needs to know what to fix.
 */
/**
 * The commands worth listing in the help line. "Finish" is left out: it is a
 * button on the screen already, and printing it invites saying it by accident.
 */
const VOICE_COMMAND_ORDER: VoiceCommand[] = ['pause', 'resume', 'next', 'repeat'];

const NO_BODY_CHECKS: SetupCheck[] = [
  { id: 'bodyVisible', status: 'failed', tipKey: 'setup.tip.wholeBody' },
  { id: 'framing', status: 'pending', tipKey: null },
  { id: 'view', status: 'pending', tipKey: null },
  { id: 'detection', status: 'pending', tipKey: null },
];

export function SessionScreen(): JSX.Element {
  const { routineId } = useParams();
  const [search] = useSearchParams();
  const resumeSessionId = Number(search.get('resume')) || undefined;
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const settings = useSettingsStore();
  const [routine, setRoutine] = useState<Routine | undefined>();
  const [showPreview, setShowPreview] = useState(settings.showCameraPreview);

  useEffect(() => {
    if (!routineId) return;
    void db.routines.get(Number(routineId)).then(setRoutine);
  }, [routineId]);

  const session = useSessionRunner(routine, settings.activeProfileId, resumeSessionId);
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

  // 'error' belongs here: the only thing that raises it is the pose model
  // failing to load, which happens before a single set can run. Left out, the
  // stage fell through to the coaching panel and the app cheerfully showed a
  // repetition counter, a target band and a gesture hint for a session that had
  // nothing behind it and would never count anything.
  const inSetup =
    session.stage === 'setup' || session.stage === 'loading' || session.stage === 'error';
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

  /**
   * Spoken commands are not a toggle: "pausa" always pauses, "sigue" always
   * resumes. Somebody who is not sure what state the session is in should be
   * able to say the thing they want and get it.
   */
  const runVoiceCommand = (command: VoiceCommand): void => {
    switch (command) {
      case 'pause':
        session.setPaused(true);
        break;
      case 'resume':
        session.setPaused(false);
        break;
      case 'next':
        if (session.stage !== 'paused') session.skipSet();
        break;
      case 'repeat':
        session.repeatCue();
        break;
      case 'stop':
        void endSession();
        break;
    }
  };

  // The microphone is only opened after the user has started the session, so
  // the two permission prompts do not arrive at once and unasked.
  const voice = useVoiceCommands({
    enabled:
      settings.voiceCommands &&
      session.cameraStatus === 'ready' &&
      session.stage !== 'finished' &&
      session.stage !== 'error',
    language,
    variant: settings.voiceModel,
    onCommand: runVoiceCommand,
  });

  /**
   * One line at the bottom says how to drive the session. Voice takes it over
   * when it is working, because the words are what somebody on the mat needs;
   * when it cannot listen it says why, and otherwise the gestures do.
   */
  const helpText =
    voice.status === 'listening'
      ? t('voice.help', {
          words: VOICE_COMMAND_ORDER.map(
            (command) => `«${VOICE_EXAMPLES[command][language]}»`,
          ).join(', '),
        })
      : voice.status === 'denied' || voice.status === 'unsupported' || voice.status === 'error'
        ? t(`voice.${voice.status}`)
        : t('session.gestureHelp');

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
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[19px] font-semibold">
              {exercise?.names[language] ?? session.item?.customNote}
            </p>
            <p className="text-[15px] text-far-muted">
              {t('session.set', {
                current: session.item?.setNumber ?? 1,
                total: session.item?.totalSets ?? 1,
              })}
              {/* Which limb, when it matters. The engine measures one side and
                  nothing else on this screen says which, so doing the wrong leg
                  looked like doing the exercise badly. */}
              {session.item?.side ? (
                <span className="text-far-accent"> · {t(`side.${session.item.side}`)}</span>
              ) : null}
            </p>
            <VoiceIndicator
              status={voice.status}
              progress={voice.progress}
              level={voice.level}
              lastCommand={voice.lastCommand}
              lastCommandAt={voice.lastCommandAt}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 pt-2" aria-hidden="true">
              {Array.from({ length: session.item?.totalSets ?? 1 }, (_, index) => (
                <span
                  key={index}
                  className={`h-[5px] w-[26px] rounded-full ${
                    index < (session.item?.setNumber ?? 1) ? 'bg-far-accent' : 'bg-far-track'
                  }`}
                />
              ))}
            </div>
            <button className="btn-ghost px-2 text-far-muted" onClick={() => void endSession()}>
              {t('session.end')}
            </button>
          </div>
        </header>

        {inSetup ? (
          <SetupPanel
            state={setupState}
            cameraStatus={session.cameraStatus}
            cameraError={session.cameraError}
            modelLoading={session.modelLoading}
            {...(session.stage === 'error' ? { modelError: session.error ?? '' } : {})}
            onRetryModel={session.retryModel}
            onGuided={() => navigate(`/guided/${routineId}`, { replace: true })}
            checks={setupState?.checks ?? NO_BODY_CHECKS}
            reference={exercise?.reference}
            view={exercise?.view.orientation ?? 'side'}
            tip={exercise ? t(exercise.cameraTipKey) : ''}
            canKeepScreenAwake={session.canKeepScreenAwake}
            onStart={() => void session.start()}
          />
        ) : session.stage === 'rest' ? (
          <RestPanel
            seconds={session.restRemainingSeconds}
            nextName={exercise?.names[language] ?? ''}
            tip={exercise ? t(exercise.cameraTipKey) : ''}
            {...(session.item?.physioNote ? { physioNote: session.item.physioNote } : {})}
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

        {!inSetup && session.stage !== 'finished' ? (
          <footer className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-[13px] text-far-dim">
              <button
                className="btn-ghost min-h-0 px-0 py-1 text-[13px] text-far-dim"
                onClick={() => setShowPreview((current) => !current)}
              >
                {showPreview ? t('session.previewOff') : t('session.togglePreview')}
              </button>
              <span className="text-center">{helpText}</span>
              <button
                className="btn-ghost min-h-0 px-0 py-1 text-[13px] text-far-dim"
                onClick={session.togglePause}
              >
                {session.stage === 'paused' ? t('session.resume') : t('session.paused')}
              </button>
            </div>
            <div className="h-1.5 w-full rounded-full bg-far-track">
              <div
                className="h-full rounded-full bg-far-accent transition-[width]"
                style={{ width: `${Math.round(session.progress * 100)}%` }}
              />
            </div>
          </footer>
        ) : null}
      </div>

      {session.stage === 'paused' ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-ink/90">
          <p className="text-far-sm">{t('session.paused')}</p>
          <button className="btn-primary bg-canvas text-ink" onClick={session.togglePause}>
            {t('session.resume')}
          </button>
          {/* Reachable from the mat: both hands up pauses, and the decision is
              here at full size rather than needing a gesture of its own. */}
          <button
            className="btn-secondary border-far-line bg-far-surface text-far-ink"
            onClick={session.redoSet}
          >
            {t('session.redoSet')}
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
  const isHold = exercise?.mode === 'hold';
  const total = isHold ? session.item?.holdSeconds : session.item?.reps;
  const done = isHold ? Math.floor((state?.heldMs ?? 0) / 1000) : (state?.reps ?? 0);
  const inBand =
    Number.isFinite(state?.primaryValue) &&
    (state?.primaryValue ?? 0) >= band.min &&
    (state?.primaryValue ?? 0) <= band.max;

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <div className="flex items-center justify-center rounded-[22px] bg-far-surface p-2">
        {session.frame ? (
          <StickFigure
            landmarks={session.frame.world.length ? session.frame.world : session.frame.image}
            space={session.frame.world.length ? 'world' : 'image'}
            plane={exercise?.view.orientation === 'front' ? 'frontal' : 'sagittal'}
            highlight={highlight}
            far
            stroke="#f7f5f2"
            highlightStroke="#ff9552"
            className={`h-[150px] w-full ${lost ? 'opacity-30' : ''}`}
          />
        ) : (
          <div className="h-[150px]" />
        )}
      </div>

      <div className={`flex items-center justify-center gap-5 ${lost ? 'opacity-35' : ''}`}>
        <span className="text-[clamp(5rem,30vmin,11rem)] font-extrabold leading-[0.85] tracking-[-0.05em]">
          {done}
        </span>
        <div className="flex flex-col gap-2.5 pb-2">
          <span className="text-[34px] font-semibold text-far-muted">
            / {total ?? '—'}
            {isHold ? ' s' : ''}
          </span>
          {!isHold && total ? (
            <RepDots
              total={total}
              state={state}
              band={band}
              direction={exercise?.targets.direction ?? 'increase'}
            />
          ) : null}
        </div>
      </div>

      <div className={`flex items-center gap-5 px-1 ${lost ? 'opacity-35' : ''}`}>
        <AngleGauge
          value={state?.primaryValue ?? Number.NaN}
          band={band}
          min={safety?.min ?? band.min - 30}
          max={safety?.max ?? band.max + 30}
          {...(safety ? { safety } : {})}
          far
          label={metricName}
          className="h-[124px] w-[124px] shrink-0"
        />
        <div className="flex min-w-0 flex-col">
          <span
            className={`text-[clamp(2.4rem,11vmin,4rem)] font-extrabold leading-none tracking-tight ${
              state?.unsafe ? 'text-far-safety' : inBand ? 'text-far-band' : 'text-far-ink'
            }`}
          >
            {Number.isFinite(state?.primaryValue) ? Math.round(state?.primaryValue ?? 0) : '—'}°
          </span>
          <span className="mt-1 truncate text-[16px] text-far-muted">
            {metricName} · {band.min}–{band.max}°
          </span>
        </div>
      </div>

      {lost ? (
        <p className="text-center text-[20px] font-semibold text-far-correct">
          {t('session.lost')}
        </p>
      ) : null}
    </div>
  );
}

/** One dot per repetition: the band colour when it reached the target, the accent when it fell short. */
function RepDots({
  total,
  state,
  band,
  direction,
}: {
  total: number;
  state: RunnerState | null;
  band: TargetBand;
  direction: 'increase' | 'decrease';
}): JSX.Element {
  const peaks = state?.peaks ?? [];
  const reached = (peak: number): boolean =>
    direction === 'increase' ? peak >= band.min : peak <= band.max;

  return (
    <div className="flex max-w-[132px] flex-wrap gap-[5px]" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const peak = peaks[index];
        const colour =
          peak === undefined || !Number.isFinite(peak)
            ? 'bg-far-track'
            : reached(peak)
              ? 'bg-far-band'
              : 'bg-far-accent';
        return <span key={index} className={`h-[13px] w-[13px] rounded-full ${colour}`} />;
      })}
    </div>
  );
}

interface SetupPanelProps {
  state: SetupState | null;
  checks: readonly SetupCheck[];
  /** Where to put the phone for this exercise. */
  tip: string;
  cameraStatus: string;
  cameraError?: string;
  modelLoading: boolean;
  /** Set only when the pose model could not be loaded at all. */
  modelError?: string;
  onRetryModel: () => void;
  /** The way out that does not need a model: the voice guided session. */
  onGuided: () => void;
  reference?: Parameters<typeof SilhouetteGuide>[0]['reference'];
  view: 'side' | 'front';
  /** False where the browser cannot hold the screen awake; the user should know. */
  canKeepScreenAwake: boolean;
  onStart: () => void;
}

function SetupPanel({
  state,
  checks,
  cameraStatus,
  cameraError,
  modelLoading,
  modelError,
  onRetryModel,
  onGuided,
  reference,
  view,
  tip,
  canKeepScreenAwake,
  onStart,
}: SetupPanelProps): JSX.Element {
  const { t } = useTranslation();

  if (modelError !== undefined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-far-safety-bg text-far-safety">
          <EyeOffIcon size={34} />
        </div>
        <p className="text-[22px] font-semibold text-far-safety">{t('setup.modelError')}</p>
        <p className="max-w-[32ch] text-[15px] leading-relaxed text-far-muted">
          {t('setup.modelErrorHelp')}
        </p>
        {/* The message the adapter gave, kept because it is the only thing that
            separates "you are offline" from something a bug report needs. */}
        {modelError ? (
          <p className="max-w-[32ch] text-[13px] leading-relaxed text-far-dim">{modelError}</p>
        ) : null}
        <div className="flex flex-col items-center gap-3">
          <button
            className="btn-secondary border-far-line bg-far-surface text-far-ink"
            onClick={onRetryModel}
          >
            {t('common.retry')}
          </button>
          <button
            className="flex items-center gap-2 py-2 text-[15px] text-far-muted underline underline-offset-4"
            onClick={onGuided}
          >
            <MicIcon size={18} />
            {t('guided.start')}
          </button>
        </div>
      </div>
    );
  }

  if (cameraStatus === 'idle') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <CameraIcon size={44} className="text-far-accent" />
        <p className="text-[28px] font-bold tracking-tight">{t('setup.title')}</p>
        <p className="max-w-[30ch] text-[16px] leading-relaxed text-far-muted">
          {t('setup.cameraHelp')}
        </p>
        <button
          className="btn-primary h-[60px] bg-canvas px-10 text-[19px] text-ink"
          onClick={onStart}
        >
          {t('common.start')}
        </button>
      </div>
    );
  }

  if (cameraStatus === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-far-safety-bg text-far-safety">
          <CameraOffIcon size={34} />
        </div>
        <p className="text-[22px] font-semibold text-far-safety">{t('setup.cameraError')}</p>
        <p className="max-w-[32ch] text-[15px] leading-relaxed text-far-muted">{cameraError}</p>
        <button
          className="btn-secondary border-far-line bg-far-surface text-far-ink"
          onClick={onStart}
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const passed = checks.filter((check) => check.status === 'ok').length;

  return (
    <div className="flex flex-1 flex-col gap-5 pt-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-far-accent">
          {t('setup.beforeStarting')}
        </span>
        <p className="text-[26px] font-bold tracking-tight">
          {modelLoading ? t('setup.modelLoading') : t('setup.title')}
        </p>
      </div>

      {/* The silhouette is the posture to line up with, inside its own frame so
          it never sits on top of the checks. */}
      <div className="relative flex h-[240px] items-center justify-center overflow-hidden rounded-[24px] bg-far-surface">
        {reference ? (
          <SilhouetteGuide reference={reference} view={view} className="h-full w-[88%]" />
        ) : null}
        <span className="absolute bottom-3 text-[13px] text-far-dim">{t('setup.silhouette')}</span>
      </div>

      <ul className="flex flex-col gap-3">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full ${
                check.status === 'ok'
                  ? 'bg-far-band text-far-bg'
                  : check.tipKey
                    ? 'border-2 border-far-accent'
                    : 'border-2 border-far-track'
              }`}
            >
              {check.status === 'ok' ? <CheckIcon size={14} strokeWidth={3.4} /> : null}
            </span>
            <span
              className={`text-[17px] ${check.status === 'ok' ? 'text-far-muted' : 'text-far-ink'}`}
            >
              {t(`setup.check.${check.id}`)}
            </span>
            {check.tipKey ? (
              <span className="ml-auto max-w-[46%] text-right text-[14px] font-semibold leading-snug text-far-accent">
                {t(check.tipKey)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-3 rounded-[20px] border border-far-line bg-far-surface p-4">
        <CameraIcon size={22} className="mt-0.5 shrink-0 text-far-muted" />
        <span className="text-[15px] leading-relaxed text-far-muted">{tip}</span>
      </div>

      {/* Kinetrace keeps the screen on by itself where it can. Where it cannot,
          saying so beats a black screen halfway through the second set. */}
      {!canKeepScreenAwake ? (
        <p className="text-[14px] leading-relaxed text-far-dim">{t('session.screenMaySleep')}</p>
      ) : null}

      <div className="mt-auto flex flex-col items-center gap-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-far-track">
          <div
            className="h-full rounded-full bg-far-accent transition-[width]"
            style={{ width: `${(passed / Math.max(1, checks.length)) * 100}%` }}
          />
        </div>
        <span className="text-[17px] text-far-muted">
          {state?.ready ? t('setup.ready') : t('setup.holdStill')}
        </span>
      </div>
    </div>
  );
}

interface RestPanelProps {
  seconds: number;
  nextName: string;
  tip: string;
  /** What the professional wrote for the exercise coming up, if anybody has. */
  physioNote?: string;
  onSkip: () => void;
}

function RestPanel({ seconds, nextName, tip, physioNote, onSkip }: RestPanelProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <p className="text-xl opacity-70">{t('session.rest')}</p>
      <p className="text-far font-semibold">{seconds}</p>
      <p className="text-far-cue">{t('session.restNext', { name: nextName })}</p>
      {/* What the physiotherapist wrote for this exercise outranks our tip. */}
      {physioNote ? (
        <p className="max-w-lg rounded-2xl bg-far-surface px-5 py-3 text-lg text-far-accent">
          {t('session.physioSays', { note: physioNote })}
        </p>
      ) : null}
      <p className="max-w-lg text-lg opacity-70">{tip}</p>
      <button className="btn-primary bg-canvas text-ink" onClick={onSkip}>
        {t('common.skip')}
      </button>
    </div>
  );
}
