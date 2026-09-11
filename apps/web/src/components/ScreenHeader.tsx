import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation.js';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, back, action }: ScreenHeaderProps): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <header className="mb-5">
      {back ? (
        <button className="btn-ghost -ml-3 mb-1 px-3 py-1 text-sm" onClick={() => navigate(-1)}>
          ← {t('common.back')}
        </button>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}
