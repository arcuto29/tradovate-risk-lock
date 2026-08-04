/**
 * Sentinel Design Tokens
 * 
 * Single source of truth for all visual decisions.
 * Every page, card, button, and spacing value references these tokens.
 * 
 * Philosophy: Professional, calm, confidence-inspiring.
 * No arbitrary values. Everything is intentional.
 */

export const tokens = {
  // ─── PAGE LAYOUT ───────────────────────────────────────────────────────
  page: {
    maxWidth: 'max-w-2xl',        // ~672px — all pages use this
    paddingX: 'px-8',             // horizontal padding
    paddingY: 'py-8',             // vertical padding
    gap: 'space-y-6',             // between major sections
  },

  // ─── TYPOGRAPHY ────────────────────────────────────────────────────────
  text: {
    pageTitle: 'text-2xl font-black tracking-tight',
    sectionTitle: 'text-sm font-bold text-white/70',
    sectionSubtitle: 'text-[0.6rem] text-white/25 uppercase tracking-[2px]',
    body: 'text-xs text-white/40 leading-relaxed',
    label: 'text-[0.65rem] font-semibold text-white/30 uppercase tracking-[1.5px]',
    value: 'text-sm font-bold font-mono',
    valueLarge: 'text-xl font-black font-mono',
    caption: 'text-[0.55rem] text-white/20',
    badge: 'text-[0.55rem] font-bold uppercase tracking-[1.5px]',
  },

  // ─── SPACING ───────────────────────────────────────────────────────────
  spacing: {
    sectionGap: 'mt-8',           // between major page sections
    cardGap: 'mt-5',              // between cards within a section
    innerGap: 'space-y-4',        // within card content
    tightGap: 'space-y-2',        // tight list items
    headerMargin: 'mb-6',         // below page headers
  },

  // ─── CARDS ─────────────────────────────────────────────────────────────
  card: {
    base: 'relative rounded-2xl overflow-hidden card-premium',
    padding: 'p-6',
    paddingCompact: 'p-5',
    paddingTight: 'p-4',
    hover: 'hover:border-white/[0.08] transition-all duration-200',
    border: 'border border-white/[0.06]',
    radius: 'rounded-2xl',        // 16px — consistent everywhere
  },

  // ─── BUTTONS ───────────────────────────────────────────────────────────
  button: {
    primary: 'py-3.5 text-xs font-bold uppercase tracking-[2.5px] rounded-xl press-scale transition-all duration-200',
    secondary: 'py-3 text-xs font-bold uppercase tracking-[2px] rounded-xl text-white/30 border border-white/[0.06] hover:text-white/50 hover:border-white/[0.1] transition-all duration-200',
    ghost: 'py-2.5 text-[0.6rem] text-white/20 hover:text-white/40 transition-all duration-200',
    height: 'h-12',               // consistent button height
    iconSize: 16,                 // icons inside buttons
  },

  // ─── INPUTS ────────────────────────────────────────────────────────────
  input: {
    base: 'bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-mono text-sm font-bold text-center focus:outline-none transition-all duration-200 input-premium',
    height: 'py-3',
    width: {
      sm: 'w-16',
      md: 'w-20',
      lg: 'w-24',
      xl: 'w-32',
    },
  },

  // ─── ICONS ─────────────────────────────────────────────────────────────
  icon: {
    pageHeader: 18,               // section header icons
    inline: 14,                   // inline with text
    nav: 12,                      // navigation icons
    card: 16,                     // inside cards
  },

  // ─── TRANSITIONS ───────────────────────────────────────────────────────
  motion: {
    fast: 'duration-150',
    normal: 'duration-200',
    slow: 'duration-300',
    ease: 'ease-out',
    spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },

  // ─── SHADOWS & GLOWS ──────────────────────────────────────────────────
  shadow: {
    card: 'shadow-none',          // cards use border glow, not shadows
    hover: 'shadow-lg',
    glow: (color: string) => `0 0 20px ${color}20`,
    glowStrong: (color: string) => `0 0 30px ${color}30`,
  },

  // ─── BORDERS ───────────────────────────────────────────────────────────
  border: {
    subtle: 'border-white/[0.04]',
    default: 'border-white/[0.06]',
    hover: 'border-white/[0.08]',
    active: 'border-white/[0.12]',
    divider: 'border-t border-white/[0.04]',
  },

  // ─── SEMANTIC COLORS ───────────────────────────────────────────────────
  semantic: {
    danger: '#ef4444',
    warning: '#fbbf24',
    info: '#3b82f6',
    success: '#10b981',
    muted: 'rgba(255,255,255,0.15)',
  },

  // ─── Z-INDEX ───────────────────────────────────────────────────────────
  z: {
    background: -1,
    content: 10,
    header: 20,
    overlay: 30,
    modal: 40,
    toast: 50,
  },
} as const;

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/** Consistent page header component classes */
export function pageHeader() {
  return `flex items-center gap-4 ${tokens.spacing.headerMargin} animate-reveal`;
}

/** Consistent section card wrapper */
export function sectionCard() {
  return `${tokens.card.base} ${tokens.card.padding}`;
}

/** Consistent input field */
export function inputField(size: 'sm' | 'md' | 'lg' | 'xl' = 'md') {
  return `${tokens.input.width[size]} ${tokens.input.height} ${tokens.input.base}`;
}
