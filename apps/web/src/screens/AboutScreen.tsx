/** About: what Kinetrace is, and what it is not. */

import type { JSX } from 'react';
import { useTranslation } from '../i18n/useTranslation.js';
import { ScreenHeader } from '../components/ScreenHeader.js';

const SOURCE_URL = 'https://github.com/ezar/kinetrace';

export function AboutScreen(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <ScreenHeader title={t('about.title')} back />
      <div className="card space-y-3 p-4">
        <p className="leading-relaxed">{t('about.body')}</p>
        <p className="text-sm text-muted">{t('app.disclaimer')}</p>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="font-medium">{t('about.models')}</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>MediaPipe Pose Landmarker — Apache 2.0, Google</li>
          <li>Florence-2 base ft — MIT, Microsoft (sheet import, optional)</li>
          <li>Qwen2.5 Instruct — Apache 2.0, Alibaba (sheet import, optional)</li>
          <li>Whisper — MIT, OpenAI (voice commands, optional)</li>
        </ul>
      </section>

      <div className="mt-4 flex gap-2">
        <a className="btn-secondary" href={SOURCE_URL} target="_blank" rel="noreferrer">
          {t('about.source')}
        </a>
        <a
          className="btn-ghost"
          href={`${SOURCE_URL}/blob/main/LICENSE`}
          target="_blank"
          rel="noreferrer"
        >
          {t('about.license')}
        </a>
      </div>
    </div>
  );
}
