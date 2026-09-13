/**
 * The page to take to the appointment.
 *
 * Twenty minutes with a physiotherapist and what there was to show was a phone
 * with charts somebody has to keep tapping. Every number here was already
 * stored; what was missing was a page — one that prints, because that is what
 * gets handed across a desk and written on.
 *
 * It reports and does not conclude. Ranges against the target that was actually
 * set, how often each correction fired, what the person wrote about themselves,
 * and who signed the routine. No averages of pain, no adherence score, no
 * traffic lights: the reader is the clinician.
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getExercise, metricLabel, resolveText } from '@kinetrace/exercises';
import { db, type Session, type SetRecord } from '../db/schema.js';
import { streakFromDates } from '../db/repositories.js';
import { reportRows } from '../routines/report.js';
import { formatBand } from '../routines/band.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { ReviewStamp } from '../components/ReviewStamp.js';

/** How far back the page looks. Long enough to show a trend, short enough to read. */
const WEEKS = 8;
const PERIOD_MS = WEEKS * 7 * 24 * 60 * 60 * 1000;

export function ReportScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const profileId = useSettingsStore((state) => state.activeProfileId);
  const profile = useLiveQuery(
    () => (profileId === undefined ? undefined : db.profiles.get(profileId)),
    [profileId],
  );
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

  const since = Date.now() - PERIOD_MS;
  const inPeriod = useMemo(
    () => sessions.filter((session) => session.startedAt >= since && session.endedAt !== undefined),
    [sessions, since],
  );

  useEffect(() => {
    const ids = inPeriod.map((session) => session.id);
    if (ids.length === 0) {
      setSets([]);
      return;
    }
    void db.sets.where('sessionId').anyOf(ids).toArray().then(setSets);
  }, [inPeriod]);

  const rows = useMemo(() => reportRows({ sets, routines, getExercise }), [sets, routines]);

  const felt = useMemo(
    () =>
      inPeriod
        .filter(
          (session) => session.painScore !== undefined || (session.notes ?? '').trim().length > 0,
        )
        .sort((a, b) => b.startedAt - a.startedAt),
    [inPeriod],
  );
  const reviewed = routines.find((routine) => routine.review)?.review;
  const day = (value: number): string =>
    new Date(value).toLocaleDateString(language, { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-5">
      <div data-print="hide">
        <ScreenHeader
          title={t('report.title')}
          subtitle={t('report.period', { weeks: WEEKS })}
          back
          action={
            <button className="btn-primary px-4 py-2" onClick={() => window.print()}>
              {t('report.print')}
            </button>
          }
        />
      </div>

      <section className="card p-4">
        <h1 className="text-[20px] font-bold tracking-tight">
          {t('report.heading', { name: profile?.name ?? '' })}
        </h1>
        <p className="text-sm text-muted">
          {t('report.period', { weeks: WEEKS })} ·{' '}
          {t('report.printedOn', { date: day(Date.now()) })}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <b>{inPeriod.length}</b> {t('report.sessions')}
          </span>
          <span>
            <b>{streakFromDates(inPeriod.map((session) => session.startedAt))}</b>{' '}
            {t('report.streak')}
          </span>
          <span>
            <b>{sets.length}</b> {t('report.sets')}
          </span>
        </div>
        <div className="mt-2">
          <ReviewStamp review={reviewed} />
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="text-muted">{t('report.empty')}</p>
      ) : (
        <section className="card overflow-x-auto p-4">
          <h2 className="font-medium">{t('report.byExercise')}</h2>
          {/* The measurement sits in the same cell as the target it is judged
              against: four columns fit a phone, and reading one against the
              other is the whole point of the column. */}
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 pr-3 font-medium">{t('report.exercise')}</th>
                <th className="py-2 pr-3 font-medium">{t('report.done')}</th>
                <th className="py-2 pr-3 font-medium">{t('report.range')}</th>
                <th className="py-2 font-medium">{t('report.good')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const exercise = getExercise(row.exerciseId);
                const metric = exercise?.metrics[exercise.primaryMetric];
                return (
                  <tr
                    key={`${row.exerciseId}-${row.side ?? 'both'}`}
                    className="border-b border-line align-top"
                  >
                    <td className="py-2 pr-3">
                      <span className="font-medium">
                        {exercise?.names[language] ?? row.exerciseId}
                        {/* The side belongs beside the name: two rows with the
                          same name and different numbers is a bug, not a
                          measurement, unless it says which limb each one is. */}
                        {row.side ? (
                          <span className="font-normal text-muted"> · {t(`side.${row.side}`)}</span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted">
                        {metricLabel(metric?.id ?? 'hipFlexion', language)}
                      </span>
                      {row.issues.length > 0 ? (
                        <span className="mt-1 block text-xs text-muted">
                          {row.issues
                            .map(
                              (issue) => `${resolveText(issue.ruleId, language)} ×${issue.count}`,
                            )
                            .join(' · ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      {/* Two facts, not a multiplication: `6 × 72` would read as
                        seventy-two repetitions in each of six sets. */}
                      {row.holdMinutes > 0
                        ? t('report.doneHold', { sets: row.sets, minutes: row.holdMinutes })
                        : t('report.doneReps', { sets: row.sets, reps: row.reps })}
                      {row.partials > 0 ? (
                        <span className="block text-xs text-muted">
                          {t('report.partials', { count: row.partials })}
                        </span>
                      ) : null}
                      {row.guidedSets > 0 ? (
                        <span className="block text-xs text-muted">
                          {t('report.guided', { count: row.guidedSets })}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      {/* `0° / 0°` on a row nobody measured reads as a
                          measurement of nothing rather than the absence of
                          one — the same mistake the hold column already made
                          once. */}
                      {row.isHold ? (
                        <span className="text-muted">{t('report.noRange')}</span>
                      ) : row.sets - row.guidedSets === 0 ? (
                        <span className="text-muted">{t('report.noneMeasured')}</span>
                      ) : (
                        <>
                          {row.best}° / {row.mean}°
                          <span className="block text-xs text-muted">{t('report.bestMean')}</span>
                        </>
                      )}
                      <span className="block text-xs text-muted">
                        {t('report.targetIs', {
                          band: formatBand(row.target.min, row.target.max, t('common.to')),
                        })}
                        {row.targetBy ? ` · ${row.targetBy}` : ''}
                      </span>
                    </td>
                    {/* A row with nothing measured has no percentage to give.
                        A dash says that; a zero would say the person failed
                        every repetition. */}
                    <td className="py-2">
                      {row.goodPct === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        `${row.goodPct}%`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {felt.length > 0 ? (
        <section className="card p-4">
          <h2 className="font-medium">{t('report.felt')}</h2>
          <p className="text-sm text-muted">{t('summary.painHelp')}</p>
          <ul className="mt-2 divide-y divide-line">
            {felt.map((session: Session) => (
              <li key={session.id} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="w-16 shrink-0 text-muted">{day(session.startedAt)}</span>
                {session.painScore !== undefined ? (
                  <span className="shrink-0 font-medium">
                    {t('review.painValue', { value: session.painScore })}
                  </span>
                ) : null}
                <span className="flex-1 leading-relaxed">{session.notes}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}
