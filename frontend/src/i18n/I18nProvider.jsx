import { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nContext } from './context';
import { translations } from './translations';

const STORAGE_KEY = 'visionguard-locale';

function readInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')) {
    return 'ar';
  }
  return 'en';
}

function applyDocumentLocale(locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const initial = readInitialLocale();
    if (typeof document !== 'undefined') applyDocumentLocale(initial);
    return initial;
  });

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (next !== 'ar' && next !== 'en') return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyDocumentLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const t = useCallback(
    (key, params) => {
      const table = translations[locale] ?? translations.en;
      let str = table[key] ?? translations.en[key] ?? key;
      if (params && typeof str === 'string') {
        for (const [k, v] of Object.entries(params)) {
          str = str.split(`{{${k}}}`).join(String(v));
        }
      }
      return str;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      isRtl: locale === 'ar',
    }),
    [locale, setLocale, toggleLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
