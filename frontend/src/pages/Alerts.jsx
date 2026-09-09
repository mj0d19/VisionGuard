import { useEffect, useRef, useState } from 'react';
import { useAuthedApi } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

const severityStyle = {
  critical: {
    bg: 'bg-vg-critical/10',
    border: 'border-vg-critical/30',
    badge: 'bg-vg-critical text-white',
    icon: '🚨',
  },
  warning: {
    bg: 'bg-vg-warning/10',
    border: 'border-vg-warning/30',
    badge: 'bg-vg-warning text-black',
    icon: '⚠️',
  },
  info: {
    bg: 'bg-vg-info/10',
    border: 'border-vg-info/30',
    badge: 'bg-vg-info text-white',
    icon: 'ℹ️',
  },
};

function normalizeSeverity(severity) {
  const s = (severity || '').toLowerCase();
  if (s === 'critical' || s === 'high') return 'critical';
  if (s === 'warning' || s === 'medium') return 'warning';
  return 'info';
}

function mapActionAlert(apiAlert, run, t) {
  const startedMs = run?.started_at ? new Date(run.started_at).getTime() : Date.now();
  const ms = startedMs + (apiAlert.timestamp_s ?? 0) * 1000;
  const score = apiAlert.action_score ?? 0;
  const confidence = score <= 1 ? Math.round(score * 100) : Math.min(100, Math.round(score));

  return {
    id: `api-${apiAlert.id}`,
    type: normalizeSeverity(apiAlert.severity),
    title: apiAlert.rule_name || t('alerts.defaultTitle'),
    description: apiAlert.message,
    camera:
      run?.run_name?.trim() ||
      t('alerts.runPrefix', { id: String(apiAlert.run_id).slice(0, 8) }),
    timestamp: new Date(ms).toISOString(),
    confidence,
  };
}

function DismissIconButton({ onDismiss, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDismiss?.();
      }}
      className="absolute top-3 end-3 p-1.5 rounded-lg text-vg-text-muted hover:text-white hover:bg-white/10 transition-colors"
      aria-label={ariaLabel}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

export default function Alerts() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiFetch = useAuthedApi();
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const runs = await apiFetch('/runs?limit=1');
        if (cancelled) return;

        if (!runs.length) {
          setAlerts([]);
          return;
        }

        const run = runs[0];
        const raw = await apiFetch(`/runs/${run.id}/alerts?limit=500`);
        if (cancelled) return;

        const mapped = raw.map((a) => mapActionAlert(a, run, (k, p) => tRef.current(k, p)));
        mapped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setAlerts(mapped);
      } catch {
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const criticalCount = alerts.filter((a) => a.type === 'critical').length;
  const warningCount = alerts.filter((a) => a.type === 'warning').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('alerts.title')}</h1>
          <p className="text-vg-text-muted mt-1">{t('alerts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-full bg-vg-critical/20 text-vg-critical text-sm font-medium">
            {t('alerts.criticalBadge', { count: String(criticalCount) })}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-vg-warning/20 text-vg-warning text-sm font-medium">
            {t('alerts.warningsBadge', { count: String(warningCount) })}
          </span>
        </div>
      </div>

      {!loading && alerts.length === 0 && (
        <div className="card p-8 text-center text-vg-text-muted">{t('alerts.emptyState')}</div>
      )}

      <div className="flex gap-2 border-b border-white/10 pb-4 flex-wrap">
        <FilterButton active>{t('alerts.filterAll')}</FilterButton>
        <FilterButton>{t('alerts.filterCritical')}</FilterButton>
        <FilterButton>{t('alerts.filterWarnings')}</FilterButton>
        <FilterButton>{t('alerts.filterInfo')}</FilterButton>
      </div>

      <div className="space-y-3">
        {loading && <div className="text-vg-text-muted text-sm animate-pulse">{t('alerts.loading')}</div>}
        {!loading &&
          alerts.map((alert, index) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              style={{ animationDelay: `${index * 50}ms` }}
              onDismiss={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
            />
          ))}
      </div>

      <div className="text-center pt-4">
        <button type="button" className="btn-ghost text-sm px-6 py-2" disabled>
          {t('alerts.loadMore')}
        </button>
      </div>
    </div>
  );
}

function FilterButton({ children, active = false }) {
  return (
    <button
      type="button"
      className={`
        px-4 py-2 rounded-lg text-sm font-medium transition-all
        ${
          active
            ? 'bg-vg-accent/20 text-vg-accent border border-vg-accent/30'
            : 'text-vg-text-muted hover:bg-white/5 hover:text-white'
        }
      `}
    >
      {children}
    </button>
  );
}

function AlertCard({ alert, style, onDismiss }) {
  const { t } = useI18n();
  const config = severityStyle[alert.type];
  const severityLabel = t(`alerts.severity.${alert.type}`);
  const timestamp = new Date(alert.timestamp);

  return (
    <div
      className={`
        relative card p-4 pe-11 sm:pe-12 cursor-pointer animate-fade-in
        ${config.bg} ${config.border} border
        hover:border-opacity-60 transition-all duration-200
      `}
      style={style}
    >
      <DismissIconButton onDismiss={onDismiss} ariaLabel={t('alerts.dismissAlert')} />
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex gap-4 flex-1">
          <div className="text-2xl flex-shrink-0">{config.icon}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h3 className="text-white font-semibold truncate">{alert.title}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.badge}`}>{severityLabel}</span>
            </div>
            <p className="text-vg-text-muted text-sm mb-2 line-clamp-2">{alert.description}</p>
            <div className="flex items-center gap-4 text-xs text-vg-text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                {alert.camera}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {t('alerts.confidence', { n: String(alert.confidence) })}
              </span>
            </div>
          </div>
        </div>

        <div className="text-end flex-shrink-0">
          <p className="text-white text-sm font-medium">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-vg-text-muted text-xs">
            {timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
