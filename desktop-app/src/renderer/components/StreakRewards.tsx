import React from 'react';

interface Props {
  streak: number;
  monthlyAvg: number;
}

const BADGES = [
  { days: 3, label: 'Bronze', color: '#CD7F32', glow: 'rgba(205,127,50,0.5)', bg: 'from-amber-900/20 to-amber-700/5' },
  { days: 7, label: 'Silver', color: '#C0C0C0', glow: 'rgba(192,192,192,0.5)', bg: 'from-gray-400/20 to-gray-300/5' },
  { days: 14, label: 'Gold', color: '#FFD700', glow: 'rgba(255,215,0,0.5)', bg: 'from-yellow-500/20 to-amber-400/5' },
  { days: 30, label: 'Platinum', color: '#00E5FF', glow: 'rgba(0,229,255,0.5)', bg: 'from-cyan-400/20 to-cyan-300/5' },
  { days: 60, label: 'Diamond', color: '#B388FF', glow: 'rgba(179,136,255,0.5)', bg: 'from-purple-400/20 to-purple-300/5' },
  { days: 90, label: 'Obsidian', color: '#FFFFFF', glow: 'rgba(255,255,255,0.4)', bg: 'from-white/20 to-white/5' },
];

export const StreakRewards: React.FC<Props> = ({ streak, monthlyAvg }) => {
  return (
    <div className="relative rounded-xl p-6 overflow-hidden card-premium mt-6 animate-reveal">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-amber-400/60 text-sm">🛡</span>
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-amber-400/60">Shields</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {BADGES.map((badge, i) => {
            const earned = streak >= badge.days;
            return (
              <div
                key={badge.days}
                className={`relative rounded-xl p-5 text-center transition-all border hover-lift overflow-hidden ${
                  earned ? 'animate-glow-pulse' : ''
                }`}
                style={{
                  borderColor: earned ? badge.color + '40' : 'rgba(255,255,255,0.06)',
                  boxShadow: earned ? `0 0 25px ${badge.glow}, inset 0 0 20px ${badge.glow}20` : 'none',
                  background: earned
                    ? `linear-gradient(135deg, ${badge.color}10, transparent)`
                    : 'rgba(255,255,255,0.02)',
                }}
              >
                {earned && (
                  <div className="absolute inset-0 opacity-30" style={{
                    background: `radial-gradient(circle at 50% 30%, ${badge.color}20, transparent 70%)`
                  }} />
                )}
                <div className="relative z-10">
                  <div
                    className="text-3xl mx-auto mb-2"
                    style={{
                      color: earned ? badge.color : 'rgba(255,255,255,0.15)',
                      filter: earned ? `drop-shadow(0 0 8px ${badge.glow})` : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    &#x1F6E1;
                  </div>
                  <p
                    className="text-xs font-bold mb-0.5"
                    style={{ color: earned ? badge.color : 'rgba(255,255,255,0.2)' }}
                  >
                    {badge.label}
                  </p>
                  <p className="text-[0.55rem] text-white/25">{badge.days} days</p>
                </div>
              </div>
            );
          })}
        </div>
        {streak >= 3 && (
          <div className="mt-5 text-center">
            <p className="text-sm font-semibold text-gradient inline-block">
              {streak} day streak
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
