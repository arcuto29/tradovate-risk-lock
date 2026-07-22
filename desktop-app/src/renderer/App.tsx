import React, { useState, useEffect, useCallback } from 'react';
import { SettingsForm } from './components/SettingsForm';
import { LockStatus } from './components/LockStatus';
import { ActivityLog } from './components/ActivityLog';
import { TrustedPerson } from './components/TrustedPerson';
import { AppSettingsPanel } from './components/AppSettingsPanel';
import { SessionHours } from './components/SessionHours';
import { PositionLimits } from './components/PositionLimits';
import { PsychologyCoach } from './components/PsychologyCoach';

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
      <div className="h-screen bg-black flex items-center justify-center">
        <span className="text-neutral-600 text-sm font-mono">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-9 pt-7">
        <p className="text-[0.6rem] font-semibold tracking-[5px] uppercase text-neutral-600 mb-7">
          Trading Guardian
        </p>
        <nav className="flex border-b border-white/[0.07]">
          {NAV_ITEMS.map(({ page, label, lockedLabel }) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`
                relative pb-3.5 mr-9 text-[0.78rem] font-medium transition-colors duration-100
                ${currentPage === page
                  ? 'text-white font-semibold'
                  : 'text-neutral-600 hover:text-neutral-400'}
              `}
            >
              {page === 'main' && lockState?.isLocked ? (lockedLabel || label) : label}
              {currentPage === page && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-px bg-white" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 px-9 py-12 overflow-y-auto">
        <div className="animate-reveal">
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
      <footer className="px-9 py-5 border-t border-white/[0.07] flex justify-between items-center">
        <span className="text-[0.6rem] text-neutral-700">
          Behavioral barrier only
        </span>
        <span className="text-[0.55rem] font-bold tracking-[4px] uppercase text-neutral-700">
          Trading Guardian
        </span>
      </footer>
    </div>
  );
};
