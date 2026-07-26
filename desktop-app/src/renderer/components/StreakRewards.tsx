import React from 'react';

interface Props {
  streak: number;
  monthlyAvg: number;
}

const BADGES = [
  { days: 3, label: '3 Day', icon: '🔥', color: 'text-amber-400', desc: '3 days above 80' },
  { days: 7, label: 'Weekly', icon: '⭐', color: 'text-cyan-400', desc: '7 days above 80' },
  { days: 14, label: '2 Weeks', icon: '💎', color: 'text-purple-400', desc: '14 days above 80' },
  { days: 30, label: 'Monthly', icon: '👑', color: 'text-yellow-400', desc: '30 days above 80' },
  { days: 60, label: 'Diamond', icon: '💠', color: 'text-cyan-300', desc: '60 days above 80' },
  { days: 90, label: 'Legend', icon: '🏆', color: 'text-emerald-400', desc: '90 days above 80' },
];

export const StreakRewards: React.FC<Props> = ({ streak, monthlyAvg }) => {
  return (
    <div className="glass rounded-xl p-6 mt-6">
      <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Badges</p>
      <div className="grid grid-cols-3 gap-3">
        {BADGES.map((badge) => {
          const earned = streak >= badge.days;
          return (
            <div
              key={badge.days}
              className={`rounded-lg p-3 text-center transition-all ${
                earned
                  ? 'glass border border-cyan-400/20'
                  : 'bg-white/[0.01] border border-white/[0.03] opacity-30'
              }`}
            >
              <span className="text-2xl">{badge.icon}</span>
              <p className={`text-[0.6rem] font-bold mt-1.5 ${earned ? badge.color : 'text-white/20'}`}>
                {badge.label}
              </p>
              <p className="text-[0.5rem] text-white/15 mt-0.5">{badge.desc}</p>
            </div>
          );
        })}
      </div>
      {streak >= 7 && (
        <p className="text-xs text-cyan-400/40 text-center mt-4">
          {streak} day streak — keep going
        </p>
      )}
    </div>
  );
};
