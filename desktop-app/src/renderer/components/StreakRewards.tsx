import React from 'react';

interface Props {
  streak: number;
  monthlyAvg: number;
}

const BADGES = [
  { days: 3, label: 'Bronze', color: '#CD7F32', glow: 'rgba(205,127,50,0.4)' },
  { days: 7, label: 'Silver', color: '#C0C0C0', glow: 'rgba(192,192,192,0.4)' },
  { days: 14, label: 'Gold', color: '#FFD700', glow: 'rgba(255,215,0,0.4)' },
  { days: 30, label: 'Platinum', color: '#00E5FF', glow: 'rgba(0,229,255,0.4)' },
  { days: 60, label: 'Diamond', color: '#B388FF', glow: 'rgba(179,136,255,0.4)' },
  { days: 90, label: 'Obsidian', color: '#FFFFFF', glow: 'rgba(255,255,255,0.3)' },
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
              className="rounded-xl p-5 text-center transition-all border"
              style={{
                borderColor: earned ? badge.color + '60' : 'rgba(255,255,255,0.08)',
                boxShadow: earned ? `0 0 20px ${badge.glow}` : 'none',
                opacity: earned ? 1 : 0.5,
              }}
            >
              <div
                className="text-4xl mx-auto mb-3"
                style={{ color: earned ? badge.color : badge.color + '40' }}
              >
                &#x1F6E1;
              </div>
              <p
                className="text-xs font-bold"
                style={{ color: earned ? badge.color : badge.color + '60' }}
              >
                {badge.label}
              </p>
              <p className="text-[0.55rem] mt-1 text-white/30">{badge.days} days</p>
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
