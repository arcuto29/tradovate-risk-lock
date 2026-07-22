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

declare global { interface Window { electronAPI: any; } }

export const App: React.FC = () => {
  const [lockState, setLockState] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [loading, setLoading] = useState(true);

  const refreshState = useCallback(async () => {
    try { const state = await window.electronAPI.getLockState(); setLockState(state); }
    catch (e) { console.error('Failed to get lock state:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshState(); const interval = setInterval(refreshState, 1000); return () => clearInterval(interval); }, [refreshState]);

  if (loading) return <div className="app-container"><div className="loading">Loading...</div></div>;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Trading Guardian</h1>
        <nav className="app-nav">
          <button className={currentPage === 'main' ? 'active' : ''} onClick={() => setCurrentPage('main')}>{lockState?.isLocked ? 'Lock Status' : 'Risk Lock'}</button>
          <button className={currentPage === 'session' ? 'active' : ''} onClick={() => setCurrentPage('session')}>Session</button>
          <button className={currentPage === 'position' ? 'active' : ''} onClick={() => setCurrentPage('position')}>Size Limits</button>
          <button className={currentPage === 'coach' ? 'active' : ''} onClick={() => setCurrentPage('coach')}>Coach</button>
          <button className={currentPage === 'log' ? 'active' : ''} onClick={() => setCurrentPage('log')}>Log</button>
          <button className={currentPage === 'settings' ? 'active' : ''} onClick={() => setCurrentPage('settings')}>Settings</button>
        </nav>
      </header>
      <main className="app-main">
        {currentPage === 'main' && (lockState?.isLocked ? <LockStatus lockState={lockState} onRefresh={refreshState} /> : <SettingsForm onLocked={refreshState} />)}
        {currentPage === 'session' && <SessionHours isLocked={lockState?.isLocked} />}
        {currentPage === 'position' && <PositionLimits isLocked={lockState?.isLocked} />}
        {currentPage === 'coach' && <PsychologyCoach isLocked={lockState?.isLocked} />}
        {currentPage === 'log' && <ActivityLog />}
        {currentPage === 'settings' && <AppSettingsPanel isLocked={lockState?.isLocked} />}
      </main>
      <footer className="app-footer">
        <p className="disclaimer">This application adds a behavioral barrier. It does not replace your broker's risk management.</p>
        <p className="brand">Made by Priisma</p>
      </footer>
    </div>
  );
};
