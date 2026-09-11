/** Family profiles: everyone on the shared tablet keeps their own history. */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Profile } from '../db/schema.js';
import { createProfile, deleteProfile, updateProfile } from '../db/repositories.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { LANGUAGES, LANGUAGE_NAMES } from '../i18n/index.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { ProfileChip } from '../components/ProfileChip.js';

const COLORS = ['#d9702f', '#34618f', '#2c7a58', '#8a5bab', '#b3352a', '#3f7f8f'];

interface DraftProfile {
  id?: number;
  name: string;
  color: string;
  language: Profile['language'];
  heightCm: string;
  physioNotes: string;
}

const EMPTY_DRAFT: DraftProfile = {
  name: '',
  color: COLORS[0] as string,
  language: 'es',
  heightCm: '',
  physioNotes: '',
};

export function ProfilesScreen(): JSX.Element {
  const { t } = useTranslation();
  const profiles = useLiveQuery(() => db.profiles.toArray(), [], []);
  const activeProfileId = useSettingsStore((state) => state.activeProfileId);
  const setActiveProfile = useSettingsStore((state) => state.setActiveProfile);
  const [draft, setDraft] = useState<DraftProfile | null>(null);

  // The first person to open the app lands straight in the form: an empty list
  // with a button is a needless extra tap.
  const empty = profiles.length === 0;
  useEffect(() => {
    if (empty) setDraft((current) => current ?? EMPTY_DRAFT);
  }, [empty]);

  const save = async (): Promise<void> => {
    if (!draft || !draft.name.trim()) return;
    const fields = {
      name: draft.name.trim(),
      color: draft.color,
      language: draft.language,
      heightCm: draft.heightCm ? Number(draft.heightCm) : undefined,
      physioNotes: draft.physioNotes,
    };
    if (draft.id === undefined) await createProfile(fields);
    else await updateProfile(draft.id, fields);
    setDraft(null);
  };

  return (
    <div>
      <ScreenHeader
        title={t('profiles.title')}
        back
        action={
          draft ? null : (
            <button className="btn-primary px-4 py-2" onClick={() => setDraft(EMPTY_DRAFT)}>
              {t('profiles.add')}
            </button>
          )
        }
      />

      {draft ? (
        <form
          className="card space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t('profiles.name')}</span>
            <input
              className="field"
              value={draft.name}
              autoFocus
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>

          <fieldset>
            <legend className="mb-1 text-sm text-muted">{t('profiles.color')}</legend>
            <div className="flex gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={draft.color === color}
                  onClick={() => setDraft({ ...draft, color })}
                  className={`h-10 w-10 rounded-full ${
                    draft.color === color ? 'ring-2 ring-ink ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t('profiles.language')}</span>
            <select
              className="field"
              value={draft.language}
              onChange={(event) =>
                setDraft({ ...draft, language: event.target.value as Profile['language'] })
              }
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {LANGUAGE_NAMES[language]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">
              {t('profiles.height')} · {t('common.optional')}
            </span>
            <input
              className="field"
              inputMode="numeric"
              value={draft.heightCm}
              onChange={(event) => setDraft({ ...draft, heightCm: event.target.value })}
            />
            <span className="mt-1 block text-sm text-muted">{t('profiles.heightHelp')}</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t('profiles.physioNotes')}</span>
            <textarea
              className="field min-h-24"
              value={draft.physioNotes}
              onChange={(event) => setDraft({ ...draft, physioNotes: event.target.value })}
            />
            <span className="mt-1 block text-sm text-muted">{t('profiles.physioNotesHelp')}</span>
          </label>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {t('common.save')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      <ul className="mt-4 space-y-3">
        {profiles.map((profile) => (
          <li key={profile.id} className="card flex items-center gap-3 p-4">
            <ProfileChip profile={profile} />
            <div className="flex-1">
              <p className="font-medium">{profile.name}</p>
              {profile.physioNotes ? (
                <p className="line-clamp-2 text-sm text-muted">{profile.physioNotes}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {activeProfileId === profile.id ? (
                <span className="chip">●</span>
              ) : (
                <button
                  className="btn-secondary px-3 py-2 text-sm"
                  onClick={() => void setActiveProfile(profile.id)}
                >
                  {t('common.continue')}
                </button>
              )}
              <button
                className="btn-ghost px-3 py-2 text-sm"
                onClick={() =>
                  setDraft({
                    id: profile.id,
                    name: profile.name,
                    color: profile.color,
                    language: profile.language,
                    heightCm: profile.heightCm ? String(profile.heightCm) : '',
                    physioNotes: profile.physioNotes,
                  })
                }
              >
                {t('common.edit')}
              </button>
              <button
                className="btn-ghost px-3 py-2 text-sm text-safety"
                onClick={() => {
                  if (confirm(t('profiles.deleteConfirm'))) void deleteProfile(profile.id);
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
