import { Theme } from './ThemeContext';

export function getThemeColors(theme: Theme) {
  switch (theme) {
    case 'nebula':
      return {
        primary: '#22d3ee',
        secondary: '#a78bfa',
        accent: 'cyan',
        accentHover: 'cyan-300',
        gradient: 'from-cyan-400 to-purple-400',
        gradientBg: 'from-cyan-500/20 to-purple-500/10',
        border: 'border-cyan-400/20',
        borderHover: 'border-cyan-400/40',
        text: 'text-cyan-400',
        textSoft: 'text-cyan-400/60',
        bg: 'bg-cyan-400/10',
        glow: 'shadow-[0_0_15px_rgba(56,189,248,0.15)]',
        dot: 'bg-cyan-400',
        dotGlow: 'shadow-[0_0_6px_rgba(56,189,248,0.6)]',
        ring: '#22d3ee',
      };
    case 'aurora':
      return {
        primary: '#10b981',
        secondary: '#06b6d4',
        accent: 'emerald',
        accentHover: 'emerald-300',
        gradient: 'from-emerald-400 to-teal-400',
        gradientBg: 'from-emerald-500/20 to-teal-500/10',
        border: 'border-emerald-400/20',
        borderHover: 'border-emerald-400/40',
        text: 'text-emerald-400',
        textSoft: 'text-emerald-400/60',
        bg: 'bg-emerald-400/10',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
        dot: 'bg-emerald-400',
        dotGlow: 'shadow-[0_0_6px_rgba(16,185,129,0.6)]',
        ring: '#10b981',
      };
    case 'sakura':
      return {
        primary: '#ec4899',
        secondary: '#f43f5e',
        accent: 'pink',
        accentHover: 'pink-300',
        gradient: 'from-pink-400 to-rose-400',
        gradientBg: 'from-pink-500/20 to-rose-500/10',
        border: 'border-pink-400/20',
        borderHover: 'border-pink-400/40',
        text: 'text-pink-500',
        textSoft: 'text-pink-400/60',
        bg: 'bg-pink-400/10',
        glow: 'shadow-[0_0_15px_rgba(236,72,153,0.15)]',
        dot: 'bg-pink-400',
        dotGlow: 'shadow-[0_0_6px_rgba(236,72,153,0.6)]',
        ring: '#ec4899',
      };
    case 'sunset':
      return {
        primary: '#d97706',
        secondary: '#ea580c',
        accent: 'amber',
        accentHover: 'amber-300',
        gradient: 'from-amber-400 to-orange-400',
        gradientBg: 'from-amber-500/20 to-orange-500/10',
        border: 'border-amber-400/20',
        borderHover: 'border-amber-400/40',
        text: 'text-amber-500',
        textSoft: 'text-amber-400/60',
        bg: 'bg-amber-400/10',
        glow: 'shadow-[0_0_15px_rgba(217,119,6,0.15)]',
        dot: 'bg-amber-400',
        dotGlow: 'shadow-[0_0_6px_rgba(217,119,6,0.6)]',
        ring: '#d97706',
      };
    case 'midnight':
      return {
        primary: '#ef4444',
        secondary: '#3b82f6',
        accent: 'red',
        accentHover: 'red-300',
        gradient: 'from-red-500 to-blue-500',
        gradientBg: 'from-red-500/10 to-blue-500/10',
        border: 'border-white/12',
        borderHover: 'border-white/25',
        text: 'text-white',
        textSoft: 'text-white/50',
        bg: 'bg-white/5',
        glow: 'shadow-[0_0_15px_rgba(239,68,68,0.1)]',
        dot: 'bg-white',
        dotGlow: 'shadow-[0_0_6px_rgba(239,68,68,0.4)]',
        ring: '#ef4444',
      };
    case 'optimus':
      return {
        primary: '#dc2626',
        secondary: '#1e3a5f',
        accent: 'red',
        accentHover: 'red-300',
        gradient: 'from-red-600 to-blue-900',
        gradientBg: 'from-red-600/10 to-blue-900/10',
        border: 'border-slate-400/20',
        borderHover: 'border-slate-300/40',
        text: 'text-slate-200',
        textSoft: 'text-slate-400/60',
        bg: 'bg-slate-400/5',
        glow: 'shadow-[0_0_15px_rgba(220,38,38,0.15)]',
        dot: 'bg-slate-300',
        dotGlow: 'shadow-[0_0_6px_rgba(220,38,38,0.5)]',
        ring: '#dc2626',
      };
  }
}
