import { useEffect, useState, useCallback } from 'react';
import { useAuthedApi } from '../lib/api';
import { getStudentsDemoMode, setStudentsDemoMode, subscribeStudentsDemoMode } from '../lib/studentsDemoMode';
import { useI18n } from '../i18n/useI18n';

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const [pref, setPref] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [studentsDemo, setStudentsDemo] = useState(() => getStudentsDemoMode());
  const apiFetch = useAuthedApi();

  useEffect(() => subscribeStudentsDemoMode(setStudentsDemo), []);

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/me/notifications');
      setPref(data);
    } catch {
      /* pref stays null; same neutral copy as a loaded-empty state */
    } finally {
      setLoading(false);
    }
  }, [apiFetch, t]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  async function handleToggle() {
    if (!pref || saving) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const updated = await apiFetch('/me/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ email_alerts_enabled: !pref.email_alerts_enabled }),
      });
      setPref(updated);
      setSuccessMsg(
        updated.email_alerts_enabled ? t('settings.successEnabled') : t('settings.successDisabled')
      );
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setError(t('settings.updateError'));
    } finally {
      setSaving(false);
    }
  }

  const langLabel = locale === 'ar' ? t('settings.langName.ar') : t('settings.langName.en');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
        <p className="text-vg-text-muted mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
      {/* Language */}
      <div className="card flex min-w-0 flex-col p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-vg-accent/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-vg-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('settings.languageTitle')}</h2>
            <p className="text-vg-text-muted text-sm">{t('settings.languageDesc')}</p>
          </div>
        </div>

        <p className="text-vg-text-muted text-sm">
          {t('settings.languageCurrent', { lang: langLabel })}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setLocale('ar')}
            className={`
              px-5 py-2.5 rounded-lg text-sm font-medium transition-all
              ${
                locale === 'ar'
                  ? 'bg-vg-accent text-white glow-blue-sm'
                  : 'bg-white/10 text-white hover:bg-white/15'
              }
            `}
          >
            {t('settings.switchToArabic')}
          </button>
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={`
              px-5 py-2.5 rounded-lg text-sm font-medium transition-all
              ${
                locale === 'en'
                  ? 'bg-vg-accent text-white glow-blue-sm'
                  : 'bg-white/10 text-white hover:bg-white/15'
              }
            `}
          >
            {t('settings.switchToEnglish')}
          </button>
        </div>
      </div>

      <div className="card flex min-w-0 flex-col p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-vg-accent/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-vg-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('settings.emailNotifTitle')}</h2>
            <p className="text-vg-text-muted text-sm">{t('settings.emailNotifDesc')}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-vg-critical/40 bg-vg-critical/10 px-4 py-3 text-sm text-vg-critical">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg border border-vg-success/40 bg-vg-success/10 px-4 py-3 text-sm text-vg-success">
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-4">
            <div className="w-5 h-5 border-2 border-vg-accent/30 border-t-vg-accent rounded-full animate-spin" />
            <span className="text-vg-text-muted text-sm">{t('settings.loadingPrefs')}</span>
          </div>
        ) : pref ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full ${pref.email_alerts_enabled ? 'bg-vg-success animate-pulse' : 'bg-white/20'}`}
                />
                <div>
                  <p className="text-white font-medium">
                    {pref.email_alerts_enabled ? t('settings.alertsEnabled') : t('settings.alertsDisabled')}
                  </p>
                  <p className="text-vg-text-muted text-sm mt-0.5">
                    {t('settings.sendingTo')} <span className="text-white/80">{pref.email}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                dir="ltr"
                role="switch"
                aria-checked={pref.email_alerts_enabled}
                disabled={saving}
                onClick={handleToggle}
                className={`
                  relative w-12 h-7 rounded-full transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-vg-accent/50 focus:ring-offset-2 focus:ring-offset-vg-dark
                  ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                  ${pref.email_alerts_enabled ? 'bg-vg-accent' : 'bg-white/20'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md
                    transition-transform duration-200
                    ${pref.email_alerts_enabled ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>

            <p className="text-vg-text-muted text-xs leading-relaxed">{t('settings.infoNote')}</p>
          </div>
        ) : (
          <p className="text-vg-text-muted text-sm leading-relaxed">{t('settings.emailNotifEmptyHint')}</p>
        )}
      </div>

      <div className="card flex min-w-0 flex-col p-6 space-y-6 lg:col-span-2">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-vg-accent/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-vg-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('settings.studentsVersionTitle')}</h2>
            <p className="text-vg-text-muted text-sm">{t('settings.studentsVersionDesc')}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.03] border border-white/5">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${studentsDemo ? 'bg-vg-success' : 'bg-white/20'}`}
            />
            <p className="text-white font-medium text-sm sm:text-base">
              {studentsDemo ? t('settings.studentsVersionOn') : t('settings.studentsVersionOff')}
            </p>
          </div>
          <button
            type="button"
            dir="ltr"
            role="switch"
            aria-checked={studentsDemo}
            onClick={() => setStudentsDemoMode(!studentsDemo)}
            className={`
              relative w-12 h-7 rounded-full transition-colors duration-200 shrink-0
              focus:outline-none focus:ring-2 focus:ring-vg-accent/50 focus:ring-offset-2 focus:ring-offset-vg-dark
              cursor-pointer
              ${studentsDemo ? 'bg-vg-accent' : 'bg-white/20'}
            `}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md
                transition-transform duration-200
                ${studentsDemo ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
