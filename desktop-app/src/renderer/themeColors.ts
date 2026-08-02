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
    case 'neon':
      return {
        primary: '#f472b6',
        secondary: '#a855f7',
        accent: 'pink',
        accentHover: 'pink-300',
        gradient: 'from-pink-400 to-purple-500',
        gradientBg: 'from-pink-400/10 to-purple-500/10',
        border: 'border-pink-400/20',
        borderHover: 'border-pink-400/40',
        text: 'text-pink-300',
        textSoft: 'text-pink-400/60',
        bg: 'bg-pink-400/5',
        glow: 'shadow-[0_0_15px_rgba(244,114,182,0.15)]',
        dot: 'bg-pink-400',
        dotGlow: 'shadow-[0_0_6px_rgba(244,114,182,0.6)]',
        ring: '#f472b6',
      };
    case 'frost':
      return {
        primary: '#94a3b8',
        secondary: '#60a5fa',
        accent: 'slate',
        accentHover: 'slate-300',
        gradient: 'from-slate-300 to-blue-400',
        gradientBg: 'from-slate-300/10 to-blue-400/10',
        border: 'border-slate-400/20',
        borderHover: 'border-slate-300/40',
        text: 'text-slate-200',
        textSoft: 'text-slate-400/60',
        bg: 'bg-slate-400/5',
        glow: 'shadow-[0_0_15px_rgba(148,163,184,0.15)]',
        dot: 'bg-slate-300',
        dotGlow: 'shadow-[0_0_6px_rgba(148,163,184,0.6)]',
        ring: '#94a3b8',
      };
    case 'hologram':
      return {
        primary: '#00d4ff',
        secondary: '#0066ff',
        accent: 'sky',
        accentHover: 'sky-300',
        gradient: 'from-sky-400 to-blue-600',
        gradientBg: 'from-sky-400/10 to-blue-600/10',
        border: 'border-sky-400/20',
        borderHover: 'border-sky-400/40',
        text: 'text-sky-300',
        textSoft: 'text-sky-400/60',
        bg: 'bg-sky-400/5',
        glow: 'shadow-[0_0_15px_rgba(0,212,255,0.15)]',
        dot: 'bg-sky-400',
        dotGlow: 'shadow-[0_0_6px_rgba(0,212,255,0.6)]',
        ring: '#00d4ff',
      };
    case 'void':
      return {
        primary: '#00ff88',
        secondary: '#00cc6a',
        accent: 'emerald',
        accentHover: 'emerald-300',
        gradient: 'from-green-400 to-emerald-500',
        gradientBg: 'from-green-400/10 to-emerald-500/10',
        border: 'border-green-400/20',
        borderHover: 'border-green-400/40',
        text: 'text-green-400',
        textSoft: 'text-green-400/60',
        bg: 'bg-green-400/5',
        glow: 'shadow-[0_0_15px_rgba(0,255,136,0.15)]',
        dot: 'bg-green-400',
        dotGlow: 'shadow-[0_0_6px_rgba(0,255,136,0.6)]',
        ring: '#00ff88',
      };
    case 'gold':
      return {
        primary: '#ffd700',
        secondary: '#b8860b',
        accent: 'yellow',
        accentHover: 'yellow-300',
        gradient: 'from-yellow-400 to-amber-600',
        gradientBg: 'from-yellow-400/10 to-amber-600/10',
        border: 'border-yellow-400/20',
        borderHover: 'border-yellow-400/40',
        text: 'text-yellow-300',
        textSoft: 'text-yellow-400/60',
        bg: 'bg-yellow-400/5',
        glow: 'shadow-[0_0_15px_rgba(255,215,0,0.15)]',
        dot: 'bg-yellow-400',
        dotGlow: 'shadow-[0_0_6px_rgba(255,215,0,0.6)]',
        ring: '#ffd700',
      };
  }
}
