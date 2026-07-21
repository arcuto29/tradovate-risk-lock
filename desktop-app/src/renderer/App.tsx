import React, { useState, useEffect, useCallback } from 'react';
import { SettingsForm } from './components/SettingsForm';
import { LockStatus } from './components/LockStatus';
import { ActivityLog } from './components/ActivityLog';
import { TrustedPerson } from './components/TrustedPerson';
import { AppSettingsPanel } from './components/AppSettingsPanel';

type Page = 'main' | 'log' | 'trusted' | 'settings';

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
        <h1>Tradovate Risk Settings Lock</h1>
        <nav className="app-nav">
          <button className={currentPage === 'main' ? 'active' : ''} onClick={() => setCurrentPage('main')}>{lockState?.isLocked ? 'Lock Status' : 'Settings'}</button>
          <button className={currentPage === 'log' ? 'active' : ''} onClick={() => setCurrentPage('log')}>Activity Log</button>
          <button className={currentPage === 'trusted' ? 'active' : ''} onClick={() => setCurrentPage('trusted')}>Trusted Person</button>
          <button className={currentPage === 'settings' ? 'active' : ''} onClick={() => setCurrentPage('settings')}>App Settings</button>
        </nav>
      </header>
      <main className="app-main">
        {currentPage === 'main' && (lockState?.isLocked ? <LockStatus lockState={lockState} onRefresh={refreshState} /> : <SettingsForm onLocked={refreshState} />)}
        {currentPage === 'log' && <ActivityLog />}
        {currentPage === 'trusted' && <TrustedPerson isLocked={lockState?.isLocked} trustedPersonEnabled={lockState?.trustedPersonEnabled} />}
        {currentPage === 'settings' && <AppSettingsPanel isLocked={lockState?.isLocked} />}
      </main>
      <footer className="app-footer">
        <p className="disclaimer">This application adds a behavioral barrier. It does not replace Tradovate's risk management. Software controlled by the user cannot be completely tamper-proof.</p>
        <p className="brand">made by Priisma</p>
      </footer>
    </div>
  );
};
