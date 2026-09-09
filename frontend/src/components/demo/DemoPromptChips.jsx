/**
 * Suggested investigation prompts as horizontal wrap chips.
 */
export default function DemoPromptChips({ prompts, onSelectPrompt, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onSelectPrompt(text)}
          className="demo-prompt-chip px-3 py-1.5 rounded-full text-xs font-medium border border-white/15 bg-white/[0.04] text-vg-text-muted hover:text-white hover:border-vg-accent/40 hover:bg-vg-accent/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
