/** Session summary: what happened, plus the user's own notes and pain check-in. */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExercise, resolveText } from '@kinetrace/exercises';
import { db, type SetRecord } from '../db/schema.js';
import { finishSession } from '../db/repositories.js';
import { summariseExercise } from '../routines/summary.js';
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
        const summary = summariseExercise(exerciseSets, exercise);
        const nothingMeasured = !summary.measured;

        return (
          <section key={exerciseId} className="card mb-3 p-4">
            <h2 className="font-medium">{exercise?.names[language] ?? exerciseId}</h2>
            {nothingMeasured ? <p className="text-sm text-muted">{t('summary.guided')}</p> : null}
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              {exercise?.mode === 'hold' ? (
                <Stat
                  label={nothingMeasured ? t('summary.heldGuided') : t('summary.held')}
                  value={`${Math.round(summary.heldMs / 1000)} s`}
                />
              ) : nothingMeasured ? (
                // The count is the prescription, not an observation: label it
                // as what was asked for, and leave out the partial count, which
                // is zero only because nothing was watching.
                <>
                  <Stat label={t('summary.sets')} value={String(summary.sets)} />
                  <Stat label={t('summary.repsGuided')} value={`${summary.reps}`} />
                </>
              ) : (
                <>
                  <Stat
                    label={t('summary.goodReps')}
                    value={
                      summary.goodPct === null
                        ? `${summary.reps}`
                        : `${summary.reps} (${summary.goodPct}%)`
                    }
                  />
                  <Stat label={t('summary.partials')} value={String(summary.partials)} />
                </>
              )}
              {summary.romBest !== undefined ? (
                <Stat label={t('summary.romBest')} value={`${Math.round(summary.romBest)}°`} />
              ) : null}
              {summary.romMean !== undefined && summary.romMean > 0 ? (
                <Stat label={t('summary.romMean')} value={`${Math.round(summary.romMean)}°`} />
              ) : null}
            </dl>

            {/* "No corrections. Well done." is a verdict on how it was done, and
                without a camera there is nothing to base one on. Silence would
                read as the same praise, so it says plainly that it did not
                look. */}
            {nothingMeasured ? (
              <p className="mt-3 text-sm text-muted">{t('summary.guidedNoForm')}</p>
            ) : (
              <>
                <h3 className="mt-3 text-sm text-muted">{t('summary.issues')}</h3>
                {summary.topIssues.length === 0 ? (
                  <p className="text-sm">{t('summary.noIssues')}</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {summary.topIssues.map(([ruleId, count]) => {
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
              </>
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
