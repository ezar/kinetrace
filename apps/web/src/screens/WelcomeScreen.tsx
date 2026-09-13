/**
 * The first run.
 *
 * Five screens, in the order somebody actually needs them: what this is and
 * what it is not, what happens to the camera, who is training, what they are
 * going to do, and how to drive it from the mat.
 *
 * Two of those are not decoration. The privacy promise comes before the browser
 * ever asks for the camera, because that prompt is where trust is won or lost.
 * And the gestures and voice commands are the only part of Kinetrace nobody
 * would ever find on their own — the help line during a session is three metres
 * away and one line long.
 *
 * Everything here is skippable and repeatable from settings. Nothing here asks
 * for a permission: the camera is requested by the session, the microphone by
 * the voice commands, each at the moment it is used.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { metricLandmarkIndices } from '@kinetrace/engine';
import { getExercise } from '@kinetrace/exercises';
import { db, PROFILE_COLORS } from '../db/schema.js';
import { createProfile, createStarterRoutine, createStretchRoutine } from '../db/repositories.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '../i18n/index.js';
import { ExerciseDemo } from '../components/ExerciseDemo.js';
import { GestureCard } from '../components/GestureCard.js';
import { voiceCommandsSupported, whisperModel } from '../speech/listener.js';
import { CameraIcon, CheckIcon, ChevronLeftIcon, MicIcon } from '../components/icons.js';

type Step = 'what' | 'privacy' | 'profile' | 'routine' | 'mat';

const FIRST_RUN: readonly Step[] = ['what', 'privacy', 'profile', 'routine', 'mat'];
/**
 * Watching it again from settings, which people do for the gestures. The setup
 * steps are left out: the profile and the routine already exist, and walking
 * through them again would make a second of each.
 */
const REPLAY: readonly Step[] = ['what', 'privacy', 'mat'];

/** What the user chose to do about a routine, decided on the routine step. */
type RoutineChoice = 'starter' | 'import' | 'later';

/**
 * The exercise on the first screen. A squat, because everybody recognises one
 * and it is obvious from the side how far down somebody got — which is the
 * thing Kinetrace measures. A lying exercise would be a truer picture of the
 * library and a worse first impression: supine poses take a moment to read.
 */
const SHOWCASE_EXERCISE = 'bodyweight-squat';

export function WelcomeScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const settings = useSettingsStore();

  // Frozen on arrival: creating the profile mid-flow must not rewrite the steps
  // under the person walking through them.
  const profileCount = useLiveQuery(() => db.profiles.count(), [], undefined);
  const [steps, setSteps] = useState<readonly Step[] | null>(null);
  useEffect(() => {
    if (profileCount === undefined) return;
    setSteps((current) => current ?? (profileCount > 0 ? REPLAY : FIRST_RUN));
  }, [profileCount]);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PROFILE_COLORS[0]);
  const [choice, setChoice] = useState<RoutineChoice>('starter');
  const [profileId, setProfileId] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);

  const current = steps?.[step];
  const isLast = steps !== null && step === steps.length - 1;
  const canContinue = current !== 'profile' || name.trim().length > 0;

  const leave = async (destination: string): Promise<void> => {
    await settings.update({ onboarded: true });
    navigate(destination, { replace: true });
  };

  /** Everything the current step has to commit before the next one is shown. */
  const advance = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      if (current === 'profile' && profileId === undefined) {
        const id = await createProfile({
          name: name.trim(),
          color,
          language,
          physioNotes: '',
        });
        setProfileId(id);
      }
      if (current === 'routine' && choice === 'starter' && profileId !== undefined) {
        await createStarterRoutine(profileId, t('home.starterRoutine'));
        // And the stretches, because the library has them and nothing else
        // points at them: without this the only way to stretch is to build a
        // routine by hand first.
        await createStretchRoutine(profileId, t('home.stretchRoutine'));
      }
      if (isLast) {
        await leave(choice === 'import' ? '/import' : '/');
        return;
      }
      setStep((index) => index + 1);
    } finally {
      setBusy(false);
    }
  };

  if (!steps || !current) return <div className="p-8 text-muted">…</div>;

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 pb-6 pt-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button
              className="btn-ghost min-h-0 px-1 py-1"
              aria-label={t('common.back')}
              onClick={() => setStep((index) => Math.max(0, index - 1))}
            >
              <ChevronLeftIcon size={22} />
            </button>
          ) : null}
          <ol
            className="flex gap-1.5"
            aria-label={t('welcome.step', { current: step + 1, total: steps.length })}
          >
            {steps.map((id, index) => (
              <li
                key={id}
                className={`h-[5px] w-6 rounded-full transition-colors ${
                  index <= step ? 'bg-accent' : 'bg-line'
                }`}
              />
            ))}
          </ol>
        </div>
        {!isLast ? (
          <button
            className="btn-ghost min-h-0 px-2 py-1 text-[14px]"
            onClick={() => void leave('/')}
          >
            {t('welcome.skip')}
          </button>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col justify-center py-6">
        {current === 'what' ? <WhatStep /> : null}
        {current === 'privacy' ? <PrivacyStep /> : null}
        {current === 'profile' ? (
          <ProfileStep
            name={name}
            color={color}
            onName={setName}
            onColor={setColor}
            onSubmit={() => void advance()}
          />
        ) : null}
        {current === 'routine' ? <RoutineStep choice={choice} onChoice={setChoice} /> : null}
        {current === 'mat' ? <MatStep /> : null}
      </div>

      <button
        className="btn-primary h-14 w-full text-[17px] font-semibold"
        disabled={!canContinue || busy}
        onClick={() => void advance()}
      >
        {isLast ? t('welcome.begin') : t('common.continue')}
      </button>
    </div>
  );
}

/** Shared shape of every step, so the rhythm never changes under the reader. */
function Step({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-[27px] font-bold leading-tight tracking-tight">{title}</h1>
        {body ? <p className="leading-relaxed text-muted">{body}</p> : null}
      </div>
      {children}
    </div>
  );
}

function WhatStep(): JSX.Element {
  const { t } = useTranslation();
  const exercise = getExercise(SHOWCASE_EXERCISE);
  // The joint the exercise is judged on, in the accent colour: the picture then
  // says what the sentence above it says.
  const primary = exercise?.metrics[exercise.primaryMetric];
  const highlight = primary ? metricLandmarkIndices(primary.id, primary.side) : [];

  return (
    <Step title={t('welcome.what.title')} body={t('welcome.what.body')}>
      {exercise ? (
        <div className="card flex items-center justify-center p-4">
          {/* The figure is scaled to fit a square, so a short wide box would
              shrink it: give it the height it needs. */}
          <ExerciseDemo
            reference={exercise.reference}
            view={exercise.view.orientation}
            highlight={highlight}
            highlightStroke="var(--color-accent)"
            className="h-52 w-full text-ink"
          />
        </div>
      ) : null}
      <p className="text-[14px] leading-relaxed text-muted">{t('app.disclaimer')}</p>
    </Step>
  );
}

function PrivacyStep(): JSX.Element {
  const { t } = useTranslation();
  const points = ['privacy.noVideo', 'privacy.noAccount', 'privacy.noAnalytics', 'privacy.offline'];

  return (
    <Step title={t('welcome.privacy.title')} body={t('welcome.privacy.body')}>
      <ul className="flex flex-wrap gap-2">
        {points.map((key) => (
          <li key={key} className="chip gap-1.5">
            <CheckIcon size={15} />
            {t(key)}
          </li>
        ))}
      </ul>
      <p className="text-[14px] leading-relaxed text-muted">{t('welcome.privacy.permissions')}</p>
    </Step>
  );
}

interface ProfileStepProps {
  name: string;
  color: string;
  onName: (value: string) => void;
  onColor: (value: string) => void;
  onSubmit: () => void;
}

function ProfileStep({ name, color, onName, onColor, onSubmit }: ProfileStepProps): JSX.Element {
  const { t, language } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return (
    <Step title={t('welcome.profile.title')} body={t('welcome.profile.body')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t('profiles.name')}</span>
          <input
            className="field"
            value={name}
            autoFocus
            autoComplete="given-name"
            onChange={(event) => onName(event.target.value)}
          />
        </label>

        <fieldset>
          <legend className="mb-1 text-sm text-muted">{t('profiles.color')}</legend>
          <div className="flex gap-2">
            {PROFILE_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={color === option}
                onClick={() => onColor(option)}
                className={`h-10 w-10 rounded-full ${
                  color === option ? 'ring-2 ring-ink ring-offset-2' : ''
                }`}
                style={{ backgroundColor: option }}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm text-muted">{t('profiles.language')}</legend>
          <div className="flex gap-2">
            {LANGUAGES.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${language === option ? 'border-ink bg-ink text-canvas' : ''}`}
                aria-pressed={language === option}
                onClick={() => void setLanguage(option as Language)}
              >
                {LANGUAGE_NAMES[option]}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Step>
  );
}

function RoutineStep({
  choice,
  onChoice,
}: {
  choice: RoutineChoice;
  onChoice: (value: RoutineChoice) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const options: Array<{ id: RoutineChoice; title: string; help: string }> = [
    {
      id: 'starter',
      title: t('welcome.routine.starter'),
      help: t('welcome.routine.starterHelp'),
    },
    { id: 'import', title: t('welcome.routine.import'), help: t('welcome.routine.importHelp') },
    { id: 'later', title: t('welcome.routine.later'), help: t('welcome.routine.laterHelp') },
  ];

  return (
    <Step title={t('welcome.routine.title')} body={t('welcome.routine.body')}>
      <div className="flex flex-col gap-2.5">
        {options.map((option) => (
          <label
            key={option.id}
            className={`card flex cursor-pointer items-start gap-3 p-4 ${
              choice === option.id ? 'border-ink' : ''
            }`}
          >
            <input
              type="radio"
              name="routineChoice"
              className="mt-1"
              checked={choice === option.id}
              onChange={() => onChoice(option.id)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{option.title}</span>
              <span className="text-[14px] leading-relaxed text-muted">{option.help}</span>
            </span>
          </label>
        ))}
      </div>
    </Step>
  );
}

function MatStep(): JSX.Element {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const voiceSupported = voiceCommandsSupported();

  return (
    <Step title={t('welcome.mat.title')} body={t('welcome.mat.body')}>
      <div className="card flex items-start gap-3 p-4">
        <CameraIcon size={20} className="mt-0.5 shrink-0 text-muted" />
        <p className="text-[15px] leading-relaxed">{t('welcome.mat.camera')}</p>
      </div>

      <div className="flex gap-2.5">
        <GestureCard motion="pauseToggle" arms="both" caption={t('welcome.mat.pause')} />
        <GestureCard motion="skip" arms="right" caption={t('welcome.mat.skip')} />
      </div>

      {voiceSupported ? (
        <div className="card flex items-start gap-3 p-4">
          <MicIcon size={20} className="mt-0.5 shrink-0 text-muted" />
          <div className="flex flex-col items-start gap-2">
            <p className="text-[15px] leading-relaxed">{t('welcome.mat.voice')}</p>
            {settings.voiceCommands ? (
              <p className="flex items-center gap-1.5 text-[14px] text-band">
                <CheckIcon size={15} />
                {t('welcome.mat.voiceDone')}
              </p>
            ) : (
              <button
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => void settings.update({ voiceCommands: true })}
              >
                {t('welcome.mat.voiceOn', { size: whisperModel(settings.voiceModel).sizeMb })}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </Step>
  );
}
