/**
 * Sheet import.
 *
 * Photo in, routine out, with every mapping shown for review. The photo is
 * never stored and never leaves the device; only the text and the result are
 * kept, and only once the user saves.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXERCISES, getExercise } from '@kinetrace/exercises';
import { importSheet, type ImportResult, type ImportedItem } from '@kinetrace/import';
import { createTesseractOcr } from '../import/tesseractOcr.js';
import { createWebLlmStructurer } from '../import/webllmStructurer.js';
import { saveImport, saveRoutine } from '../db/repositories.js';
import type { RoutineExercise } from '../db/schema.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { ScreenHeader } from '../components/ScreenHeader.js';

type Stage = 'idle' | 'ocr' | 'structuring' | 'review' | 'error';

export function SheetImportScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const profileId = useSettingsStore((state) => state.activeProfileId);
  const [stage, setStage] = useState<Stage>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [items, setItems] = useState<ImportedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useLocalModel, setUseLocalModel] = useState(false);
  const [modelProgress, setModelProgress] = useState<string | null>(null);

  const run = async (file: File): Promise<void> => {
    setStage('ocr');
    setError(null);
    try {
      const structuring = createWebLlmStructurer({
        allowDownload: useLocalModel,
        onProgress: (_fraction, text) => setModelProgress(text),
      });
      const outcome = await importSheet(file, {
        ocr: createTesseractOcr(language),
        structuring,
        exercises: EXERCISES,
        onProgress: (currentStage) => setStage(currentStage === 'ocr' ? 'ocr' : 'structuring'),
      });
      setResult(outcome);
      setItems(outcome.items);
      setStage('review');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStage('error');
    }
  };

  const save = async (): Promise<void> => {
    if (profileId === undefined) return;
    const exercises: RoutineExercise[] = items.map((item) => {
      const exercise = item.exerciseId ? getExercise(item.exerciseId) : undefined;
      return {
        exerciseId: item.exerciseId ?? '',
        sets: item.sets ?? exercise?.defaults.sets ?? 3,
        reps: item.reps ?? exercise?.defaults.reps,
        holdSeconds: item.holdSeconds ?? exercise?.defaults.holdSeconds,
        restSeconds: exercise?.defaults.restSeconds ?? 45,
        customNote: item.exerciseId ? undefined : item.sourceText,
      };
    });
    const routineId = await saveRoutine({
      profileId,
      name: t('import.title'),
      exercises,
    });
    await saveImport({
      profileId,
      ocrText: result?.sourceText ?? '',
      items,
      routineId,
    });
    navigate(`/routines/${routineId}`);
  };

  return (
    <div className="space-y-5">
      <ScreenHeader title={t('import.title')} subtitle={t('import.intro')} back />

      {stage === 'idle' || stage === 'error' ? (
        <div className="card space-y-3 p-4">
          <label className="btn-primary w-full cursor-pointer">
            {t('import.takePhoto')}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void run(file);
              }}
            />
          </label>
          <label className="flex items-center justify-between gap-3 pt-2">
            <span>{t('import.modelsNeeded')}</span>
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={useLocalModel}
              onChange={(event) => setUseLocalModel(event.target.checked)}
            />
          </label>
          <p className="text-sm text-muted">{t('import.modelsHelp')}</p>
          {error ? <p className="text-sm text-safety">{error}</p> : null}
        </div>
      ) : null}

      {stage === 'ocr' || stage === 'structuring' ? (
        <div className="card p-6 text-center">
          <p className="text-lg">
            {stage === 'ocr' ? t('import.reading') : t('import.structuring')}
          </p>
          {modelProgress ? <p className="mt-2 text-sm text-muted">{modelProgress}</p> : null}
        </div>
      ) : null}

      {stage === 'review' ? (
        <>
          <div className="card p-4">
            <h2 className="font-medium">{t('import.review')}</h2>
            <p className="text-sm text-muted">{t('import.reviewHelp')}</p>
            {result?.warnings.map((warning) => (
              <p key={warning} className="mt-2 text-sm text-accent">
                {warning}
              </p>
            ))}
          </div>

          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={`${item.sourceText}-${index}`} className="card space-y-2 p-4">
                <p className="text-sm text-muted">“{item.sourceText}”</p>
                <div className="flex items-center gap-2">
                  <select
                    className="field"
                    value={item.exerciseId ?? ''}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((entry, position) =>
                          position === index
                            ? {
                                ...entry,
                                exerciseId: event.target.value || null,
                                confidence: event.target.value ? 1 : 0,
                                origin: event.target.value ? 'lexical' : 'unmatched',
                              }
                            : entry,
                        ),
                      )
                    }
                  >
                    <option value="">{t('import.unmatched')}</option>
                    {EXERCISES.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.names[language]}
                      </option>
                    ))}
                  </select>
                  <ConfidenceBadge confidence={item.confidence} />
                </div>
                <p className="text-sm text-muted">
                  {item.sets ? `${item.sets} × ` : ''}
                  {item.holdSeconds ? `${item.holdSeconds} s` : (item.reps ?? '')}
                </p>
              </li>
            ))}
          </ul>

          <button className="btn-primary w-full" onClick={() => void save()}>
            {t('import.saveRoutine')}
          </button>
        </>
      ) : null}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }): JSX.Element {
  const { t } = useTranslation();
  const level = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
  const classes = {
    high: 'bg-band-soft text-band',
    medium: 'bg-accent-soft text-accent',
    low: 'bg-safety-soft text-safety',
  } as const;
  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-sm ${classes[level]}`}>
      {t(`import.confidence.${level}`)}
    </span>
  );
}
