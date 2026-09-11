/** Privacy: the promise, in plain words, on its own screen. */

import type { JSX } from 'react';
import { useTranslation } from '../i18n/useTranslation.js';
import { ScreenHeader } from '../components/ScreenHeader.js';

export function PrivacyScreen(): JSX.Element {
  const { t } = useTranslation();
  const points = ['privacy.noVideo', 'privacy.noAccount', 'privacy.noAnalytics', 'privacy.offline'];
  return (
    <div>
      <ScreenHeader title={t('privacy.title')} back />
      <div className="card p-4">
        <p className="leading-relaxed">{t('privacy.body')}</p>
        <p className="mt-3 leading-relaxed text-muted">{t('privacy.voice')}</p>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {points.map((key) => (
          <li key={key} className="chip">
            ✓ {t(key)}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}
