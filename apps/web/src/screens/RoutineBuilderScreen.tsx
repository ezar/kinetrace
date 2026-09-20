/** Build a routine: ordered exercises with sets, reps or holds, rest and bands. */

import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EXERCISES, getExercise, PROGRAMMES, programmeOmissions } from '@kinetrace/exercises';
import { db, type RoutineReview, type RoutineExercise, type RoutineSource } from '../db/schema.js';
import { deleteRoutine, duplicateRoutine, saveRoutine } from '../db/repositories.js';
import { estimateMinutes } from '../session/plan.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { ExerciseDemo } from '../components/ExerciseDemo.js';
import { ReviewStamp } from '../components/ReviewStamp.js';
import { DragIcon } from '../components/icons.js';
import { moveItem } from '../routines/reorder.js';

export function RoutineBuilderScreen(): JSX.Element {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const activeProfileId = useSettingsStore((state) => state.activeProfileId);

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [review, setReview] = useState<RoutineReview | undefined>();
  const [source, setSource] = useState<RoutineSource | undefined>();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const id = routineId && routineId !== 'new' ? Number(routineId) : undefined;

  useEffect(() => {
    if (id === undefined) {
      setName(t('routine.new'));
      return;
    }
    void db.routines.get(id).then((routine) => {
      if (!routine) return;
      setName(routine.name);
      setExercises(routine.exercises);
      setReview(routine.review);
      setSource(routine.source);
    });
  }, [id, t]);

  const persist = async (): Promise<void> => {
    if (activeProfileId === undefined) return;
    const savedId = await saveRoutine({ id, profileId: activeProfileId, name, exercises });
    navigate(`/routines/${savedId}`, { replace: true });
  };

  const addExercise = (exerciseId: string): void => {
    const exercise = getExercise(exerciseId);
    if (!exercise) return;
    setExercises((current) => [
      ...current,
      {
        exerciseId,
        sets: exercise.defaults.sets,
        reps: exercise.defaults.reps,
        holdSeconds: exercise.defaults.holdSeconds,
        restSeconds: exercise.defaults.restSeconds,
      },
    ]);
    setPicking(false);
  };

  const move = (index: number, delta: number): void => {
    setExercises((current) => moveItem(current, index, index + delta));
  };

  /**
   * Dragging, with pointer events rather than the HTML5 drag API, which does
   * not exist on touch — and this is a phone app first. The up and down buttons
   * stay: they are the keyboard and screen reader path, and dragging is never
   * the only way to do something.
   */
  const listRef = useRef<HTMLUListElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const startDrag = (index: number) => (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(index);
  };

  const dragOver = (event: React.PointerEvent<HTMLElement>): void => {
    if (dragging === null) return;
    const items = [...(listRef.current?.children ?? [])] as HTMLElement[];
    const over = items.findIndex((item) => {
      const box = item.getBoundingClientRect();
      return event.clientY >= box.top && event.clientY <= box.bottom;
    });
    if (over < 0 || over === dragging) return;
    setExercises((current) => moveItem(current, dragging, over));
    setDragging(over);
  };

  const endDrag = (): void => setDragging(null);

  /** The programme's own steps that no exercise in the library can run. */
  const missingSteps = source
    ? programmeOmissions(
        PROGRAMMES.find((programme) => programme.id === source.programmeId) ?? {
          id: '',
          source: { title: '', publisher: '', year: 0 },
          steps: [],
        },
      )
    : [];

  const update = (index: number, patch: Partial<RoutineExercise>): void => {
    setExercises((current) =>
      current.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)),
    );
  };

  return (
    <div>
      <ScreenHeader
        title={t('routine.title')}
        subtitle={t('routine.estimated', { minutes: estimateMinutes({ exercises }) })}
        back
      />

      <label className="block">
        <span className="mb-1 block text-sm text-muted">{t('routine.name')}</span>
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      {/* The numbers below are the library's defaults until a professional has
          been through them, and the card says which of the two it is. */}
      {id !== undefined ? (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <ReviewStamp review={review} />
          <button
            className="btn-secondary px-4 py-2 text-sm"
            onClick={() => navigate(`/review/${id}`)}
          >
            {review ? t('review.again') : t('review.open')}
          </button>
        </div>
      ) : null}

      {/* Where these numbers were published, and — just as important — which
          of the document's exercises the app has no exercise for. A routine
          that can only run half a programme should say so next to the half it
          runs, not in a commit message. */}
      {source ? (
        <section className="card mt-4 space-y-2 p-4">
          <p className="text-sm font-medium">{t('source.title')}</p>
          <p className="text-sm text-muted">
            {source.publisher}. <span className="italic">{source.title}</span> ({source.year}).
          </p>
          <p className="text-xs leading-relaxed text-muted">{t('source.unsigned')}</p>
          {missingSteps.length > 0 ? (
            <div className="pt-1">
              <p className="text-sm">{t('source.missing', { count: missingSteps.length })}</p>
              <ul className="mt-1 space-y-1">
                {missingSteps.map((step) => (
                  <li key={step.step} className="text-sm text-muted">
                    {step.step}. {step.title} —{' '}
                    {step.omission?.reason === 'notInLibrary'
                      ? t('source.notInLibrary')
                      : t('source.differentExercise')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <ul className="mt-4 space-y-3" ref={listRef}>
        {exercises.map((entry, index) => {
          const exercise = getExercise(entry.exerciseId);
          const band = entry.band ?? exercise?.targets.band;
          return (
            <li
              key={`${entry.exerciseId}-${index}`}
              className={`card p-4 ${dragging === index ? 'ring-2 ring-accent' : ''}`}
            >
              <div className="flex items-start gap-3">
                {exercise ? (
                  <ExerciseDemo
                    reference={exercise.reference}
                    view={exercise.view.orientation}
                    className="h-16 w-16 shrink-0 text-ink"
                    still
                  />
                ) : null}
                <div className="flex-1">
                  <p className="font-medium">
                    {exercise?.names[language] ?? entry.customNote ?? entry.exerciseId}
                  </p>
                  <p className="text-sm text-muted">
                    {entry.sets} × {entry.holdSeconds ? `${entry.holdSeconds}s` : entry.reps} ·{' '}
                    {entry.restSeconds}s {t('common.rest')}
                    {band ? ` · ${band.min}–${band.max}°` : ''}
                  </p>
                  {!exercise ? (
                    <p className="mt-1 text-sm text-muted">{t('import.unmatched')}</p>
                  ) : null}
                  {/* The document's own words, so the numbers above can be
                      checked against the paper without leaving the screen. */}
                  {entry.sourceNote ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted">“{entry.sourceNote}”</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button
                    className="btn-ghost px-2 py-1 text-sm"
                    aria-label={t('routine.moveUp')}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={t('routine.drag')}
                    className="cursor-grab touch-none p-1 text-muted"
                    onPointerDown={startDrag(index)}
                    onPointerMove={dragOver}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <DragIcon size={20} />
                  </span>
                  <button
                    className="btn-ghost px-2 py-1 text-sm"
                    aria-label={t('routine.moveDown')}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn-secondary px-3 py-2 text-sm"
                  onClick={() => setEditing(editing === index ? null : index)}
                >
                  {t('routine.settings')}
                </button>
                <button
                  className="btn-ghost px-3 py-2 text-sm text-safety"
                  onClick={() =>
                    setExercises((current) => current.filter((_, position) => position !== index))
                  }
                >
                  {t('routine.remove')}
                </button>
              </div>

              {editing === index ? (
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
                  <NumberField
                    label={t('routine.sets')}
                    value={entry.sets}
                    onChange={(value) => update(index, { sets: value })}
                  />
                  {exercise?.mode === 'hold' ? (
                    <NumberField
                      label={t('routine.hold')}
                      value={entry.holdSeconds ?? 30}
                      onChange={(value) => update(index, { holdSeconds: value })}
                    />
                  ) : (
                    <NumberField
                      label={t('routine.reps')}
                      value={entry.reps ?? 10}
                      onChange={(value) => update(index, { reps: value })}
                    />
                  )}
                  <NumberField
                    label={t('routine.rest')}
                    value={entry.restSeconds}
                    onChange={(value) => update(index, { restSeconds: value })}
                  />
                  {band ? (
                    <>
                      <NumberField
                        label={`${t('routine.targetBand')} ·  min`}
                        value={band.min}
                        onChange={(value) => update(index, { band: { ...band, min: value } })}
                      />
                      <NumberField
                        label={`${t('routine.targetBand')} · max`}
                        value={band.max}
                        onChange={(value) => update(index, { band: { ...band, max: value } })}
                      />
                      <p className="col-span-2 text-sm text-muted">{t('routine.targetBandHelp')}</p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {exercises.length === 0 ? <p className="mt-4 text-muted">{t('routine.empty')}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => setPicking(true)}>
          {t('routine.addExercise')}
        </button>
        <button className="btn-primary" onClick={() => void persist()}>
          {t('common.save')}
        </button>
        {id !== undefined ? (
          <>
            <button
              className="btn-secondary"
              onClick={async () => {
                const copy = await duplicateRoutine(id);
                if (copy) navigate(`/routines/${copy}`);
              }}
            >
              {t('routine.duplicate')}
            </button>
            <button
              className="btn-ghost text-safety"
              onClick={async () => {
                if (!confirm(t('routine.deleteConfirm'))) return;
                await deleteRoutine(id);
                navigate('/');
              }}
            >
              {t('common.delete')}
            </button>
          </>
        ) : null}
      </div>

      {picking ? (
        <div className="fixed inset-0 z-20 overflow-y-auto bg-canvas p-4">
          <ScreenHeader
            title={t('routine.addExercise')}
            action={
              <button className="btn-ghost" onClick={() => setPicking(false)}>
                {t('common.close')}
              </button>
            }
          />
          <ul className="space-y-2 pb-10">
            {EXERCISES.map((exercise) => (
              <li key={exercise.id}>
                <button
                  className="card flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => addExercise(exercise.id)}
                >
                  <ExerciseDemo
                    reference={exercise.reference}
                    className="h-14 w-14 text-ink"
                    still
                  />
                  <span>
                    <span className="block font-medium">{exercise.names[language]}</span>
                    <span className="block text-sm text-muted">{t(`area.${exercise.area}`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, onChange }: NumberFieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <input
        className="field"
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        // Zero is a set that starts and ends in the same instant, or an
        // exercise that never appears at all — a session that says nothing and
        // records nothing. It has to be reachable while typing, because 30 is
        // 3 then 0; it just cannot be where somebody is left.
        onBlur={() => {
          if (!Number.isFinite(value) || value < 1) onChange(1);
        }}
      />
    </label>
  );
}
