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
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { CalendarHeatmap } from '../components/CalendarHeatmap.js';
import { SkeletonReplay } from '../components/SkeletonReplay.js';

export function ProgressScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const profileId = useSettingsStore((state) => state.activeProfileId);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [replaySetId, setReplaySetId] = useState<number | null>(null);
  const [compareSetId, setCompareSetId] = useState<number | null>(null);

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

  const exerciseIds = useMemo(() => [...new Set(sets.map((set) => set.exerciseId))], [sets]);
  const selected = exerciseId ?? exerciseIds[0] ?? null;
  const exercise = selected ? getExercise(selected) : undefined;

  const series = useMemo(() => {
    if (!selected) return [];
    const byDay = new Map<string, { rom: number[]; reps: number; good: number[]; setId: number }>();
    for (const set of sets.filter((entry) => entry.exerciseId === selected)) {
      const day = new Date(set.startedAt).toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? { rom: [], reps: 0, good: [], setId: set.id };
      if (set.romMax > 0) bucket.rom.push(set.romMax);
      bucket.reps += set.reps;
      bucket.good.push(set.goodRepPct);
      byDay.set(day, bucket);
    }
    const decreasing = exercise?.targets.direction === 'decrease';
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, bucket]) => ({
        day,
        rom: bucket.rom.length
          ? Math.round(decreasing ? Math.min(...bucket.rom) : Math.max(...bucket.rom))
          : null,
        reps: bucket.reps,
        good: Math.round(
          bucket.good.reduce((total, value) => total + value, 0) / bucket.good.length,
        ),
        setId: bucket.setId,
      }));
  }, [sets, selected, exercise]);

  const completed = sessions.filter((session) => session.endedAt !== undefined);
  const setsForReplay = sets.filter((set) => set.exerciseId === selected);

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('progress.title')} />

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium">{t('progress.calendar')}</h2>
          <p className="text-sm text-muted">
            {t('progress.streak')}: {streakFromDates(completed.map((session) => session.startedAt))}
          </p>
        </div>
        <CalendarHeatmap dates={completed.map((session) => session.startedAt)} />
      </section>

      {exerciseIds.length === 0 ? (
        <p className="text-muted">{t('progress.noData')}</p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t('progress.selectExercise')}</span>
            <select
              className="field"
              value={selected ?? ''}
              onChange={(event) => {
                setExerciseId(event.target.value);
                setReplaySetId(null);
                setCompareSetId(null);
              }}
            >
              {exerciseIds.map((id) => (
                <option key={id} value={id}>
                  {getExercise(id)?.names[language] ?? id}
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
                  {exercise ? (
                    <>
                      <ReferenceLine
                        y={exercise.targets.band.min}
                        stroke="#2c7a58"
                        strokeDasharray="4 4"
                        label={{ value: t('progress.target'), fontSize: 11, fill: '#2c7a58' }}
                      />
                      <ReferenceLine
                        y={exercise.targets.band.max}
                        stroke="#2c7a58"
                        strokeDasharray="4 4"
                      />
                    </>
                  ) : null}
                  <Line type="monotone" dataKey="rom" stroke="#d9702f" strokeWidth={2.5} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
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
