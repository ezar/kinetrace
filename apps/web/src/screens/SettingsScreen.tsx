/** Settings: language, voice, camera, models, and your data. */

import type { JSX } from 'react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { VOICE_COMMANDS } from '@kinetrace/engine';
import { VOICE_EXAMPLES } from '@kinetrace/exercises';
import { POSE_MODELS, type PoseModelVariant } from '../pose/models.js';
import { voiceCommandsSupported, whisperModel } from '../speech/listener.js';
import {
  deleteEverything,
  exportProfile,
  importProfile,
  type ProfileExport,
} from '../db/repositories.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '../i18n/index.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { Speaker } from '../speech/speech.js';

export function SettingsScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const settings = useSettingsStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceSupported = voiceCommandsSupported();
  const examples = VOICE_COMMANDS.map((command) => `«${VOICE_EXAMPLES[command][language]}»`).join(
    ', ',
  );

  const download = async (): Promise<void> => {
    if (settings.activeProfileId === undefined) return;
    const data = await exportProfile(settings.activeProfileId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kinetrace-${data.profile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File): Promise<void> => {
    const data = JSON.parse(await file.text()) as ProfileExport;
    await importProfile(data);
  };

  return (
    <div className="space-y-5">
      <ScreenHeader title={t('settings.title')} />

      <section className="card p-4">
        <h2 className="mb-2 font-medium">{t('settings.language')}</h2>
        <div className="flex gap-2">
          {LANGUAGES.map((option) => (
            <button
              key={option}
              className={`chip ${language === option ? 'border-ink bg-ink text-canvas' : ''}`}
              aria-pressed={language === option}
              onClick={() => void settings.setLanguage(option as Language)}
            >
              {LANGUAGE_NAMES[option]}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-medium">{t('settings.voice')}</h2>
        <Toggle
          label={t('settings.voiceOn')}
          checked={settings.speakCues}
          onChange={(value) => void settings.update({ speakCues: value })}
        />
        <Toggle
          label={t('settings.sound')}
          checked={settings.earcons}
          onChange={(value) => void settings.update({ earcons: value })}
        />
        <button
          className="btn-secondary text-sm"
          onClick={() => new Speaker(language, true).say(t('app.tagline'))}
        >
          {t('settings.voiceTest')}
        </button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-medium">{t('settings.voiceCommands')}</h2>
        <Toggle
          label={t('settings.voiceCommandsOn')}
          checked={settings.voiceCommands && voiceSupported}
          disabled={!voiceSupported}
          onChange={(value) => void settings.update({ voiceCommands: value })}
        />
        <p className="text-sm text-muted">
          {voiceSupported
            ? t('settings.voiceCommandsHelp', { size: whisperModel(settings.voiceModel).sizeMb })
            : t('voice.unsupported')}
        </p>
        {settings.voiceCommands && voiceSupported ? (
          <>
            <p className="text-sm text-muted">{t('settings.voiceWords', { words: examples })}</p>
            <div className="space-y-2">
              {(['tiny', 'base'] as const).map((variant) => (
                <label key={variant} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="voiceModel"
                    checked={settings.voiceModel === variant}
                    onChange={() => void settings.update({ voiceModel: variant })}
                  />
                  <span>{t(`settings.voiceModel.${variant}`)}</span>
                  <span className="ml-auto text-sm text-muted">
                    {whisperModel(variant).sizeMb} MB
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-medium">{t('settings.preview')}</h2>
        <Toggle
          label={t('settings.preview')}
          checked={settings.showCameraPreview}
          onChange={(value) => void settings.update({ showCameraPreview: value })}
        />
        <p className="text-sm text-muted">{t('settings.previewHelp')}</p>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-medium">{t('settings.poseModel')}</h2>
        <div className="space-y-2">
          {(Object.keys(POSE_MODELS) as PoseModelVariant[]).map((variant) => (
            <label key={variant} className="flex items-center gap-3">
              <input
                type="radio"
                name="poseModel"
                checked={settings.poseModel === variant}
                onChange={() => void settings.update({ poseModel: variant })}
              />
              <span>{t(`settings.poseModel.${variant}`)}</span>
              <span className="ml-auto text-sm text-muted">{POSE_MODELS[variant].sizeMb} MB</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-medium">{t('settings.data')}</h2>
        <Toggle
          label={t('settings.keepTracks')}
          checked={settings.keepTracks}
          onChange={(value) => void settings.update({ keepTracks: value })}
        />
        <p className="text-sm text-muted">{t('settings.keepTracksHelp')}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary text-sm" onClick={() => void download()}>
            {t('settings.export')}
          </button>
          <button className="btn-secondary text-sm" onClick={() => fileRef.current?.click()}>
            {t('settings.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <button
            className="btn-ghost text-sm text-safety"
            onClick={() => {
              if (confirm(t('settings.deleteAllConfirm'))) void deleteEverything();
            }}
          >
            {t('settings.deleteAll')}
          </button>
        </div>
      </section>

      <nav className="card divide-y divide-line">
        <Link to="/profiles" className="block px-4 py-3">
          {t('profiles.title')}
        </Link>
        <Link to="/settings/privacy" className="block px-4 py-3">
          {t('settings.privacy')}
        </Link>
        <Link to="/settings/about" className="block px-4 py-3">
          {t('settings.about')}
        </Link>
      </nav>
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, checked, disabled, onChange }: ToggleProps): JSX.Element {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-6 w-6"
        checked={checked}
        disabled={disabled ?? false}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
