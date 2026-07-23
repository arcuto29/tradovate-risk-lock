import React, { useState, useEffect, useCallback } from 'react';
import { SettingsForm } from './components/SettingsForm';
import { LockStatus } from './components/LockStatus';
import { ActivityLog } from './components/ActivityLog';
import { TrustedPerson } from './components/TrustedPerson';
import { AppSettingsPanel } from './components/AppSettingsPanel';
import { SessionHours } from './components/SessionHours';
import { PositionLimits } from './components/PositionLimits';
import { PsychologyCoach } from './components/PsychologyCoach';
import { UpdateBanner } from './components/UpdateBanner';

type Page = 'main' | 'session' | 'position' | 'coach' | 'log' | 'settings';

declare global {
  interface Window { electronAPI: any; }
}

const NAV_ITEMS: { page: Page; label: string; lockedLabel?: string }[] = [
  { page: 'main', label: 'Risk Lock', lockedLabel: 'Status' },
  { page: 'session', label: 'Session' },
  { page: 'position', label: 'Limits' },
  { page: 'coach', label: 'Coach' },
  { page: 'log', label: 'Log' },
  { page: 'settings', label: 'Settings' },
];

export const App: React.FC = () => {
  const [lockState, setLockState] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [loading, setLoading] = useState(true);

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

      {/* Nebula + Stars Background */}
      <div className="nebula-bg" />
      <div className="stars" />

      {/* Header */}
      <header className="relative z-10 px-8 pt-6 glass-strong">
        <p className="text-[0.62rem] font-bold tracking-[6px] uppercase text-glow-cyan mb-5 animate-breathe">
          Trading Guardian
        </p>
        <nav className="flex border-b border-cyan-400/10">
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
        <div className="animate-reveal" key={currentPage}>
          {currentPage === 'main' && (
            lockState?.isLocked
              ? <LockStatus lockState={lockState} onRefresh={refreshState} />
              : <SettingsForm onLocked={refreshState} />
          )}
          {currentPage === 'session' && <SessionHours isLocked={lockState?.isLocked} />}
          {currentPage === 'position' && <PositionLimits isLocked={lockState?.isLocked} />}
          {currentPage === 'coach' && <PsychologyCoach isLocked={lockState?.isLocked} />}
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
