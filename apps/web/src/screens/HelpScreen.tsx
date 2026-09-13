/**
 * Help.
 *
 * Most of what somebody needs to know is already in the library and the engine:
 * where to put the camera, what the app will recognise, what it says when it
 * cannot see you. So most of this screen is generated from that data rather
 * than written out again beside it, which is the only way help stays true after
 * the twentieth exercise is added.
 *
 * The gestures are performed, not described, by the same figure the session
 * draws. The voice commands are the real vocabulary the matcher uses. The
 * camera advice is the exercises' own tips, grouped by the position they are
 * for. The troubleshooting is, word for word, what the setup assistant says
 * while it is blocking a session.
 */

import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import {
  CAMERA_TIPS,
  EXERCISES,
  SETUP_TIPS,
  VOICE_PHRASES,
  resolveText,
} from '@kinetrace/exercises';
import { VOICE_COMMANDS } from '@kinetrace/engine';
import { useTranslation } from '../i18n/useTranslation.js';
import { ScreenHeader } from '../components/ScreenHeader.js';
import { GestureCard } from '../components/GestureCard.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { voiceCommandsSupported } from '../speech/listener.js';
import { PlayIcon } from '../components/icons.js';

/**
 * Which camera tip serves which starting positions, straight from the library.
 *
 * The view belongs in the heading as much as the position does: standing
 * exercises are filmed both from the side and from the front, and without it
 * two rows read as the same thing said twice.
 */
function cameraAdvice(): Array<{ tipKey: string; positions: string[]; views: string[] }> {
  const byTip = new Map<string, { positions: Set<string>; views: Set<string> }>();
  for (const exercise of EXERCISES) {
    const entry = byTip.get(exercise.cameraTipKey) ?? {
      positions: new Set<string>(),
      views: new Set<string>(),
    };
    entry.positions.add(exercise.position);
    entry.views.add(exercise.view.orientation);
    byTip.set(exercise.cameraTipKey, entry);
  }
  return [...byTip.entries()]
    .filter(([tipKey]) => tipKey in CAMERA_TIPS)
    .map(([tipKey, entry]) => ({
      tipKey,
      positions: [...entry.positions],
      views: [...entry.views],
    }));
}

/** The numbers a session and the progress screen show, and what each one is. */
const GLOSSARY = ['reps', 'partials', 'rom', 'goodPct', 'band', 'safety'] as const;

export function HelpScreen(): JSX.Element {
  const { t, language } = useTranslation();
  const voiceOn = useSettingsStore((state) => state.voiceCommands);
  const voiceSupported = voiceCommandsSupported();

  return (
    <div className="space-y-5">
      <ScreenHeader title={t('help.title')} subtitle={t('help.subtitle')} />

      <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-medium">{t('help.intro')}</h2>
          <p className="text-sm text-muted">{t('help.introHelp')}</p>
        </div>
        <Link to="/welcome" className="btn-secondary px-4 py-2 text-sm">
          <PlayIcon size={18} />
          {t('help.introAction')}
        </Link>
      </section>

      <section className="card space-y-3 p-4">
        <div>
          <h2 className="font-medium">{t('help.mat')}</h2>
          <p className="text-sm leading-relaxed text-muted">{t('help.matHelp')}</p>
        </div>
        <div className="flex gap-2.5">
          <GestureCard motion="pauseToggle" arms="both" caption={t('welcome.mat.pause')} />
          <GestureCard motion="skip" arms="right" caption={t('welcome.mat.skip')} />
        </div>

        <h3 className="pt-1 font-medium">{t('help.voice')}</h3>
        {voiceSupported ? (
          <>
            <ul className="divide-y divide-line">
              {VOICE_COMMANDS.map((command) => (
                <li key={command} className="grid grid-cols-[6rem_1fr] gap-x-3 py-2 text-sm">
                  <span className="text-muted">{t(`help.voice.${command}`)}</span>
                  <span>
                    {VOICE_PHRASES[command][language].map((phrase) => `«${phrase}»`).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              {voiceOn ? t('help.voiceOn') : t('help.voiceOff')}{' '}
              <Link to="/settings" className="underline underline-offset-4">
                {t('settings.title')}
              </Link>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">{t('voice.unsupported')}</p>
        )}
      </section>

      {/* The two things the app does that are not the camera, and the one
          thing it is important nobody misreads: a guided set is a
          prescription carried out, not a measurement taken. */}
      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t('help.demo')}</h2>
        <p className="text-sm leading-relaxed text-muted">{t('help.demoHelp')}</p>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t('help.guided')}</h2>
        <p className="text-sm leading-relaxed text-muted">{t('help.guidedHelp')}</p>
        <p className="text-sm leading-relaxed text-muted">{t('help.guidedMeasures')}</p>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t('help.camera')}</h2>
        <p className="text-sm leading-relaxed text-muted">{t('help.cameraHelp')}</p>
        <ul className="mt-1 divide-y divide-line">
          {cameraAdvice().map(({ tipKey, positions, views }) => (
            <li key={tipKey} className="py-2">
              <p className="text-sm font-medium">
                {[
                  positions.map((position) => t(`position.${position}`)).join(', '),
                  views.map((view) => t(`view.${view}`)).join(', '),
                ].join(' · ')}
              </p>
              <p className="text-sm text-muted">{resolveText(tipKey, language)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t('help.numbers')}</h2>
        <dl className="divide-y divide-line">
          {GLOSSARY.map((term) => (
            <div key={term} className="py-2">
              <dt className="text-sm font-medium">{t(`help.term.${term}`)}</dt>
              <dd className="text-sm leading-relaxed text-muted">{t(`help.term.${term}.body`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t('help.lost')}</h2>
        <p className="text-sm leading-relaxed text-muted">{t('help.lostHelp')}</p>
        <ul className="mt-1 space-y-1.5">
          {Object.keys(SETUP_TIPS).map((key) => (
            <li key={key} className="flex gap-2 text-sm">
              <span aria-hidden="true" className="text-accent">
                ·
              </span>
              {resolveText(key, language)}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted">{t('help.lostModel')}</p>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t('install.title')}</h2>
        <p className="text-sm leading-relaxed text-muted">{t('install.body')}</p>
        <p className="text-sm leading-relaxed text-muted">{t('install.how')}</p>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t('help.data')}</h2>
        <p className="text-sm leading-relaxed text-muted">{t('help.dataHelp')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link to="/settings/privacy" className="btn-secondary px-4 py-2 text-sm">
            {t('settings.privacy')}
          </Link>
          <Link to="/settings/about" className="btn-ghost px-4 py-2 text-sm">
            {t('settings.about')}
          </Link>
        </div>
      </section>

      <p className="pb-2 text-xs leading-relaxed text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}
