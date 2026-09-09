/** Default asset: user completion graphic served from "public" */
const DEFAULT_COMPLETE_IMAGE_SRC = '/demo-analyze-complete.png';

/** Same outer box for steps + image (measured "p-6" content ≈ 344px tall on demo hero) */
const CARD_CONTENT_CLASS = 'p-6 w-full h-[344px] box-border flex flex-col';

/**
 * Full-area overlay: stepped status list while analyzing, then a brief completion image in the same card.
 */
export default function DemoAnalyzeOverlay({
  visible,
  activeStepIndex,
  stepLabels,
  showCompleteImage,
  completeImageSrc = DEFAULT_COMPLETE_IMAGE_SRC,
  completeImageAlt = '',
}) {
  if (!visible) return null;

  return (
    <div className="demo-analyze-overlay absolute inset-0 z-20 flex items-center justify-center p-4 rounded-xl">
      <div className="demo-analyze-card glass max-w-md w-full rounded-2xl border border-white/10 shadow-2xl overflow-hidden p-0">
        {showCompleteImage ? (
          // Slightly less padding than steps ("p-6") so the image draws larger, still inside the same box
          <div className="p-4 w-full h-[344px] box-border flex min-h-0">
            <img
              src={completeImageSrc}
              alt={completeImageAlt}
              className="h-full w-full min-h-0 min-w-0 object-contain object-center opacity-[0.85]"
              loading="eager"
              decoding="async"
            />
          </div>
        ) : (
          <div className={CARD_CONTENT_CLASS}>
            <div className="flex items-center gap-3 mb-6">
              <div className="demo-analyze-spinner w-10 h-10 rounded-full border-2 border-vg-accent/30 border-t-vg-accent" />
              <div>
                <p className="text-white font-semibold">VisionGuard</p>
                <p className="text-vg-text-muted text-sm">AI processing engine</p>
              </div>
            </div>
            <ul className="space-y-3 min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
              {stepLabels.map((label, index) => {
                const done = index < activeStepIndex;
                const active = index === activeStepIndex;
                return (
                  <li
                    key={`analyze-step-${index}`}
                    className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 transition-colors ${
                      active ? 'bg-vg-accent/15 text-vg-accent-light' : done ? 'text-vg-text-muted' : 'text-slate-600'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        done ? 'bg-vg-success' : active ? 'bg-vg-accent animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <span className={active ? 'font-medium' : ''}>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
