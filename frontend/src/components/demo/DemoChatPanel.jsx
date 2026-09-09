import DemoPromptChips from './DemoPromptChips';

/**
 * Large investigation-style chat: transcript, suggested prompts, input + send.
 */
export default function DemoChatPanel({
  title,
  subtitle,
  messages,
  suggestedPrompts,
  inputValue,
  onInputChange,
  onSend,
  onSelectPrompt,
  placeholder,
  sendLabel,
  userLabel,
  assistantLabel,
  isEnabled,
  lockedMessage,
  skeletonLabel,
  animateSkeleton,
}) {
  const skeletonClass = animateSkeleton ? 'demo-skeleton-block' : 'demo-skeleton-block demo-skeleton-block--static';

  return (
    <section className="demo-chat-section card flex flex-col min-h-[420px] lg:min-h-[460px] glass border-white/10 overflow-hidden">
      <header className="shrink-0 px-5 py-4 border-b border-white/10 bg-black/20">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-sm text-vg-text-muted mt-1">{subtitle}</p>
      </header>

      <div className="demo-chat-messages flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {isEnabled
          ? messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'demo-chat-bubble-user text-white'
                      : 'demo-chat-bubble-assistant text-slate-200'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wider opacity-70 mb-1.5">
                    {msg.role === 'user' ? userLabel : assistantLabel}
                  </p>
                  <div className="whitespace-pre-wrap demo-chat-markdown">{msg.content}</div>
                </div>
              </div>
            ))
          : (
            <div className="space-y-3">
              <div className={`h-16 rounded-2xl ${skeletonClass}`} />
              <div className={`h-12 rounded-2xl w-[75%] ${skeletonClass}`} />
              <div className={`h-20 rounded-2xl w-[88%] ${skeletonClass}`} />
              <p className="text-sm text-vg-text-muted">{skeletonLabel}</p>
            </div>
          )}
      </div>

      <footer className="shrink-0 border-t border-white/10 p-4 bg-black/25 space-y-3">
        <DemoPromptChips prompts={suggestedPrompts} onSelectPrompt={onSelectPrompt} disabled={!isEnabled} />
        {!isEnabled && <p className="text-xs text-vg-text-muted">{lockedMessage}</p>}
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <input
            type="text"
            disabled={!isEnabled}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            className="demo-chat-input flex-1 rounded-xl border border-white/15 bg-slate-900/60 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!isEnabled}
            className="btn-primary px-8 py-3 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendLabel}
          </button>
        </form>
      </footer>
    </section>
  );
}
