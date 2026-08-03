import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface Props {
  onComplete: (result: { passed: boolean; tightened: boolean; protectionLevel: string }) => void;
}

type RestLevel = 'good' | 'ok' | 'low' | 'poor' | null;
type GoalLevel = 'plan' | 'discipline' | 'recover' | null;
type FocusLevel = 'sharp' | 'normal' | 'distracted' | null;

/**
 * Trading Readiness — Professional pre-session ritual
 * 
 * Feels like a pilot's pre-flight checklist, not a therapy quiz.
 * Single screen, 4 quick taps, ~15 seconds.
 * Never punishes honesty. Never auto-blocks on answers alone.
 */
export const TradingReadiness: React.FC<Props> = ({ onComplete }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const [rest, setRest] = useState<RestLevel>(null);
  const [goal, setGoal] = useState<GoalLevel>(null);
  const [focus, setFocus] = useState<FocusLevel>(null);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState('');

  const allAnswered = rest !== null && goal !== null && focus !== null;

  const handleConfirm = () => {
    // Calculate readiness score (0-100)
    let s = 0;

    // Rest (0-35)
    if (rest === 'good') s += 35;
    else if (rest === 'ok') s += 25;
    else if (rest === 'low') s += 12;
    else if (rest === 'poor') s += 0;

    // Goal (0-35)
    if (goal === 'plan') s += 35;
    else if (goal === 'discipline') s += 25;
    else if (goal === 'recover') s += 5;

    // Focus (0-30)
    if (focus === 'sharp') s += 30;
    else if (focus === 'normal') s += 20;
    else if (focus === 'distracted') s += 5;

    setScore(s);

    // Determine protection level
    let protectionLevel: string;
    let tightened = false;

    if (s >= 75) {
      protectionLevel = 'ready';
    } else if (s >= 50) {
      protectionLevel = 'recommended';
      tightened = true;
    } else if (s >= 30) {
      protectionLevel = 'protected';
      tightened = true;
    } else {
      protectionLevel = 'recovery';
      tightened = true;
    }

    setLevel(protectionLevel);
    setCompleted(true);

    // Short delay to show result, then proceed
    setTimeout(() => {
      onComplete({ passed: true, tightened, protectionLevel });
    }, 2000);
  };

  const getLevelConfig = (l: string) => {
    switch (l) {
      case 'ready': return { label: 'Ready', color: colors.primary, description: 'Normal trading. No changes.' };
      case 'recommended': return { label: 'Recommended Protection', color: '#fbbf24', description: 'Tighter limits suggested for today.' };
      case 'protected': return { label: 'Protected Mode', color: '#f97316', description: 'Reduced contracts and tighter loss limit.' };
      case 'recovery': return { label: 'Recovery Day', color: '#ef4444', description: 'Minimum settings. Consider sitting today out.' };
      default: return { label: '', color: '', description: '' };
    }
  };

  // Result screen
  if (completed) {
    const cfg = getLevelConfig(level);
    return (
      <div className="max-w-md mx-auto py-12 text-center animate-reveal">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}>
          <span className="text-2xl font-black font-mono" style={{ color: cfg.color }}>{score}</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight mb-2" style={{ color: cfg.color }}>{cfg.label}</h2>
        <p className="text-xs text-white/40 mb-6">{cfg.description}</p>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden max-w-xs mx-auto">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${score}%`, background: `linear-gradient(90deg, ${cfg.color}, ${colors.secondary})` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-6">
      {/* Header */}
      <div className="text-center mb-8 animate-reveal">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${colors.primary}50)` }}>✓</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-gradient mb-1">Trading Readiness</h2>
        <p className="text-[0.6rem] text-white/25 uppercase tracking-[2px]">Pre-session checklist</p>
      </div>

      {/* Checklist — single screen, 3 sections */}
      <div className="space-y-5 animate-reveal">

        {/* REST */}
        <div className="relative rounded-xl p-5 overflow-hidden card-premium">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.5rem] font-bold ${rest ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                {rest ? '✓' : '1'}
              </span>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[1.5px]">Rest</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([
                ['good', '8+', '8+ hours'],
                ['ok', '6-8', '6-8 hours'],
                ['low', '5-6', '5-6 hours'],
                ['poor', '<5', 'Under 5'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setRest(value)}
                  className="py-2.5 rounded-lg text-[0.6rem] font-bold transition-all press-scale"
                  style={{
                    background: rest === value ? `${colors.primary}20` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${rest === value ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`,
                    color: rest === value ? colors.primary : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* GOAL */}
        <div className="relative rounded-xl p-5 overflow-hidden card-premium">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.5rem] font-bold ${goal ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                {goal ? '✓' : '2'}
              </span>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[1.5px]">Today's Goal</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['plan', 'Follow plan'],
                ['discipline', 'Stay disciplined'],
                ['recover', 'Recover losses'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setGoal(value)}
                  className="py-2.5 rounded-lg text-[0.6rem] font-bold transition-all press-scale"
                  style={{
                    background: goal === value ? (value === 'recover' ? 'rgba(239,68,68,0.1)' : `${colors.primary}20`) : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${goal === value ? (value === 'recover' ? 'rgba(239,68,68,0.3)' : colors.primary + '40') : 'rgba(255,255,255,0.06)'}`,
                    color: goal === value ? (value === 'recover' ? '#ef4444' : colors.primary) : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FOCUS */}
        <div className="relative rounded-xl p-5 overflow-hidden card-premium">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.5rem] font-bold ${focus ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                {focus ? '✓' : '3'}
              </span>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[1.5px]">Focus</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['sharp', 'Sharp'],
                ['normal', 'Normal'],
                ['distracted', 'Distracted'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFocus(value)}
                  className="py-2.5 rounded-lg text-[0.6rem] font-bold transition-all press-scale"
                  style={{
                    background: focus === value ? `${colors.primary}20` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${focus === value ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`,
                    color: focus === value ? colors.primary : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <div className="mt-6 animate-reveal">
        <button
          onClick={handleConfirm}
          disabled={!allAnswered}
          className="w-full py-4 btn-premium text-xs font-bold uppercase tracking-[2.5px] rounded-xl press-scale disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          {allAnswered ? 'Lock & Trade' : 'Complete checklist'}
        </button>
        {!allAnswered && (
          <p className="text-[0.5rem] text-white/15 text-center mt-2">Select one option in each section</p>
        )}
      </div>

      {/* Skip option */}
      <button
        onClick={() => onComplete({ passed: true, tightened: false, protectionLevel: 'ready' })}
        className="w-full mt-3 py-2 text-[0.55rem] text-white/15 hover:text-white/30 transition-all"
      >
        Skip for today
      </button>
    </div>
  );
};
