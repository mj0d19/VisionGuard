/**
 * Scrollable event feed with severity-based accent colors.
 */
export default function DemoTimeline({
  heading,
  hint,
  events,
  isReady,
  visibleCount,
  skeletonLabel,
  animateSkeleton,
  activeEventId,
  onEventClick,
}) {
  const skeletonClass = animateSkeleton ? 'demo-skeleton-block' : 'demo-skeleton-block demo-skeleton-block--static';

  if (!isReady) {
    return (
      <div className="demo-timeline-card card flex flex-col min-h-0 flex-1 glass border-white/10 overflow-hidden">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-vg-text-muted p-4 pb-2 shrink-0">{heading}</h3>
        <div className="demo-timeline-scroll px-4 pb-4 flex-1 overflow-y-auto space-y-2">
          <div className={`h-14 rounded-lg ${skeletonClass}`} />
          <div className={`h-14 rounded-lg ${skeletonClass}`} />
          <div className={`h-14 rounded-lg ${skeletonClass}`} />
          <p className="text-xs text-vg-text-muted pt-2">{skeletonLabel}</p>
        </div>
      </div>
    );
  }

  const visibleEvents = events.slice(0, visibleCount);

  return (
    <div className="demo-timeline-card card flex flex-col min-h-0 flex-1 glass border-white/10 overflow-hidden">
      <div className="p-4 pb-2 shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-vg-text-muted">{heading}</h3>
        {hint ? <p className="text-xs text-vg-text-muted mt-1.5 leading-snug">{hint}</p> : null}
      </div>
      <div className="demo-timeline-scroll px-4 pb-4 flex-1 overflow-y-auto space-y-2">
        {visibleEvents.map((ev) => {
          const isActive = ev.id === activeEventId;
          const severityBase =
            ev.severity === 'critical'
              ? 'border-vg-critical bg-vg-critical/10 demo-timeline-row--critical'
              : ev.severity === 'warning'
                ? 'border-vg-warning bg-vg-warning/10'
                : 'border-vg-info bg-vg-info/10';
          return (
            <button
              key={ev.id}
              type="button"
              title={hint || undefined}
              onClick={() => onEventClick?.(ev)}
              className={`demo-timeline-row demo-event-reveal w-full text-left rounded-lg px-3 py-2.5 border-0 border-l-2 text-sm cursor-pointer transition-[box-shadow,border-color,border-left-width] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 appearance-none ${severityBase} ${
                isActive ? 'demo-timeline-row--active border-l-[3px]' : ''
              }`}
            >
              <div className="flex gap-2 items-baseline">
                <span className="font-mono text-xs text-vg-text-muted shrink-0 w-12">{ev.timeLabel}</span>
                <span
                  className={
                    ev.severity === 'critical'
                      ? 'text-red-200 demo-critical-text'
                      : ev.severity === 'warning'
                        ? 'text-amber-100'
                        : 'text-slate-200'
                  }
                >
                  {ev.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
