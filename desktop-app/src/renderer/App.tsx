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

type Page = 'main' | 'session' | 'coach' | 'discipline' | 'log' | 'settings';

declare global {
  interface Window { electronAPI: any; }
}

const NAV_ITEMS: { page: Page; label: string; lockedLabel?: string }[] = [
  { page: 'main', label: 'Risk Settings', lockedLabel: 'Status' },
  { page: 'session', label: 'Session' },
  { page: 'coach', label: 'Coach' },
  { page: 'discipline', label: 'Score' },
  { page: 'log', label: 'Log' },
  { page: 'settings', label: 'Settings' },
];

export const App: React.FC = () => {
  const [lockState, setLockState] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [loading, setLoading] = useState(true);
  const [preMarketPassed, setPreMarketPassed] = useState(false);
  const [limitsTightened, setLimitsTightened] = useState(false);

  const refreshState = useCallback(async () => {
    try {
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

  // Dev shortcut: Ctrl+Shift+F12 to force unlock
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
        <span className="text-cyan-300/60 text-sm font-mono animate-pulse-glow">Initializing...</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      {/* Update Banner */}
      <UpdateBanner />

      {/* Bypass Warning Overlay */}
      <BypassWarning />

      {/* Nebula + Stars Background */}
      <div className="nebula-bg" />
      <div className="stars" />

      {/* Header */}
      <header className="relative z-10 px-8 pt-6 glass-strong">
        <p className="text-[0.62rem] font-bold tracking-[6px] uppercase text-glow-cyan mb-5 animate-breathe text-center">
          Trading Guardian
        </p>
        <nav className="flex justify-center border-b border-cyan-400/10">
          {NAV_ITEMS.map(({ page, label, lockedLabel }) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`
                relative pb-3 mr-8 text-[0.78rem] font-medium transition-all duration-200
                ${currentPage === page
                  ? 'text-cyan-300 text-glow-cyan font-semibold'
                  : 'text-white/30 hover:text-white/60'}
              `}
            >
              {page === 'main' && lockState?.isLocked ? (lockedLabel || label) : label}
              {currentPage === page && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 px-8 py-10 overflow-y-auto">
        <div className="animate-reveal max-w-2xl mx-auto" key={currentPage}>
          {currentPage === 'main' && (
            lockState?.isLocked
              ? <>
                  <TiltMeter />
                  <LockStatus lockState={lockState} onRefresh={refreshState} />
                  <button
                    onClick={() => (window as any).electronAPI?.devForceUnlock?.().then(() => refreshState())}
                    className="mt-4 px-4 py-2 text-[0.6rem] text-white/20 border border-white/[0.05] rounded hover:text-white/40 hover:border-white/10 transition-all"
                  >
                    Dev Unlock
                  </button>
                  <button
                    onClick={() => (window as any).electronAPI?.exitFullscreen?.()}
                    className="mt-2 px-4 py-2 text-[0.6rem] text-white/20 border border-white/[0.05] rounded hover:text-white/40 hover:border-white/10 transition-all"
                  >
                    Dev Exit Fullscreen
                  </button>
                </>
              : !preMarketPassed
                ? <PreMarketCheck onComplete={(result) => { setPreMarketPassed(result.passed); setLimitsTightened(result.tightened); }} />
                : <>
                    {limitsTightened && (
                      <div className="mb-6 px-5 py-3.5 glass rounded-lg border border-amber-400/20 text-amber-300/80 text-xs font-medium">
                        You're not in the right headspace. Limits tightened for today.
                      </div>
                    )}
                    <RiskSettings isLocked={false} onLocked={refreshState} />
                  </>
          )}
          {currentPage === 'session' && <SessionHours isLocked={lockState?.isLocked} />}
          {currentPage === 'coach' && <PsychologyCoach isLocked={lockState?.isLocked} />}
          {currentPage === 'discipline' && <DisciplineScore />}
          {currentPage === 'log' && <ActivityLog />}
          {currentPage === 'settings' && <AppSettingsPanel isLocked={lockState?.isLocked} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-4 glass flex justify-between items-center">
        <span className="text-[0.6rem] text-white/20">
          Behavioral barrier only
        </span>
        <span className="text-[0.55rem] font-bold tracking-[4px] uppercase text-white/15">
          Priisma
        </span>
      </footer>
    </div>
  );
};
