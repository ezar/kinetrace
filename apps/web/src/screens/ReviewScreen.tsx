/**
 * The professional's review.
 *
 * Every screen that shows a target range says the same thing: these are
 * defaults, and your physiotherapist's numbers replace them. This is where that
 * happens. A professional goes through the routine exercise by exercise — what
 * is measured and how reliably, the range to aim for, the point at which the
 * session stops, the dosage, and the exact words the app will say — adjusts
 * them, and signs.
 *
 * The numbers are checked as they are typed. Most of the checks are arithmetic;
 * the one that matters knows how the engine counts, and catches a band that has
 * quietly stopped meaning anything. Errors block the signature. Warnings do
 * not: the professional is the authority, and the app's job is to make sure
 * they are looking at what they are signing.
 *
 * Nothing leaves the device. The signature is a record that somebody sat down
 * and checked, not an authentication.
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  canPrescribe,
  describeCondition,
  getExercise,
  spinalLoadMix,
  metricDescription,
  metricLabel,
  metricRange,
  phaseLabel,
  reviewPrescription,
  type ExerciseDefinition,
  type Prescription,
  type PrescriptionIssue,
} from '@kinetrace/exercises';
import { metricLandmarkIndices, type TargetBand } from '@kinetrace/engine';
import { db, type Routine, type RoutineExercise, type Session } from '../db/schema.js';
import { saveRoutineReview } from '../db/repositories.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { ExerciseDemo } from '../components/ExerciseDemo.js';
import { AngleGauge } from '../components/AngleGauge.js';
import { NumberField } from '../components/NumberField.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { CheckIcon } from '../components/icons.js';

/** Recent sessions carrying a note or a pain score, shown to the professional. */
const FELT_SHOWN = 6;

/**
 * Fill in what the routine leaves to the library, so the professional is
 * looking at the numbers that will actually be used rather than at blanks.
 */
function withDefaults(entry: RoutineExercise): RoutineExercise {
  const exercise = getExercise(entry.exerciseId);
  if (!exercise) return entry;
  return {
    ...entry,
    band: entry.band ?? { ...exercise.targets.band },
    safety: entry.safety ?? (exercise.targets.safety ? { ...exercise.targets.safety } : undefined),
    reps: entry.reps ?? exercise.defaults.reps,
    holdSeconds: entry.holdSeconds ?? exercise.defaults.holdSeconds,
  };
}

function prescriptionOf(entry: RoutineExercise, exercise: ExerciseDefinition): Prescription {
  return {
    band: entry.band ?? exercise.targets.band,
    ...(entry.safety ? { safety: entry.safety } : {}),
    sets: entry.sets,
    ...(entry.reps !== undefined ? { reps: entry.reps } : {}),
    ...(entry.holdSeconds !== undefined ? { holdSeconds: entry.holdSeconds } : {}),
    restSeconds: entry.restSeconds,
    ...(entry.tempo ? { tempo: entry.tempo } : {}),
  };
}

/** Seconds to start from when a pace is switched on and nobody has set one. */
const DEFAULT_PHASE_SECONDS = 2;

export function ReviewScreen(): JSX.Element {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [routine, setRoutine] = useState<Routine | undefined>();
  const [entries, setEntries] = useState<RoutineExercise[]>([]);
  const [felt, setFelt] = useState<Session[]>([]);
  const [by, setBy] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMix = useMemo(
    () =>
      spinalLoadMix(
        entries
          .map((entry) => getExercise(entry.exerciseId))
          .filter((exercise): exercise is NonNullable<typeof exercise> => exercise !== undefined),
      ),
    [entries],
  );

  useEffect(() => {
    if (!routineId) return;
    void db.routines.get(Number(routineId)).then((found) => {
      if (!found) return;
      setRoutine(found);
      setEntries(found.exercises.map(withDefaults));
      setBy(found.review?.by ?? '');
      setNote(found.review?.note ?? '');
    });
  }, [routineId]);

  /**
   * What the person has written about themselves. It never feeds any logic — the
   * app promises that — but somebody deciding a range should have read it.
   */
  useEffect(() => {
    if (!routine) return;
    void db.sessions
      .where('profileId')
      .equals(routine.profileId)
      .toArray()
      .then((sessions) => {
        setFelt(
          sessions
            .filter(
              (session) =>
                session.painScore !== undefined || (session.notes ?? '').trim().length > 0,
            )
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, FELT_SHOWN),
        );
      });
  }, [routine]);

  const update = (index: number, patch: Partial<RoutineExercise>): void => {
    setEntries((current) =>
      current.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)),
    );
  };

  /** Every issue, per exercise, recomputed as the numbers are typed. */
  const issues = useMemo(
    () =>
      entries.map((entry) => {
        const exercise = getExercise(entry.exerciseId);
        if (!exercise) return [] as PrescriptionIssue[];
        return reviewPrescription(exercise, prescriptionOf(entry, exercise));
      }),
    [entries],
  );

  const blocked = issues.some((list) => !canPrescribe(list));
  const sign = async (): Promise<void> => {
    if (!routine || blocked || !by.trim() || saving) return;
    setSaving(true);
    await saveRoutineReview(routine.id, entries, {
      by: by.trim(),
      at: Date.now(),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    navigate(`/routines/${routine.id}`, { replace: true });
  };

  if (!routine) return <div className="p-8 text-muted">{t('common.loading')}</div>;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-40 pt-4">
      <ScreenHeader title={t('review.title')} subtitle={routine.name} back />

      <section className="card space-y-2 p-4">
        <p className="leading-relaxed">{t('review.intro')}</p>
        <p className="text-sm leading-relaxed text-muted">{t('review.privacy')}</p>
        {routine.review ? (
          <p className="flex items-center gap-1.5 pt-1 text-sm text-band">
            <CheckIcon size={16} />
            {t('review.signedBy', {
              name: routine.review.by,
              date: new Date(routine.review.at).toLocaleDateString(language, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            })}
          </p>
        ) : null}
      </section>

      {loadMix.length > 0 ? (
        <section className="card mt-4 p-4">
          <h2 className="font-medium">{t('review.loadMix')}</h2>
          {/* Counted, never judged. Which way a routine leans is a thing the
              person reviewing it should be able to see at a glance; which way
              it ought to lean is entirely theirs to decide. */}
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {loadMix.map(([load, count]) => (
              <li key={load}>
                {t(`spinalLoad.${load}`)} · {count}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {felt.length > 0 ? (
        <section className="card mt-4 p-4">
          <h2 className="font-medium">{t('review.howTheyFelt')}</h2>
          <p className="text-sm text-muted">{t('summary.painHelp')}</p>
          <ul className="mt-2 divide-y divide-line">
            {felt.map((session) => (
              <li key={session.id} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="w-20 shrink-0 text-muted">
                  {new Date(session.startedAt).toLocaleDateString(language, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                {session.painScore !== undefined ? (
                  <span className="chip shrink-0 text-xs">
                    {t('review.painValue', { value: session.painScore })}
                  </span>
                ) : null}
                <span className="flex-1 leading-relaxed">{session.notes}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-4 space-y-4">
        {entries.map((entry, index) => (
          <ExerciseReview
            key={`${entry.exerciseId}-${index}`}
            entry={entry}
            issues={issues[index] ?? []}
            onChange={(patch) => update(index, patch)}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {blocked ? <p className="text-sm text-safety">{t('review.blocked')}</p> : null}
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-sm text-muted">{t('review.signature')}</span>
              <input
                className="field"
                value={by}
                placeholder={t('review.signaturePlaceholder')}
                onChange={(event) => setBy(event.target.value)}
              />
            </label>
            <button
              className="btn-primary h-12 shrink-0"
              disabled={blocked || by.trim().length === 0 || saving}
              onClick={() => void sign()}
            >
              {t('review.sign')}
            </button>
          </div>
          <input
            className="field text-sm"
            value={note}
            placeholder={t('review.notePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

interface ExerciseReviewProps {
  entry: RoutineExercise;
  issues: readonly PrescriptionIssue[];
  onChange: (patch: Partial<RoutineExercise>) => void;
}

function ExerciseReview({ entry, issues, onChange }: ExerciseReviewProps): JSX.Element {
  const { t, language } = useTranslation();
  const exercise = getExercise(entry.exerciseId);
  const [showCues, setShowCues] = useState(false);

  if (!exercise) {
    return (
      <section className="card p-4">
        <h2 className="font-medium">{entry.customNote ?? entry.exerciseId}</h2>
        <p className="mt-1 text-sm text-muted">{t('review.untracked')}</p>
      </section>
    );
  }

  const metric = exercise.metrics[exercise.primaryMetric];
  const band = entry.band ?? exercise.targets.band;
  const safety = entry.safety;
  const range = metricRange(exercise);
  // The dial is scaled around the target, not around the safety stop: a safety
  // range of 45 to 130 degrees would squeeze a 20 degree target into a sliver.
  const padding = Math.max(20, band.max - band.min);
  const gaugeMin = band.min - padding;
  const gaugeMax = band.max + padding;

  const setBand = (patch: Partial<TargetBand>): void => onChange({ band: { ...band, ...patch } });
  const toggleSafety = (on: boolean): void => {
    onChange({
      safety: on ? (exercise.targets.safety ?? { min: range.min, max: range.max }) : undefined,
    });
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex items-start gap-3 p-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-canvas">
          <ExerciseDemo
            reference={exercise.reference}
            view={exercise.view.orientation}
            highlight={metricLandmarkIndices(metric?.id ?? 'hipFlexion', metric?.side ?? 'auto')}
            className="h-full w-full text-ink"
            still
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{exercise.names[language]}</h2>
          <p className="text-sm text-muted">
            {metricLabel(metric?.id ?? 'hipFlexion', language)} ·{' '}
            {t(`library.tracking.${exercise.trackingConfidence}`)} ·{' '}
            {t(`spinalLoad.${exercise.spinalLoad}`)}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {metricDescription(metric?.id ?? 'hipFlexion', language)}
          </p>
        </div>
      </header>

      <div className="border-t border-line p-4">
        <div className="flex items-start gap-4">
          <AngleGauge
            value={(band.min + band.max) / 2}
            band={band}
            min={gaugeMin}
            max={gaugeMax}
            {...(safety ? { safety } : {})}
            className="h-24 w-24 shrink-0"
          />
          <div className="flex-1 space-y-3">
            <div className="flex gap-2">
              <NumberField
                label={t('review.bandMin')}
                value={band.min}
                unit="°"
                onChange={(value) => setBand({ min: value })}
              />
              <NumberField
                label={t('review.bandMax')}
                value={band.max}
                unit="°"
                onChange={(value) => setBand({ max: value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={safety !== undefined}
                onChange={(event) => toggleSafety(event.target.checked)}
              />
              {t('review.safety')}
            </label>
            {safety ? (
              <div className="flex gap-2">
                <NumberField
                  label={t('review.safetyMin')}
                  value={safety.min}
                  unit="°"
                  onChange={(value) => onChange({ safety: { ...safety, min: value } })}
                />
                <NumberField
                  label={t('review.safetyMax')}
                  value={safety.max}
                  unit="°"
                  onChange={(value) => onChange({ safety: { ...safety, max: value } })}
                />
              </div>
            ) : null}
          </div>
        </div>

        {issues.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {issues.map((issue) => (
              <li
                key={issue.code}
                className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  issue.severity === 'error'
                    ? 'bg-safety-soft text-safety'
                    : 'bg-accent-soft text-ink'
                }`}
              >
                {t(`review.issue.${issue.code}`, issue.params)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {exercise.unilateral ? (
        <div className="space-y-2 border-t border-line p-4">
          <span className="block text-sm text-muted">{t('review.side')}</span>
          <div className="flex flex-wrap gap-2">
            {([undefined, 'left', 'right'] as const).map((option) => (
              <button
                key={option ?? 'both'}
                type="button"
                aria-pressed={entry.side === option}
                className={`chip ${entry.side === option ? 'border-ink bg-ink text-canvas' : ''}`}
                onClick={() => onChange({ side: option })}
              >
                {option ? t(`side.${option}`) : t('review.side.both')}
              </button>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-muted">{t('review.sideHelp')}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 border-t border-line p-4">
        <NumberField
          label={t('common.sets')}
          value={entry.sets}
          onChange={(value) => onChange({ sets: value })}
        />
        {exercise.mode === 'hold' ? (
          <NumberField
            label={t('common.seconds')}
            value={entry.holdSeconds ?? 0}
            unit="s"
            onChange={(value) => onChange({ holdSeconds: value })}
          />
        ) : (
          <NumberField
            label={t('common.reps')}
            value={entry.reps ?? 0}
            onChange={(value) => onChange({ reps: value })}
          />
        )}
        <NumberField
          label={t('common.rest')}
          value={entry.restSeconds}
          unit="s"
          onChange={(value) => onChange({ restSeconds: value })}
        />
      </div>

      {/* Pacing. Only for counted exercises: a hold has one resting phase and
          nothing to pace. Off unless somebody sets it, and the sixteen library
          exercises that declare no tempo stay exactly as they are. */}
      {exercise.mode === 'reps' ? (
        <div className="space-y-2 border-t border-line p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={entry.tempo !== undefined}
              onChange={(event) =>
                onChange({
                  tempo: event.target.checked
                    ? (exercise.tempo?.map((target) => ({ ...target })) ??
                      exercise.phases.map((phase) => ({
                        phase: phase.id,
                        seconds: DEFAULT_PHASE_SECONDS,
                      })))
                    : undefined,
                })
              }
            />
            {t('review.tempo')}
          </label>
          {entry.tempo ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {entry.tempo.map((target, position) => (
                  <NumberField
                    key={target.phase}
                    label={phaseLabel(target.phase, language)}
                    value={target.seconds}
                    unit="s"
                    onChange={(value) =>
                      onChange({
                        tempo: (entry.tempo ?? []).map((item, index) =>
                          index === position ? { ...item, seconds: value } : item,
                        ),
                      })
                    }
                  />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted">{t('review.tempoHelp')}</p>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-line p-4">
        <button
          className="btn-ghost min-h-0 px-0 py-1 text-sm"
          aria-expanded={showCues}
          onClick={() => setShowCues((current) => !current)}
        >
          {t('review.cues', { count: exercise.rules.length })}
        </button>
        {showCues ? (
          <ul className="mt-2 space-y-2">
            {exercise.rules.map((rule) => (
              <li key={rule.id} className="text-sm leading-relaxed">
                <span className="font-medium">«{t(rule.cueKey)}»</span>
                <span className="text-muted">
                  {' '}
                  — {describeCondition(rule.when, exercise)[language]} ·{' '}
                  {t(`review.priority.${rule.priority}`)}
                </span>
              </li>
            ))}
            {exercise.rules.length === 0 ? (
              <li className="text-sm text-muted">{t('review.noCues')}</li>
            ) : null}
          </ul>
        ) : null}

        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-muted">{t('review.note')}</span>
          <input
            className="field"
            value={entry.physioNote ?? ''}
            placeholder={t('review.notePlaceholderExercise')}
            onChange={(event) => onChange({ physioNote: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
