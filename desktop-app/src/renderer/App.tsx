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
import { WelcomeScreen } from './components/WelcomeScreen';
import { Logo } from './components/Logo';
import { MarketTimer } from './components/MarketTimer';
import { NewsBlocker } from './components/NewsBlocker';
import { AdvancedProtection } from './components/AdvancedProtection';
import { useTheme } from './ThemeContext';
import { getThemeColors } from './themeColors';

type Page = 'main' | 'session' | 'coach' | 'discipline' | 'blocklist' | 'dayrules' | 'news' | 'advanced' | 'log' | 'settings';

declare global {
  interface Window { electronAPI: any; }
}

const NAV_ITEMS: { page: Page; label: string; lockedLabel?: string; icon: string }[] = [
  { page: 'main', label: 'Risk', lockedLabel: 'Status', icon: '◆' },
  { page: 'session', label: 'Session', icon: '◷' },
  { page: 'coach', label: 'Coach', icon: '◈' },
  { page: 'advanced', label: 'Advanced', icon: '◇' },
  { page: 'news', label: 'News', icon: '◌' },
  { page: 'discipline', label: 'Score', icon: '◉' },
  { page: 'blocklist', label: 'Blocklist', icon: '◻' },
  { page: 'settings', label: 'Settings', icon: '◎' },
];

export const App: React.FC = () => {
  const [lockState, setLockState] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [loading, setLoading] = useState(true);
  const [preMarketPassed, setPreMarketPassed] = useState(() => {
    // Only ask once per day
    const lastPassed = localStorage.getItem('tg-premarket-date');
    const today = new Date().toISOString().split('T')[0];
    return lastPassed === today;
  });
  const [limitsTightened, setLimitsTightened] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [activated, setActivated] = useState(true);
  const [welcomeDone, setWelcomeDone] = useState(() => localStorage.getItem('tg-welcome-done') === 'true');
  const [devMode, setDevMode] = useState(() => localStorage.getItem('tg-dev-mode') === 'true');
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

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
      // Ctrl+Shift+D to toggle dev mode
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        const nd = !JSON.parse(localStorage.getItem("tg-dev-mode") || "false");
        localStorage.setItem("tg-dev-mode", String(nd));
        window.location.reload();
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
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{borderColor: `${colors.primary}30`, borderTopColor: colors.primary}} />
          <span className="text-xs font-medium tracking-[3px] uppercase" style={{color: `${colors.primary}60`}}>Initializing</span>
        </div>
      </div>
    );
  }

  if (!activated) {
    return <ActivationScreen onActivated={() => { setActivated(true); refreshState(); }} />;
  }

  if (!welcomeDone && !devMode) {
    return <WelcomeScreen onComplete={() => { setWelcomeDone(true); localStorage.setItem('tg-welcome-done', 'true'); }} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      <UpdateBanner />
      <BypassWarning />
      <div className="nebula-bg" />
      <div className="stars" />
      <div className="sakura-petals" />


      {/* Header */}
      <header className="relative z-10 px-8 pt-5 pb-0 glass-strong" style={{borderBottom: `1px solid ${colors.primary}15`}}>
        {/* Subtle top glow line */}
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, ${colors.secondary}20, transparent)`}} />
        
        {/* Brand */}
        <div className="flex items-center justify-center mb-5">
          <div className="flex items-center gap-3">
            <Logo size={24} />
            <p className="text-[0.6rem] font-bold tracking-[5px] uppercase text-gradient">
              Trading Guardian
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex justify-center gap-1">
          {NAV_ITEMS.map(({ page, label, lockedLabel, icon }) => {
            // Block only Risk tab content if pre-market not done (let them access other tabs)
            const navBlocked = false; // Nav is always accessible
            return (
            <button
              key={page}
              onClick={() => !navBlocked && setCurrentPage(page)}
              className={`
                relative px-4 py-3 rounded-t-xl text-[0.72rem] font-medium transition-all duration-200 group
                ${navBlocked ? 'opacity-30 cursor-not-allowed' : ''}
                ${currentPage === page
                  ? 'text-white'
                  : 'text-white/25 hover:text-white/50 hover:bg-white/[0.02]'}
              `}
              style={currentPage === page ? {background: `${colors.primary}08`} : undefined}
            >
              <span className="flex items-center gap-2">
                <span className={`text-[0.6rem] transition-all ${currentPage === page ? 'opacity-100' : 'opacity-30'}`} style={{color: currentPage === page ? colors.primary : undefined}}>{icon}</span>
                <span>{page === 'main' && lockState?.isLocked ? (lockedLabel || label) : label}</span>
              </span>
              {currentPage === page && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`, boxShadow: `0 0 8px ${colors.primary}80`}} />
              )}
            </button>
            );
          })}
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
                  <div className="mt-3 relative rounded-xl p-5 overflow-hidden card-premium">
                    <div className="relative z-10 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-white/60">Floating Widget</span>
                        <p className="text-[0.6rem] text-white/20 mt-0.5">Mini tilt + timer on top of charts</p>
                      </div>
                      <button
                        onClick={() => (window as any).electronAPI?.openWidget?.()}
                        className="px-4 py-2 text-[0.6rem] font-bold uppercase tracking-[1.5px] rounded-lg press-scale"
                        style={{background: `${colors.primary}15`, border: `1px solid ${colors.primary}25`, color: `${colors.primary}cc`}}
                      >
                        Show
                      </button>
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
              : (!preMarketPassed && !devMode)
                ? <PreMarketCheck onComplete={(result) => { setPreMarketPassed(result.passed); setLimitsTightened(result.tightened); localStorage.setItem('tg-premarket-date', new Date().toISOString().split('T')[0]); }} />
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
            </>
          )}
          {currentPage === 'blocklist' && <Blocklist isLocked={lockState?.isLocked} />}
          {currentPage === 'news' && <NewsBlocker isLocked={lockState?.isLocked} />}
          {currentPage === 'advanced' && (
            <>
              <AdvancedProtection isLocked={lockState?.isLocked} />
              <div className="mt-8"><DayRules isLocked={lockState?.isLocked} /></div>
            </>
          )}
          {currentPage === 'log' && <ActivityLog />}
          {currentPage === 'settings' && <AppSettingsPanel isLocked={lockState?.isLocked} />}
        </div>
      </main>


      {/* Footer */}
      <footer className="relative z-10 px-8 py-3 glass flex justify-between items-center" style={{borderTop: `1px solid ${colors.primary}10`}}>
        <MarketTimer />
        <span className="text-[0.5rem] font-bold tracking-[4px] uppercase text-gradient opacity-40">
          Priisma
        </span>
      </footer>
    </div>
  );
};
