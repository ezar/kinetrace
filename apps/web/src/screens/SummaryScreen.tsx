/** Session summary: what happened, plus the user's own notes and pain check-in. */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExercise, resolveText } from '@kinetrace/exercises';
import { db, type SetRecord } from '../db/schema.js';
import { finishSession } from '../db/repositories.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { useInstallOffer } from '../pwa/useInstallOffer.js';
import { ScreenHeader } from '../components/ScreenHeader.js';

export function SummaryScreen(): JSX.Element {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [notes, setNotes] = useState('');
  const [pain, setPain] = useState<number | undefined>();

  const id = sessionId ? Number(sessionId) : undefined;

  useEffect(() => {
    if (id === undefined) return;
    void db.sets.where('sessionId').equals(id).sortBy('index').then(setSets);
  }, [id]);

  const byExercise = new Map<string, SetRecord[]>();
  for (const set of sets) {
    byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), set]);
  }

  const save = async (): Promise<void> => {
    if (id !== undefined) await finishSession(id, { notes, painScore: pain });
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto max-w-screen-sm p-4 pb-16">
      <ScreenHeader title={t('summary.title')} />

      {[...byExercise.entries()].map(([exerciseId, exerciseSets]) => {
        const exercise = getExercise(exerciseId);
        const reps = exerciseSets.reduce((total, set) => total + set.reps, 0);
        const partials = exerciseSets.reduce((total, set) => total + set.partials, 0);
        const heldMs = exerciseSets.reduce((total, set) => total + set.holdMs, 0);
        const romValues = exerciseSets.map((set) => set.romMax).filter((value) => value > 0);
        const decreasing = exercise?.targets.direction === 'decrease';
        const best = romValues.length
          ? decreasing
            ? Math.min(...romValues)
            : Math.max(...romValues)
          : undefined;
        const mean = exerciseSets.length
          ? exerciseSets.reduce((total, set) => total + set.romMean, 0) / exerciseSets.length
          : 0;
        const goodPct = reps + partials > 0 ? Math.round((reps / (reps + partials)) * 100) : 100;

        const issues = new Map<string, number>();
        for (const set of exerciseSets) {
          for (const [ruleId, count] of Object.entries(set.issues)) {
            issues.set(ruleId, (issues.get(ruleId) ?? 0) + count);
          }
        }
        const topIssues = [...issues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

        return (
          <section key={exerciseId} className="card mb-3 p-4">
            <h2 className="font-medium">{exercise?.names[language] ?? exerciseId}</h2>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              {exercise?.mode === 'hold' ? (
                <Stat label={t('summary.held')} value={`${Math.round(heldMs / 1000)} s`} />
              ) : (
                <>
                  <Stat label={t('summary.goodReps')} value={`${reps} (${goodPct}%)`} />
                  <Stat label={t('summary.partials')} value={String(partials)} />
                </>
              )}
              {best !== undefined ? (
                <Stat label={t('summary.romBest')} value={`${Math.round(best)}°`} />
              ) : null}
              {mean > 0 ? (
                <Stat label={t('summary.romMean')} value={`${Math.round(mean)}°`} />
              ) : null}
            </dl>

            <h3 className="mt-3 text-sm text-muted">{t('summary.issues')}</h3>
            {topIssues.length === 0 ? (
              <p className="text-sm">{t('summary.noIssues')}</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {topIssues.map(([ruleId, count]) => {
                  const rule = exercise?.rules.find((entry) => entry.id === ruleId);
                  const label = rule ? resolveText(rule.cueKey, language) : ruleId;
                  return (
                    <li key={ruleId} className="flex justify-between">
                      <span>{label}</span>
                      <span className="text-muted">×{count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <section className="card space-y-4 p-4">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t('summary.notes')}</span>
          <textarea
            className="field min-h-24"
            placeholder={t('summary.notesPlaceholder')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <fieldset>
          <legend className="mb-1 text-sm text-muted">{t('summary.pain')}</legend>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 11 }, (_, value) => (
              <button
                key={value}
                type="button"
                aria-pressed={pain === value}
                onClick={() => setPain(pain === value ? undefined : value)}
                className={`h-11 w-11 rounded-full border border-line ${
                  pain === value ? 'bg-ink text-canvas' : 'bg-surface'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">{t('summary.painHelp')}</p>
        </fieldset>

        <button className="btn-primary w-full" onClick={() => void save()}>
          {t('summary.save')}
        </button>
      </section>

      <InstallOfferCard />
    </div>
  );
}

/**
 * Asked here and nowhere else: a session has just been finished, so the person
 * knows whether this is worth an icon on their home screen. Asked once.
 */
function InstallOfferCard(): JSX.Element | null {
  const { t } = useTranslation();
  const { offer, install, dismiss } = useInstallOffer();
  if (!offer) return null;

  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-medium">{t('install.title')}</h2>
      <p className="text-sm leading-relaxed text-muted">{t('install.body')}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn-primary" onClick={() => void install()}>
          {t('install.action')}
        </button>
        <button className="btn-ghost" onClick={dismiss}>
          {t('install.no')}
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-lg font-medium">{value}</dd>
    </div>
  );
}
