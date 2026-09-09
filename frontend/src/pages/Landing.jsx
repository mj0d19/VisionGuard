import { Link } from 'react-router-dom';
import PageBackdrop from '../components/PageBackdrop';
import { useI18n } from '../i18n/useI18n';

/** Hero tagline with a light emphasis on key terms (order differs for RTL Arabic). */
function LandingDescription() {
  const { t, locale } = useI18n();
  // Ice-sky emphasis: stronger cyan than body, still mixed with white for softness
  const emphasis =
    'font-semibold text-[color:color-mix(in_srgb,var(--color-vg-accent-light)_45%,#ffffff_55%)]';

  if (locale === 'ar') {
    return (
      <>
        {t('landing.desc.beforeHighlights')}
        <span className={emphasis}>{t('landing.desc.securityIntelligence')}</span>{' '}
        <span className={emphasis}>{t('landing.desc.searchable')}</span>
        {' و'}
        <span className={emphasis}>{t('landing.desc.explainable')}</span>
        {t('landing.desc.afterHighlights')}
      </>
    );
  }

  return (
    <>
      {t('landing.desc.beforeHighlights')}
      <span className={emphasis}>{t('landing.desc.searchable')}</span>
      {t('landing.desc.betweenSE')}
      <span className={emphasis}>{t('landing.desc.explainable')}</span>
      {t('landing.desc.beforeSI')}
      <span className={emphasis}>{t('landing.desc.securityIntelligence')}</span>
      {t('landing.desc.afterHighlights')}
    </>
  );
}

export default function Landing() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative">
      <PageBackdrop />

      {/* Wider than prose so headline + glows fit; body text stays readable below */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-3 sm:px-6 text-center animate-fade-in">
        {/* No overflow scroll here — it clips box-shadow / text-shadow per CSS rules */}
        <div className="flex w-full flex-nowrap items-center justify-center gap-3 sm:gap-5 mb-8 py-4 px-4 sm:px-8">
          <div className="w-16 h-16 shrink-0 rounded-xl bg-vg-accent flex items-center justify-center animate-vg-landing-icon-pulse">
            <span className="text-white font-bold text-2xl">VG</span>
          </div>
          {/* Single line: prefix + accent share one size (no nested heading sizes) */}
          <h1 className="whitespace-nowrap text-4xl md:text-5xl font-bold text-white leading-tight">
            {t('landing.titlePrefix')}{' '}
            <span className="text-vg-accent animate-vg-landing-text-pulse">{t('landing.titleAccent')}</span>
          </h1>
        </div>

        <p className="text-lg md:text-xl text-vg-text-muted leading-relaxed mb-10 font-medium max-w-2xl mx-auto">
          <LandingDescription />
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Demo button wrapped with spinning gradient border */}
          <div className="demo-btn-wrapper">
            <Link to="/demo" className="btn-demo text-lg px-8 py-3 min-w-[220px] block text-center">
              {t('landing.ctaDashboard')}
            </Link>
          </div>
          <Link to="/sign-in" className="btn-primary text-lg px-8 py-3 min-w-[220px] text-center">
            {t('landing.ctaSignIn')}
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap items-stretch justify-center gap-3">
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            }
            title={t('landing.feature1Title')}
            description={t('landing.feature1Desc')}
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            }
            title={t('landing.feature2Title')}
            description={t('landing.feature2Desc')}
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            }
            title={t('landing.feature3Title')}
            description={t('landing.feature3Desc')}
          />
        </div>
      </div>

      <div className="absolute bottom-6 text-vg-text-muted text-sm">{t('common.version')}</div>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="card p-4 w-[220px] glass hover:glow-blue-sm transition-all duration-300">
      <div className="w-9 h-9 rounded-md bg-vg-accent/20 flex items-center justify-center text-vg-accent mb-3 mx-auto">
        {icon}
      </div>
      <h3 className="text-white text-sm font-semibold mb-1.5">{title}</h3>
      <p className="text-vg-text-muted text-xs leading-relaxed">{description}</p>
    </div>
  );
}
