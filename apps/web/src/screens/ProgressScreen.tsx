/** Progress: turning up, range of motion over weeks, and skeleton replay. */

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getExercise, metricLabel } from '@kinetrace/exercises';
import { db, type SetRecord } from '../db/schema.js';
import { streakFromDates } from '../db/repositories.js';
import { prescribedTarget } from '../session/target.js';
import { dailySeries, subjectKey, subjectsIn } from '../routines/progress.js';
import { formatBand } from '../routines/band.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { CalendarHeatmap } from '../components/CalendarHeatmap.js';
import { SkeletonReplay } from '../components/SkeletonReplay.js';

/** Enough recent notes to be useful without turning the screen into a diary. */
const NOTES_SHOWN = 8;

export function ProgressScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const profileId = useSettingsStore((state) => state.activeProfileId);
  const [subjectKeySelected, setSubjectKeySelected] = useState<string | null>(null);
  const [replaySetId, setReplaySetId] = useState<number | null>(null);
  const [compareSetId, setCompareSetId] = useState<number | null>(null);

  const routines = useLiveQuery(
    () => (profileId ? db.routines.where('profileId').equals(profileId).toArray() : []),
    [profileId],
    [],
  );
  const sessions = useLiveQuery(
    () => (profileId ? db.sessions.where('profileId').equals(profileId).toArray() : []),
    [profileId],
    [],
  );
  const [sets, setSets] = useState<SetRecord[]>([]);

  useEffect(() => {
    const ids = sessions.map((session) => session.id);
    if (ids.length === 0) {
      setSets([]);
      return;
    }
    void db.sets.where('sessionId').anyOf(ids).toArray().then(setSets);
  }, [sessions]);

  // One entry per exercise, or per limb of a unilateral one: plotting both
  // sides as a single line would report the better limb and hide the weaker.
  const subjects = useMemo(() => subjectsIn(sets), [sets]);
  const subject =
    subjects.find((candidate) => subjectKey(candidate) === subjectKeySelected) ?? subjects[0];
  const selected = subject?.exerciseId ?? null;
  const exercise = selected ? getExercise(selected) : undefined;

  const target = useMemo(
    () => (selected && exercise ? prescribedTarget(routines, selected, exercise) : null),
    [routines, selected, exercise],
  );

  const series = useMemo(
    () => (subject ? dailySeries(sets, subject, exercise?.targets.direction === 'decrease') : []),
    [sets, subject, exercise],
  );

  const completed = sessions.filter((session) => session.endedAt !== undefined);

  /**
   * What the person wrote about themselves after each session. Shown back, never
   * summarised: no average, no trend, no colour that grades it. It is their note,
   * and the app promises not to make anything of it.
   */
  const painSeries = useMemo(
    () =>
      completed
        .filter((session) => session.painScore !== undefined)
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((session) => ({
          day: new Date(session.startedAt).toISOString().slice(0, 10),
          pain: session.painScore,
        })),
    [completed],
  );
  const written = useMemo(
    () =>
      completed
        .filter((session) => (session.notes ?? '').trim().length > 0)
        .sort((a, b) => b.startedAt - a.startedAt),
    [completed],
  );
  // A guided set recorded no skeleton, so offering its date in the replay
  // picker leads to an empty player.
  const setsForReplay = sets.filter(
    (set) =>
      subject &&
      set.measured !== false &&
      set.exerciseId === subject.exerciseId &&
      set.side === subject.side,
  );

  return (
    <div className="space-y-6">
      <ScreenHeader
        title={t('progress.title')}
        action={
          <Link to="/report" className="btn-secondary px-4 py-2 text-sm">
            {t('report.open')}
          </Link>
        }
      />

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium">{t('progress.calendar')}</h2>
          <p className="text-sm text-muted">
            {t('progress.streak')}: {streakFromDates(completed.map((session) => session.startedAt))}
          </p>
        </div>
        <CalendarHeatmap dates={completed.map((session) => session.startedAt)} />
      </section>

      {painSeries.length > 0 || written.length > 0 ? (
        <section className="card p-4">
          <h2 className="font-medium">{t('progress.howYouFelt')}</h2>
          {painSeries.length > 0 ? (
            <div className="mt-3 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={painSeries} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#e3ded6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#6a6761" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="#6a6761" />
                  <Tooltip />
                  <Line type="monotone" dataKey="pain" stroke="#34618f" strokeWidth={2.5} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          <p className="mt-2 text-sm text-muted">{t('summary.painHelp')}</p>
          {written.length > 0 ? (
            <ul className="mt-3 divide-y divide-line">
              {written.slice(0, NOTES_SHOWN).map((session) => (
                <li key={session.id} className="flex gap-3 py-2">
                  <span className="w-20 shrink-0 text-sm text-muted">
                    {new Date(session.startedAt).toLocaleDateString(language, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed">{session.notes}</span>
                  {session.painScore !== undefined ? (
                    <span className="chip shrink-0 self-start text-xs">{session.painScore}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {subjects.length === 0 ? (
        <p className="text-muted">{t('progress.noData')}</p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t('progress.selectExercise')}</span>
            <select
              className="field"
              value={subject ? subjectKey(subject) : ''}
              onChange={(event) => {
                setSubjectKeySelected(event.target.value);
                setReplaySetId(null);
                setCompareSetId(null);
              }}
            >
              {subjects.map((candidate) => (
                <option key={subjectKey(candidate)} value={subjectKey(candidate)}>
                  {getExercise(candidate.exerciseId)?.names[language] ?? candidate.exerciseId}
                  {candidate.side ? ` · ${t(`side.${candidate.side}`)}` : ''}
                </option>
              ))}
            </select>
          </label>

          <section className="card p-4">
            <h2 className="font-medium">
              {t('progress.rom')}
              {exercise
                ? ` · ${metricLabel(exercise.metrics[exercise.primaryMetric]?.id ?? 'hipFlexion', language)}`
                : ''}
            </h2>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#e3ded6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#6a6761" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6a6761" />
                  <Tooltip />
                  {target ? (
                    <>
                      <ReferenceLine
                        y={target.band.min}
                        stroke="#2c7a58"
                        strokeDasharray="4 4"
                        label={{ value: t('progress.target'), fontSize: 11, fill: '#2c7a58' }}
                      />
                      <ReferenceLine y={target.band.max} stroke="#2c7a58" strokeDasharray="4 4" />
                    </>
                  ) : null}
                  <Line type="monotone" dataKey="rom" stroke="#d9702f" strokeWidth={2.5} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {target ? (
              <p className="mt-2 text-sm text-muted">
                {target.by
                  ? t('progress.targetReviewed', {
                      band: formatBand(target.band.min, target.band.max, t('common.to')),
                      name: target.by,
                    })
                  : target.prescribed
                    ? t('progress.targetRoutine', {
                        band: formatBand(target.band.min, target.band.max, t('common.to')),
                      })
                    : t('progress.targetDefault', {
                        band: formatBand(target.band.min, target.band.max, t('common.to')),
                      })}
              </p>
            ) : null}
          </section>

          <section className="card p-4">
            <h2 className="font-medium">{t('progress.goodRepPct')}</h2>
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#e3ded6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#6a6761" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#6a6761" />
                  <Tooltip />
                  <Line type="monotone" dataKey="good" stroke="#34618f" strokeWidth={2.5} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="font-medium">{t('progress.replay')}</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                className="field"
                value={replaySetId ?? ''}
                onChange={(event) => setReplaySetId(Number(event.target.value) || null)}
              >
                <option value="">—</option>
                {setsForReplay.map((set) => (
                  <option key={set.id} value={set.id}>
                    {new Date(set.startedAt).toLocaleDateString(language)}
                  </option>
                ))}
              </select>
              <select
                className="field"
                value={compareSetId ?? ''}
                onChange={(event) => setCompareSetId(Number(event.target.value) || null)}
              >
                <option value="">{t('progress.compareNone')}</option>
                {setsForReplay.map((set) => (
                  <option key={set.id} value={set.id}>
                    {new Date(set.startedAt).toLocaleDateString(language)}
                  </option>
                ))}
              </select>
            </div>
            {replaySetId ? (
              <SkeletonReplay setId={replaySetId} compareSetId={compareSetId} className="mt-3" />
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
