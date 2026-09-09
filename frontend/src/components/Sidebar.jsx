import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import { APP_NAV_ITEMS } from '../nav/appNavItems';

const navIconDashboard = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
    />
  </svg>
);
const navIconAlerts = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);
const navIconQuery = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
    />
  </svg>
);
/** Presentation demo — investigation console */
const navIconDemo = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);
const navIconSettings = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const NAV_ICONS_BY_PATH = {
  '/dashboard': navIconDashboard,
  '/demo': navIconDemo,
  '/alerts': navIconAlerts,
  '/query': navIconQuery,
  '/settings': navIconSettings,
};

export default function Sidebar({ isOpen, onClose }) {
  const { t } = useI18n();

  const navItems = useMemo(
    () =>
      APP_NAV_ITEMS.map((item) => ({
        ...item,
        label: t(item.labelKey),
        icon: NAV_ICONS_BY_PATH[item.to],
      })),
    [t]
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        id="app-sidebar"
        aria-hidden={!isOpen}
        className={`
          fixed top-0 start-0 h-full w-64 z-50
          liquid-glass-panel
          transform transition-transform duration-300 ease-in-out
          ${
            isOpen
              ? 'translate-x-0'
              : 'ltr:-translate-x-full rtl:translate-x-full'
          }
        `}
      >
        <div className="p-6 border-b border-white/10">
          <NavLink to="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 rounded-lg bg-vg-accent flex items-center justify-center glow-blue-sm">
              <span className="text-white font-bold text-lg">VG</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm">VisionGuard</span>
              <span className="text-vg-text-muted text-xs">{t('nav.tagline')}</span>
            </div>
          </NavLink>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const base =
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200';

            // Same colors + spinning border as Landing "btn-demo" / "demo-btn-wrapper"
            if (item.to === '/demo') {
              return (
                <div key={item.to} className="demo-btn-wrapper w-full">
                  <NavLink
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      [
                        'btn-demo flex w-full items-center gap-3 px-4 py-3 rounded-full text-start',
                        isActive ? 'shadow-[0_0_14px_rgba(56,189,248,0.35)]' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `${base} ${
                    isActive
                      ? 'bg-vg-accent/20 text-vg-accent border-s-2 border-vg-accent glow-blue-sm'
                      : 'text-vg-text-muted hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-0 inset-x-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-vg-success animate-pulse" />
              <span className="text-vg-text-muted text-sm">{t('common.online')}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
