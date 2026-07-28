import React, { useState, useEffect, useCallback } from 'react';
import { SettingsForm } from './components/SettingsForm';
import { LockStatus } from './components/LockStatus';
import { ActivityLog } from './components/ActivityLog';
import { TrustedPerson } from './components/TrustedPerson';
import { AppSettingsPanel } from './components/AppSettingsPanel';
import { SessionHours } from './components/SessionHours';
import RiskSettings from './components/RiskSettings';
import { PsychologyCoach } from './components/PsychologyCoach';
import { UpdateBanner } from './components/UpdateBanner';
import { TiltMeter } from './components/TiltMeter';
import { BypassWarning } from './components/BypassWarning';
import { DisciplineScore } from './components/DisciplineScore';
import { PreMarketCheck } from './components/PreMarketCheck';
import { KillSwitch } from './components/KillSwitch';
import { DailyReport } from './components/DailyReport';
import { StreakRewards } from './components/StreakRewards';
import { ActivationScreen } from './components/ActivationScreen';
import { Blocklist } from './components/Blocklist';
import { DayRules } from './components/DayRules';

type Page = 'main' | 'session' | 'coach' | 'discipline' | 'blocklist' | 'dayrules' | 'log' | 'settings';

declare global {
  interface Window { electronAPI: any; }
}

const NAV_ITEMS: { page: Page; label: string; lockedLabel?: string; icon: string }[] = [
  { page: 'main', label: 'Risk', lockedLabel: 'Status', icon: '◆' },
  { page: 'session', label: 'Session', icon: '◷' },
  { page: 'coach', label: 'Coach', icon: '◈' },
  { page: 'dayrules', label: 'Days', icon: '◇' },
  { page: 'discipline', label: 'Score', icon: '◉' },
  { page: 'blocklist', label: 'Blocklist', icon: '◻' },
  { page: 'settings', label: 'Settings', icon: '◎' },
];

export const App: React.FC = () => {
  const [lockState, setLockState] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [loading, setLoading] = useState(true);
  const [preMarketPassed, setPreMarketPassed] = useState(false);
  const [limitsTightened, setLimitsTightened] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [activated, setActivated] = useState(true);

  const refreshState = useCallback(async () => {
    try {
      const license = await (window as any).electronAPI?.checkLicense?.();
      if (license && !license.activated) {
        setActivated(false);
        setLoading(false);
        return;
      }
      const state = await window.electronAPI.getLockState();
      setLockState(state);
    } catch (e) {
      console.error('Failed to get lock state:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 1000);
    return () => clearInterval(interval);
  }, [refreshState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F12') {
        (window as any).electronAPI?.devForceUnlock?.().then((r: any) => {
          if (r?.success) refreshState();
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refreshState]);

  if (loading) {
    return (
      <div className="h-screen bg-[#030108] flex items-center justify-center">
        <div className="nebula-bg" />
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          <span className="text-cyan-300/40 text-xs font-medium tracking-[3px] uppercase">Initializing</span>
        </div>
      </div>
    );
  }

  if (!activated) {
    return <ActivationScreen onActivated={() => { setActivated(true); refreshState(); }} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      <UpdateBanner />
      <BypassWarning />
      <div className="nebula-bg" />
      <div className="stars" />


      {/* Header */}
      <header className="relative z-10 px-8 pt-5 pb-0 glass-strong">
        {/* Brand */}
        <div className="flex items-center justify-center mb-5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400/20 to-purple-400/10 border border-cyan-400/20 flex items-center justify-center">
              <span className="text-[0.6rem] text-cyan-400" style={{filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.6))'}}>&#x1F6E1;</span>
            </div>
            <p className="text-[0.6rem] font-bold tracking-[5px] uppercase text-gradient">
              Trading Guardian
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex justify-center gap-1">
          {NAV_ITEMS.map(({ page, label, lockedLabel, icon }) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`
                relative px-4 py-3 rounded-t-xl text-[0.72rem] font-medium transition-all duration-200 group
                ${currentPage === page
                  ? 'text-white bg-white/[0.04]'
                  : 'text-white/25 hover:text-white/50 hover:bg-white/[0.02]'}
              `}
            >
              <span className="flex items-center gap-2">
                <span className={`text-[0.6rem] transition-all ${currentPage === page ? 'text-cyan-400 opacity-100' : 'opacity-30'}`}>{icon}</span>
                <span>{page === 'main' && lockState?.isLocked ? (lockedLabel || label) : label}</span>
              </span>
              {currentPage === page && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
              )}
            </button>
          ))}
        </nav>
      </header>


      {/* Main */}
      <main className="relative z-10 flex-1 px-8 py-8 overflow-y-auto">
        <div className="animate-reveal max-w-2xl mx-auto" key={currentPage}>
          {currentPage === 'main' && (
            lockState?.isLocked
              ? <>
                  <TiltMeter />
                  <LockStatus lockState={lockState} onRefresh={refreshState} />
                  <div className="mt-6">
                    <KillSwitch onActivated={refreshState} />
                  </div>
                  <div className="mt-4 relative rounded-xl p-5 overflow-hidden card-premium">
                    <div className="relative z-10 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-white/60">Ghost Mode</span>
                        <p className="text-[0.6rem] text-white/20 mt-0.5">Hide P&L until session ends</p>
                      </div>
                      <div className={`toggle-premium ${ghostMode ? 'active' : ''}`} onClick={() => {
                        const newState = !ghostMode;
                        setGhostMode(newState);
                        (window as any).electronAPI?.toggleGhostMode?.(newState);
                      }} />
                    </div>
                  </div>
                  <button
                    onClick={() => (window as any).electronAPI?.devForceUnlock?.().then(() => refreshState())}
                    className="mt-4 px-4 py-2 text-[0.6rem] text-white/15 border border-white/[0.04] rounded-lg hover:text-white/30 hover:border-white/[0.08] transition-all"
                  >
                    Dev Unlock
                  </button>
                  <button
                    onClick={() => (window as any).electronAPI?.exitFullscreen?.()}
                    className="mt-2 ml-2 px-4 py-2 text-[0.6rem] text-white/15 border border-white/[0.04] rounded-lg hover:text-white/30 hover:border-white/[0.08] transition-all"
                  >
                    Dev Exit Fullscreen
                  </button>
                </>
              : !preMarketPassed
                ? <PreMarketCheck onComplete={(result) => { setPreMarketPassed(result.passed); setLimitsTightened(result.tightened); }} />
                : <>
                    {limitsTightened && (
                      <div className="mb-6 px-5 py-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] text-amber-300/80 text-xs font-medium animate-reveal flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                        Limits tightened for today. You're not in the right headspace.
                      </div>
                    )}
                    <RiskSettings isLocked={false} onLocked={refreshState} />
                  </>
          )}
          {currentPage === 'session' && <SessionHours isLocked={lockState?.isLocked} />}
          {currentPage === 'coach' && <PsychologyCoach isLocked={lockState?.isLocked} />}
          {currentPage === 'discipline' && (
            <>
              <DisciplineScore />
              <StreakRewards streak={0} monthlyAvg={0} />
              <div className="mt-8"><DailyReport /></div>
            </>
          )}
          {currentPage === 'blocklist' && <Blocklist isLocked={lockState?.isLocked} />}
          {currentPage === 'dayrules' && <DayRules isLocked={lockState?.isLocked} />}
          {currentPage === 'log' && <ActivityLog />}
          {currentPage === 'settings' && <AppSettingsPanel isLocked={lockState?.isLocked} />}
        </div>
      </main>


      {/* Footer */}
      <footer className="relative z-10 px-8 py-3 glass flex justify-between items-center">
        <span className="text-[0.55rem] text-white/15 italic">
          Behavioral barrier only
        </span>
        <span className="text-[0.5rem] font-bold tracking-[4px] uppercase text-gradient opacity-40">
          Priisma
        </span>
      </footer>
    </div>
  );
};
