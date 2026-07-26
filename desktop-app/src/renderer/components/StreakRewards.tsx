import React from 'react';

interface Props {
  streak: number;
  monthlyAvg: number;
}

const BADGES = [
  { days: 3, label: 'Bronze', borderColor: 'border-amber-700/40', textColor: 'text-amber-600', glowColor: 'shadow-[0_0_12px_rgba(180,83,9,0.2)]', shieldColor: 'text-amber-700' },
  { days: 7, label: 'Silver', borderColor: 'border-neutral-400/40', textColor: 'text-neutral-300', glowColor: 'shadow-[0_0_12px_rgba(163,163,163,0.2)]', shieldColor: 'text-neutral-400' },
  { days: 14, label: 'Gold', borderColor: 'border-yellow-500/40', textColor: 'text-yellow-400', glowColor: 'shadow-[0_0_12px_rgba(234,179,8,0.3)]', shieldColor: 'text-yellow-500' },
  { days: 30, label: 'Platinum', borderColor: 'border-cyan-400/40', textColor: 'text-cyan-300', glowColor: 'shadow-[0_0_15px_rgba(56,189,248,0.3)]', shieldColor: 'text-cyan-400' },
  { days: 60, label: 'Diamond', borderColor: 'border-purple-400/40', textColor: 'text-purple-300', glowColor: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]', shieldColor: 'text-purple-400' },
  { days: 90, label: 'Obsidian', borderColor: 'border-white/30', textColor: 'text-white', glowColor: 'shadow-[0_0_20px_rgba(255,255,255,0.15)]', shieldColor: 'text-white' },
];

export const StreakRewards: React.FC<Props> = ({ streak, monthlyAvg }) => {
  return (
    <div className="glass rounded-xl p-6 mt-6">
      <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-5">Shields</p>
      <div className="grid grid-cols-3 gap-4">
        {BADGES.map((badge) => {
          const earned = streak >= badge.days;
          return (
            <div
              key={badge.days}
              className={`rounded-xl p-5 text-center transition-all border ${
                earned
                  ? `${badge.borderColor} ${badge.glowColor}`
                  : 'border-white/[0.04] opacity-25'
              }`}
            >
              <span className={`text-3xl ${earned ? badge.shieldColor : 'text-white/20'}`}>&#x1F6E1;</span>
              <p className={`text-xs font-bold mt-3 ${earned ? badge.textColor : 'text-white/20'}`}>
                {badge.label}
              </p>
              <p className={`text-[0.55rem] mt-1 ${earned ? 'text-white/30' : 'text-white/10'}`}>{badge.days} days</p>
            </div>
          );
        })}
      </div>
      {streak >= 3 && (
        <p className="text-sm text-cyan-400/60 text-center mt-5 font-medium">
          {streak} day streak. Keep going.
        </p>
      )}
    </div>
  );
};
