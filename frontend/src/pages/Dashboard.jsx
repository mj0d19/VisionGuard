/**
 * Live dashboard — real camera slots only (no bundled demo loops).
 * Camera rows persist in localStorage until a backend stream API exists.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n';

const STORAGE_KEY = 'visionguard.dashboard.cameras';

/** @typedef {{ id: string; name: string; location: string; streamUrl: string }} DashboardCamera */

function readStoredCameras() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row) =>
          row &&
          typeof row === 'object' &&
          typeof row.id === 'string' &&
          typeof row.name === 'string' &&
          row.name.trim().length > 0
      )
      .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        location: typeof row.location === 'string' ? row.location.trim() : '',
        streamUrl: typeof row.streamUrl === 'string' ? row.streamUrl.trim() : '',
      }));
  } catch {
    return [];
  }
}

export default function Dashboard() {
  const { t } = useI18n();
  // Browser-only: Vite has no SSR; lazy init reads persisted rows once per mount.
  const [cameras, setCameras] = useState(() => readStoredCameras());
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras));
    } catch {
      /* ignore quota / private mode */
    }
  }, [cameras]);

  const addCamera = useCallback((next) => {
    setCameras((prev) => [...prev, next]);
  }, []);

  const removeCamera = useCallback((id) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const screenCountLabel = useMemo(
    () => t('dashboard.monitoringScreens', { count: String(cameras.length) }),
    [cameras.length, t]
  );

  return (
    <div className="max-w-[1920px] mx-auto space-y-8">
      {/* Page header — title + badge + primary CTA */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm md:text-base text-vg-text-muted max-w-2xl leading-relaxed">
            {t('dashboard.subtitleReal')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm text-vg-text-muted"
            title={screenCountLabel}
          >
            <span className="h-2 w-2 rounded-full bg-slate-500" aria-hidden />
            <span className="text-slate-200">{screenCountLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-vg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(14,165,233,0.55)] transition hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80"
          >
            <IconPlus className="h-4 w-4" />
            {t('dashboard.addCamera')}
          </button>
        </div>
      </div>

      {/* Camera grid or empty state */}
      {cameras.length === 0 ? (
        <EmptyDashboard onAdd={() => setModalOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
          {cameras.map((camera) => (
            <CameraPanel key={camera.id} camera={camera} onRemove={() => removeCamera(camera.id)} />
          ))}
        </div>
      )}

      {/* Stats — zeroed until backend metrics exist */}
      <section aria-label={t('dashboard.statsSectionLabel')}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label={t('dashboard.activeCameras')}
            value="0"
            icon={<IconCamera className="h-6 w-6 text-vg-accent" />}
          />
          <StatCard
            label={t('dashboard.eventsToday')}
            value="0"
            icon={<IconBolt className="h-6 w-6 text-vg-accent" />}
          />
          <StatCard label={t('dashboard.alerts')} value="0" icon={<IconBell className="h-6 w-6 text-vg-accent" />} />
          <StatCard
            label={t('dashboard.recordings')}
            value={t('dashboard.recordingsPlaceholder')}
            icon={<IconDisk className="h-6 w-6 text-vg-accent" />}
          />
        </div>
      </section>

      {modalOpen && (
        <AddCameraModal
          onClose={() => setModalOpen(false)}
          onSave={(payload) => {
            addCamera(payload);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Empty grid — centered CTA */
function EmptyDashboard({ onAdd }) {
  const { t } = useI18n();
  return (
    <div className="card relative overflow-hidden px-6 py-16 md:py-20 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-md space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <IconCamera className="h-7 w-7 text-vg-accent-light" />
        </div>
        <h2 className="text-lg font-semibold text-white">{t('dashboard.emptyTitle')}</h2>
        <p className="text-sm text-vg-text-muted leading-relaxed">{t('dashboard.emptySubtitle')}</p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-vg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80"
        >
          <IconPlus className="h-4 w-4" />
          {t('dashboard.addCamera')}
        </button>
      </div>
    </div>
  );
}

/** Single camera tile — no video element until stream playback is wired */
function CameraPanel({ camera, onRemove }) {
  const { t } = useI18n();

  return (
    <article className="card group relative flex flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-video overflow-hidden bg-[#030712]">
        {/* Subtle grid + vignette */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.25) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" aria-hidden />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-slate-500">{t('dashboard.statusOffline')}</span>
          <p className="text-sm text-slate-400">{t('dashboard.noVideoSource')}</p>
        </div>

        <div className="absolute top-0 inset-x-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
          <div className="min-w-0 rounded-lg bg-black/45 px-2.5 py-1.5 backdrop-blur-md sm:px-3">
            <div className="truncate font-semibold text-sm text-white">{camera.name}</div>
            {camera.location ? (
              <div className="truncate text-xs text-vg-text-muted">— {camera.location}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 backdrop-blur-sm sm:inline">
              {t('dashboard.noSourceBadge')}
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-white/10 bg-black/50 p-2 text-slate-400 transition hover:border-red-500/40 hover:bg-red-950/40 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
              aria-label={t('dashboard.deleteCamera')}
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 z-10 flex justify-between p-3 text-xs text-slate-500 sm:p-4 sm:text-[13px]">
          <span>{new Date().toLocaleDateString()}</span>
          <span className="font-mono tabular-nums text-slate-400">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="card flex items-center gap-4 rounded-xl p-4 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-bold tabular-nums text-white sm:text-2xl">{value}</p>
        <p className="truncate text-xs text-vg-text-muted sm:text-sm">{label}</p>
      </div>
    </div>
  );
}

/** Modal — add display name, optional location & stream URL */
function AddCameraModal({ onClose, onSave }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [streamUrl, setStreamUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      id: crypto.randomUUID(),
      name: trimmed,
      location: location.trim(),
      streamUrl: streamUrl.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-camera-title"
        className="card w-full max-w-md rounded-2xl p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id="add-camera-title" className="text-lg font-semibold text-white">
            {t('dashboard.addCameraTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-vg-text-muted transition hover:bg-white/10 hover:text-white"
            aria-label={t('dashboard.cancel')}
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dash-cam-name" className="mb-1.5 block text-xs font-medium text-vg-text-muted">
              {t('dashboard.cameraNameLabel')}
            </label>
            <input
              id="dash-cam-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dashboard.cameraNamePlaceholder')}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
              autoComplete="off"
              required
            />
          </div>
          <div>
            <label htmlFor="dash-cam-loc" className="mb-1.5 block text-xs font-medium text-vg-text-muted">
              {t('dashboard.locationLabel')}
            </label>
            <input
              id="dash-cam-loc"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('dashboard.locationPlaceholder')}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="dash-cam-url" className="mb-1.5 block text-xs font-medium text-vg-text-muted">
              {t('dashboard.streamUrlLabel')}
            </label>
            <input
              id="dash-cam-url"
              type="url"
              inputMode="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder={t('dashboard.streamUrlPlaceholder')}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
              autoComplete="off"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{t('dashboard.streamUrlHint')}</p>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-vg-text-muted transition hover:bg-white/5 hover:text-white"
            >
              {t('dashboard.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-vg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              {t('dashboard.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IconPlus({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function IconTrash({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function IconClose({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconCamera({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconBolt({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function IconBell({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function IconDisk({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
      />
    </svg>
  );
}
