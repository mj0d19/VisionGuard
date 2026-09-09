/**
 * Clerk appearance — dark blue slate palette aligned with auth UI (.auth-card, .auth-page).
 */
export const clerkAuthAppearance = {
  variables: {
    colorPrimary: '#2563eb',
    colorBackground: 'transparent',
    colorText: '#f1f5f9',
    colorTextOnPrimaryBackground: '#f8fafc',
    colorTextSecondary: '#64748b',
    colorInputBackground: '#0c1222',
    colorInputText: '#f1f5f9',
    colorNeutral: '#64748b',
    colorDanger: '#f87171',
    borderRadius: '0.625rem',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '0.875rem',
  },
  elements: {
    card: 'bg-transparent shadow-none',
    rootBox: 'w-full',
    cardBox: 'shadow-none bg-transparent',

    headerTitle: 'text-slate-100 text-xl font-semibold tracking-tight',
    headerSubtitle: 'text-slate-500 text-[0.9375rem]',

    socialButtonsBlockButton:
      'bg-[#121a2e] border border-[#1e3a5f]/70 text-slate-200 hover:bg-[#162038] hover:border-[#2563eb]/45 transition-all duration-200 rounded-[0.625rem]',
    socialButtonsBlockButtonText: 'text-slate-200 font-medium',
    socialButtonsBlockButtonArrow: 'text-slate-500',
    socialButtonsProviderIcon: 'brightness-0 invert opacity-90',

    dividerLine: 'bg-[#1e3a5f]/50',
    dividerText: 'text-slate-500 text-[0.65rem] uppercase tracking-[0.2em] font-medium',

    formFieldLabel: 'text-slate-500 text-sm font-medium',
    formFieldInput:
      'bg-[#0c1222] border border-[#1e3a5f]/60 text-slate-100 placeholder:text-slate-600 focus:border-[#2563eb]/70 focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 rounded-[0.625rem]',
    formFieldInputShowPasswordButton: 'text-slate-500 hover:text-slate-300',
    formFieldAction: 'text-[#3b82f6] hover:text-[#60a5fa] text-sm font-medium',
    formFieldErrorText: 'text-red-400 text-xs',
    formFieldSuccessText: 'text-emerald-400 text-xs',

    formButtonPrimary:
      'bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] hover:from-[#2563eb] hover:to-[#3b82f6] text-white font-semibold shadow-[0_4px_24px_-4px_rgba(37,99,235,0.45)] hover:shadow-[0_8px_32px_-4px_rgba(37,99,235,0.55)] transition-all duration-300 rounded-[0.625rem]',
    formButtonReset: 'text-[#3b82f6] hover:text-[#60a5fa] transition-colors duration-200',

    /* Footer — simple divider + text (same palette as labels / formFieldAction) */
    footer: 'mt-5 border-t border-[#1e3a5f]/45 pt-4 text-center bg-transparent shadow-none ring-0',
    footerAction: 'text-sm text-[#94a3b8]',
    footerActionText: 'text-[#94a3b8]',
    footerActionLink:
      'text-[#3b82f6] hover:text-[#60a5fa] font-medium transition-colors duration-200',

    identityPreviewText: 'text-slate-100',
    identityPreviewEditButton: 'text-[#3b82f6] hover:text-[#60a5fa]',

    alert: 'bg-[#121a2e] border border-red-500/25 text-slate-100 rounded-[0.625rem]',
    alertText: 'text-slate-200 text-sm',

    spinner: 'text-[#3b82f6]',

    otherMethodsBlockButton:
      'text-[#5b8def] border border-[#1e3a5f]/60 hover:bg-[#121a2e] rounded-[0.625rem] transition-all duration-200',
  },
};
