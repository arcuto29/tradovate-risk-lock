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
import { TradingReadiness } from './components/TradingReadiness';
import { KillSwitch } from './components/KillSwitch';
import { DailyReport } from './components/DailyReport';
import { StreakRewards } from './components/StreakRewards';
import { ActivationScreen } from './components/ActivationScreen';
import { Blocklist } from './components/Blocklist';
import { DayRules } from './components/DayRules';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Onboarding } from './components/Onboarding';
import { HomeDashboard } from './components/HomeDashboard';
import { TradingSimulator } from './components/TradingSimulator';
import { Analytics } from './components/Analytics';
import { RuleReplay } from './components/RuleReplay';
import { Logo } from './components/Logo';
import { MarketTimer } from './components/MarketTimer';
import { NewsBlocker } from './components/NewsBlocker';
import { AdvancedProtection } from './components/AdvancedProtection';
import { TradingProfileCard } from './components/TradingProfileCard';
import { ProtectionPage } from './components/ProtectionPage';
import { DailyMission } from './components/DailyMission';
import { DisciplineRisk } from './components/DisciplineRisk';
import { useTheme } from './ThemeContext';
import { getThemeColors } from './themeColors';

type Page = 'home' | 'protection' | 'news' | 'insights' | 'review' | 'settings' | 'simulator';

declare global {
  interface Window { electronAPI: any; }
}

const NAV_ITEMS: { page: Page; label: string; icon: string; devOnly?: boolean }[] = [
  { page: 'home', label: 'Home', icon: '◆' },
  { page: 'protection', label: 'Protection', icon: '◈' },
  { page: 'news', label: 'News', icon: '◌' },
  { page: 'insights', label: 'Insights', icon: '◫' },
  { page: 'review', label: 'Review', icon: '◧' },
  { page: 'settings', label: 'Settings', icon: '◎' },
  { page: 'simulator', label: 'Test Lab', icon: '▶', devOnly: true },
];

export const App: React.FC = () => {
  const [lockState, setLockState] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<Page>('home');
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
  const [profileDone, setProfileDone] = useState(false);
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
      // Only check profile on first load (not every poll)
      if (!profileDone) {
        const profile = await (window as any).electronAPI?.getTradingProfile?.();
        setProfileDone(!!profile);
      }

      const state = await window.electronAPI.getLockState();
      setLockState(state);
    } catch (e) {
      console.error('Failed to get lock state:', e);
    } finally {
      setLoading(false);
    }
  }, [profileDone]);

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

  if (!profileDone && !devMode) {
    return <Onboarding onComplete={() => { setProfileDone(true); localStorage.setItem('tg-welcome-done', 'true'); }} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      <UpdateBanner />
      <BypassWarning />
      <div className="nebula-bg" />
      <div className="stars" />
      <div className="sakura-petals" />


      {/* Header */}
      <header className="relative z-10 px-8 pt-5 pb-0 glass-strong" style={{borderBottom: `1px solid ${colors.primary}08`}}>
        {/* Brand */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center gap-2.5">
            <Logo size={22} />
            <p className="text-[0.6rem] font-bold tracking-[4px] uppercase" style={{color: `${colors.primary}90`}}>
              Sentinel
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex justify-center gap-0.5">
          {NAV_ITEMS.filter(item => !item.devOnly || devMode).map(({ page, label, icon }) => {
            const isMidnight = theme === 'midnight';
            const isActive = currentPage === page;
            return (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`
                relative px-5 py-3 rounded-t-xl text-[0.72rem] font-medium transition-all duration-200
                ${isActive ? 'text-white/90' : 'text-white/30 hover:text-white/50'}
              `}
            >
              <span className="flex items-center gap-2">
                <span className={`text-[0.55rem] transition-all duration-200 ${isActive ? 'opacity-80' : 'opacity-0'}`} style={{color: isActive ? (isMidnight ? '#ffffff' : colors.primary) : undefined}}>{icon}</span>
                <span>{label}</span>
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`, opacity: 0.8}} />
              )}
            </button>
            );
          })}
        </nav>
      </header>


      {/* Main */}
      <main className="relative z-10 flex-1 px-8 py-8 overflow-y-auto">
        <div className="animate-reveal max-w-2xl mx-auto" key={currentPage}>
          {currentPage === 'home' && (
            lockState?.isLocked
              ? <>
                  <DailyMission />
                  <div className="mt-5">
                    <DisciplineRisk />
                  </div>
                  <div className="mt-5">
                    <TiltMeter />
                  </div>
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
                ? <TradingReadiness onComplete={(result) => { setPreMarketPassed(true); setLimitsTightened(result.tightened); localStorage.setItem('tg-premarket-date', new Date().toISOString().split('T')[0]); }} />
                : <HomeDashboard onLocked={refreshState} limitsTightened={limitsTightened} onNavigate={(page) => setCurrentPage(page as Page)} />
          )}
          {currentPage === 'protection' && (
            <ProtectionPage isLocked={lockState?.isLocked} />
          )}
          {currentPage === 'news' && <NewsBlocker isLocked={lockState?.isLocked} />}
          {currentPage === 'insights' && (
            <>
              <DisciplineScore />
              <StreakRewards streak={0} monthlyAvg={0} />
              <div className="mt-8"><Analytics /></div>
            </>
          )}
          {currentPage === 'review' && <RuleReplay />}
          {currentPage === 'settings' && <AppSettingsPanel isLocked={lockState?.isLocked} />}
          {currentPage === 'simulator' && <TradingSimulator />}
        </div>
      </main>


      {/* Footer */}
      <footer className="relative z-10 px-8 py-2.5 flex justify-between items-center" style={{borderTop: `1px solid ${colors.primary}06`}}>
        <MarketTimer />
        <div className="flex items-center gap-2 opacity-40">
          <Logo size={12} />
          <span className="text-[0.45rem] font-bold tracking-[3px] uppercase" style={{color: colors.primary}}>
            Sentinel
          </span>
        </div>
      </footer>
    </div>
  );
};
