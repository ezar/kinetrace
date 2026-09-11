/** Normal mobile layout: content plus a bottom navigation bar. */

import type { JSX } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation.js';

const ITEMS = [
  { to: '/', key: 'nav.home', icon: '⌂' },
  { to: '/library', key: 'nav.library', icon: '☰' },
  { to: '/progress', key: 'nav.progress', icon: '◷' },
  { to: '/settings', key: 'nav.settings', icon: '⚙' },
];

export function Layout(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-full max-w-screen-sm flex-col">
      <main className="flex-1 px-4 pb-28 pt-6">
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 mx-auto flex max-w-screen-sm justify-around border-t
          border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label={t('nav.home')}
      >
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                isActive ? 'text-ink' : 'text-muted'
              }`
            }
          >
            <span aria-hidden="true" className="text-lg">
              {item.icon}
            </span>
            {t(item.key)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
