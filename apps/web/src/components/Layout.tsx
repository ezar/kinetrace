/** Normal mobile layout: content plus a bottom navigation bar. */

import type { JSX } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation.js';
import { ExercisesIcon, HomeIcon, ProgressIcon, SettingsIcon } from './icons.js';

const ITEMS = [
  { to: '/', key: 'nav.home', Icon: HomeIcon },
  { to: '/library', key: 'nav.library', Icon: ExercisesIcon },
  { to: '/progress', key: 'nav.progress', Icon: ProgressIcon },
  { to: '/settings', key: 'nav.settings', Icon: SettingsIcon },
] as const;

export function Layout(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-full max-w-screen-sm flex-col">
      <main className="flex-1 px-5 pb-28 pt-7">
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 mx-auto flex max-w-screen-sm justify-around border-t
          border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label={t('nav.home')}
      >
        {ITEMS.map(({ to, key, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 text-[11px] ${
                isActive ? 'font-semibold text-ink' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={23} active={isActive} />
                {t(key)}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
