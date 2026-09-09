import { useFirstVideoFrameUrl } from '../../hooks/useFirstVideoFrameUrl';

/**
 * Single selectable scenario row with first-frame video thumbnail and severity badge.
 */
export default function DemoScenarioCard({ scenario, selected, severityLabel, onSelect }) {
  const { status, imageUrl } = useFirstVideoFrameUrl(scenario.rawVideoUrl);
  const showThumb = Boolean(imageUrl);

  return (
    <button
      type="button"
      onClick={() => onSelect(scenario.id)}
      className={`demo-scenario-card w-full text-start rounded-xl border transition-all duration-200 p-3 ${
        selected ? 'demo-scenario-card--selected' : 'demo-scenario-card--idle'
      }`}
    >
      <div className="flex gap-3">
        <div className="demo-scenario-thumb shrink-0 rounded-lg bg-slate-800/80 border border-white/10 overflow-hidden w-14 h-14 flex items-center justify-center">
          {showThumb ? (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
              width={56}
              height={56}
              loading="lazy"
              decoding="async"
            />
          ) : status === 'loading' && scenario.rawVideoUrl ? (
            <span
              className="block h-full w-full animate-pulse bg-slate-700/50"
              aria-hidden
            />
          ) : (
            <svg className="h-7 w-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-white font-medium text-sm leading-snug truncate">{scenario.title}</p>
            <span className={`demo-severity-badge demo-severity-badge--${scenario.severity} shrink-0`}>
              {severityLabel}
            </span>
          </div>
          <p className="text-vg-text-muted text-xs mt-1 line-clamp-2">{scenario.subtitle}</p>
        </div>
      </div>
    </button>
  );
}
