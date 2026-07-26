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
      <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-5">Badges</p>
      <div className="grid grid-cols-3 gap-4">
        {BADGES.map((badge) => {
          const earned = streak >= badge.days;
          return (
            <div
              key={badge.days}
              className={`rounded-xl p-5 text-center transition-all ${
                earned
                  ? 'glass border border-cyan-400/30 shadow-[0_0_15px_rgba(56,189,248,0.1)]'
                  : 'bg-white/[0.02] border border-white/[0.06]'
              }`}
            >
              <span className={`text-4xl ${earned ? '' : 'grayscale opacity-40'}`}>{badge.icon}</span>
              <p className={`text-xs font-bold mt-3 ${earned ? badge.color : 'text-white/30'}`}>
                {badge.label}
              </p>
              <p className={`text-[0.6rem] mt-1 ${earned ? 'text-white/40' : 'text-white/15'}`}>{badge.desc}</p>
            </div>
          );
        })}
      </div>
      {streak >= 7 && (
        <p className="text-sm text-cyan-400/60 text-center mt-5 font-medium">
          {streak} day streak. Keep going.
        </p>
      )}
    </div>
  );
};
