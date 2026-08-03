import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface Props {
  streak: number;
  monthlyAvg: number;
}

const BADGES = [
  { days: 3, label: 'Bronze', color: '#CD7F32', glow: 'rgba(205,127,50,0.5)' },
  { days: 7, label: 'Silver', color: '#C0C0C0', glow: 'rgba(192,192,192,0.5)' },
  { days: 14, label: 'Gold', color: '#FFD700', glow: 'rgba(255,215,0,0.5)' },
  { days: 30, label: 'Platinum', color: '#00E5FF', glow: 'rgba(0,229,255,0.5)' },
  { days: 60, label: 'Diamond', color: '#B388FF', glow: 'rgba(179,136,255,0.5)' },
  { days: 90, label: 'Obsidian', color: '#FF4500', glow: 'rgba(255,69,0,0.5)' },
];

export const StreakRewards: React.FC<Props> = ({ streak, monthlyAvg }) => {
  return (
    <div className="relative rounded-xl p-6 overflow-hidden card-premium mt-6 animate-reveal">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck size={14} className="text-amber-400/60" />
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-amber-400/60">Shields</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {BADGES.map((badge) => {
            const earned = streak >= badge.days;
            return (
              <div
                key={badge.days}
                className={`relative rounded-xl p-5 text-center transition-all border hover-lift overflow-hidden ${
                  earned ? 'animate-glow-pulse' : ''
                }`}
                style={{
                  borderColor: earned ? badge.color + '50' : badge.color + '25',
                  boxShadow: earned
                    ? `0 0 25px ${badge.glow}, inset 0 0 20px ${badge.glow}20`
                    : `0 0 10px ${badge.color}10`,
                  background: earned
                    ? `linear-gradient(135deg, ${badge.color}15, ${badge.color}05)`
                    : `linear-gradient(135deg, ${badge.color}08, transparent)`,
                }}
              >
                {earned && (
                  <div className="absolute inset-0" style={{
                    background: `radial-gradient(circle at 50% 30%, ${badge.color}25, transparent 70%)`
                  }} />
                )}
                <div className="relative z-10">
                  <div
                    className="text-3xl mx-auto mb-2"
                    style={{
                      color: earned ? badge.color : badge.color + '90',
                      filter: earned ? `drop-shadow(0 0 10px ${badge.glow})` : `drop-shadow(0 0 3px ${badge.color}40)`,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    &#x1F6E1;
                  </div>
                  <p
                    className="text-xs font-bold mb-0.5"
                    style={{ color: earned ? badge.color : badge.color + '80' }}
                  >
                    {badge.label}
                  </p>
                  <p className="text-[0.55rem]" style={{ color: earned ? badge.color + '60' : 'rgba(255,255,255,0.25)' }}>
                    {badge.days} days
                  </p>
                  {!earned && (
                    <p className="text-[0.5rem] mt-1.5 text-white/20">{badge.days - streak} to go</p>
                  )}
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
