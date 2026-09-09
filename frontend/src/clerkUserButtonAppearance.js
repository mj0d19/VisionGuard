/**
 * UserButton popover — same palette as Sidebar nav (vg-sidebar, muted text, vg-accent).
 */
export const clerkUserButtonAppearance = {
  variables: {
    colorPrimary: '#3b82f6',
    colorBackground: '#1e293b',
    colorText: '#ffffff',
    colorTextSecondary: '#94a3b8',
    colorTextOnPrimaryBackground: '#ffffff',
    colorNeutral: '#64748b',
    borderRadius: '0.5rem',
  },
  elements: {
    userButtonAvatarBox: 'w-8 h-8 rounded-lg ring-2 ring-white/10',
    userButtonPopoverCard:
      'bg-[#1e293b] border border-[#334155] shadow-2xl shadow-black/50 rounded-xl overflow-hidden',
    userButtonPopoverMain: 'bg-transparent',
    userPreview:
      'px-3 py-3 border-b border-white/10 bg-[#111827]/60',
    userPreviewMainIdentifierText: 'text-white text-sm font-medium',
    userPreviewSecondaryIdentifier: 'text-[#94a3b8] text-xs',
    userButtonPopoverActions: 'p-1 gap-0.5',
    userButtonPopoverActionButton:
      'text-[#94a3b8] hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors duration-200 justify-start',
    userButtonPopoverActionButtonIcon: 'text-[#3b82f6]',
    userButtonPopoverActionButtonIconBox: 'text-[#3b82f6]',
    userButtonPopoverFooter: 'hidden',
  },
};
