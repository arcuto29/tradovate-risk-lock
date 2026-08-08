import React, { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle, SkipForward, RotateCcw } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

type TestStatus = 'NOT_STARTED' | 'WAITING' | 'DETECTED' | 'PASS' | 'FAIL' | 'SKIPPED';
type Platform = 'TopstepX' | 'Tradovate' | 'TradeSea';

interface CertTest {
  id: string; name: string; instruction: string; expectedBehavior: string;
  status: TestStatus; actualBehavior: string; diagnostics: any[]; timestamp: string | null;
  requiresInjection?: boolean; injectedState?: string;
}

interface CertReport {
  platform: string; date: string; passed: number; failed: number; skipped: number;
  total: number; overallStatus: string; tests: { id: string; name: string; status: TestStatus }[];
}

const STATUS_ICONS: Record<TestStatus, React.ReactNode> = {
  NOT_STARTED: <div className="w-3 h-3 rounded-full bg-white/10 border border-white/20" />,
  WAITING: <Clock size={14} className="text-amber-400 animate-pulse" />,
  DETECTED: <Clock size={14} className="text-cyan-400 animate-pulse" />,
  PASS: <CheckCircle size={14} className="text-emerald-400" />,
  FAIL: <XCircle size={14} className="text-red-400" />,
  SKIPPED: <SkipForward size={14} className="text-white/30" />,
};

export const PlatformCertification: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [tests, setTests] = useState<CertTest[]>([]);
  const [activeTestIndex, setActiveTestIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<CertReport | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [history, setHistory] = useState<CertReport[]>([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const h = await window.electronAPI?.getCertificationHistory?.();
      if (h) setHistory(h);
    } catch {}
  };

  const startCertification = async (platform: Platform) => {
    setSelectedPlatform(platform);
    const t = await window.electronAPI?.startCertification?.(platform);
    if (t) { setTests(t); setActiveTestIndex(0); setRunning(true); setReport(null); }
  };

  const activateTest = async (index: number) => {
    if (index >= tests.length) { finishCertification(); return; }
    setActiveTestIndex(index);
    await window.electronAPI?.activateCertTest?.(tests[index].id);
  };

  const skipTest = async () => {
    const updated = [...tests];
    updated[activeTestIndex].status = 'SKIPPED';
    updated[activeTestIndex].actualBehavior = 'Skipped by tester';
    updated[activeTestIndex].timestamp = new Date().toISOString();
    setTests(updated);
    await window.electronAPI?.skipCertTest?.(tests[activeTestIndex].id);
    activateTest(activeTestIndex + 1);
  };

  const retryTest = async () => {
    const updated = [...tests];
    updated[activeTestIndex].status = 'WAITING';
    updated[activeTestIndex].actualBehavior = '';
    updated[activeTestIndex].diagnostics = [];
    setTests(updated);
    await window.electronAPI?.activateCertTest?.(tests[activeTestIndex].id);
  };

  const manualPass = async () => {
    const updated = [...tests];
    updated[activeTestIndex].status = 'PASS';
    updated[activeTestIndex].actualBehavior = 'Manually verified by tester';
    updated[activeTestIndex].timestamp = new Date().toISOString();
    setTests(updated);
    await window.electronAPI?.manualPassCertTest?.(tests[activeTestIndex].id);
    activateTest(activeTestIndex + 1);
  };

  const finishCertification = async () => {
    setRunning(false);
    const r = await window.electronAPI?.finishCertification?.();
    if (r) { setReport(r); loadHistory(); }
  };

  // Listen for test result updates from the engine
  useEffect(() => {
    if (!running) return;
    const handler = (_: any, data: any) => {
      if (data.testId && data.status) {
        setTests(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(t => t.id === data.testId);
          if (idx >= 0) {
            updated[idx].status = data.status;
            updated[idx].actualBehavior = data.actualBehavior || '';
            updated[idx].timestamp = data.timestamp || new Date().toISOString();
            if (data.diagnostic) updated[idx].diagnostics.push(data.diagnostic);
            // Auto-advance on PASS
            if (data.status === 'PASS' && idx === activeTestIndex) {
              setTimeout(() => activateTest(idx + 1), 1000);
            }
          }
          return updated;
        });
      }
    };
    window.electronAPI?.onCertTestResult?.(handler);
    return () => { window.electronAPI?.offCertTestResult?.(handler); };
  }, [running, activeTestIndex]);

  // Start first test when certification begins
  useEffect(() => {
    if (running && activeTestIndex === 0 && tests.length > 0) {
      activateTest(0);
    }
  }, [running]);

  // ─── Platform Selection ──────────────────────────────────
  if (!selectedPlatform) {
    return (
      <div className="max-w-lg">
        <div className="flex items-center gap-4 mb-2 animate-reveal">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
            <Shield size={18} style={{ color: colors.primary }} />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Platform Certification</h2>
        </div>
        <p className="text-white/30 text-sm mb-2 ml-14 animate-reveal">Validate Sentinel against real trading platforms.</p>
        <div className="ml-14 mb-8 px-4 py-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] animate-reveal">
          <p className="text-amber-300/80 text-xs font-medium">⚠ Use SIM / Demo accounts only. Do not perform certification on a live-money account.</p>
        </div>

        <div className="space-y-3 animate-reveal">
          {(['TopstepX', 'Tradovate', 'TradeSea'] as Platform[]).map(p => (
            <button key={p} onClick={() => startCertification(p)}
              className="w-full relative rounded-xl p-5 overflow-hidden card-premium transition-all hover:border-white/[0.12] press-scale text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white/70">{p}</p>
                  <p className="text-[0.6rem] text-white/25 mt-1">18 tests · ~15 minutes</p>
                </div>
                {history.find(h => h.platform === p) && (
                  <div className={`text-[0.55rem] font-bold uppercase tracking-[1px] px-2 py-1 rounded ${history.find(h => h.platform === p)?.overallStatus === 'CERTIFIED' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                    {history.find(h => h.platform === p)?.overallStatus}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {history.length > 0 && (
          <div className="mt-8 animate-reveal">
            <p className="text-[0.6rem] font-bold tracking-[2px] uppercase text-white/25 mb-3">History</p>
            <div className="space-y-2">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-xs text-white/40">{h.platform}</span>
                  <span className="text-[0.55rem] text-white/20">{new Date(h.date).toLocaleDateString()}</span>
                  <span className={`text-[0.55rem] font-bold ${h.overallStatus === 'CERTIFIED' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {h.passed}/{h.total} {h.overallStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Report View ──────────────────────────────────
  if (report) {
    return (
      <div className="max-w-lg">
        <div className="flex items-center gap-4 mb-6 animate-reveal">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${report.overallStatus === 'CERTIFIED' ? 'bg-emerald-400/10 border border-emerald-400/20' : 'bg-red-400/10 border border-red-400/20'}`}>
            {report.overallStatus === 'CERTIFIED' ? <CheckCircle size={18} className="text-emerald-400" /> : <XCircle size={18} className="text-red-400" />}
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">{report.platform} Certification</h2>
            <p className={`text-sm font-bold ${report.overallStatus === 'CERTIFIED' ? 'text-emerald-400' : 'text-red-400'}`}>{report.overallStatus}</p>
          </div>
        </div>
        <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4 animate-reveal">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold text-emerald-400">{report.passed}</p><p className="text-[0.55rem] text-white/25 uppercase">Passed</p></div>
            <div><p className="text-2xl font-bold text-red-400">{report.failed}</p><p className="text-[0.55rem] text-white/25 uppercase">Failed</p></div>
            <div><p className="text-2xl font-bold text-white/30">{report.skipped}</p><p className="text-[0.55rem] text-white/25 uppercase">Skipped</p></div>
          </div>
        </div>
        <div className="space-y-1 animate-reveal">
          {report.tests.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/[0.02]">
              {STATUS_ICONS[t.status]}
              <span className="text-xs text-white/50 flex-1">{t.name}</span>
              <span className={`text-[0.55rem] font-bold uppercase ${t.status === 'PASS' ? 'text-emerald-400' : t.status === 'FAIL' ? 'text-red-400' : 'text-white/20'}`}>{t.status}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { setSelectedPlatform(null); setReport(null); setTests([]); setActiveTestIndex(-1); }}
          className="mt-6 px-6 py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale">
          Back to Platforms
        </button>
      </div>
    );
  }

  // ─── Active Test Flow ──────────────────────────────────
  const activeTest = tests[activeTestIndex];

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6 animate-reveal">
        <div className="flex items-center gap-3">
          <Shield size={16} style={{ color: colors.primary }} />
          <h2 className="text-xl font-bold text-white">{selectedPlatform} Certification</h2>
        </div>
        <span className="text-[0.6rem] text-white/25">{tests.filter(t => t.status === 'PASS').length}/{tests.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 rounded-full bg-white/[0.05] mb-6">
        <div className="h-full rounded-full transition-all" style={{ width: `${(activeTestIndex / tests.length) * 100}%`, background: colors.primary }} />
      </div>

      {/* Active test card */}
      {activeTest && (
        <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-4 animate-reveal">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)` }} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              {STATUS_ICONS[activeTest.status]}
              <p className="text-[0.6rem] font-bold tracking-[2px] uppercase" style={{ color: `${colors.primary}80` }}>
                Test {activeTestIndex + 1} of {tests.length}
              </p>
            </div>
            <h3 className="text-lg font-bold text-white mb-3">{activeTest.name}</h3>
            <p className="text-sm text-white/50 mb-4 leading-relaxed">{activeTest.instruction}</p>
            
            <div className="mb-4 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[0.55rem] font-bold tracking-[1px] uppercase text-white/25 mb-1">Expected</p>
              <p className="text-xs text-white/40">{activeTest.expectedBehavior}</p>
            </div>

            {activeTest.actualBehavior && (
              <div className={`mb-4 px-4 py-3 rounded-lg border ${activeTest.status === 'PASS' ? 'bg-emerald-400/[0.04] border-emerald-400/20' : activeTest.status === 'FAIL' ? 'bg-red-400/[0.04] border-red-400/20' : 'bg-cyan-400/[0.04] border-cyan-400/20'}`}>
                <p className="text-[0.55rem] font-bold tracking-[1px] uppercase text-white/25 mb-1">Actual</p>
                <p className="text-xs text-white/50">{activeTest.actualBehavior}</p>
              </div>
            )}

            {activeTest.status === 'WAITING' && (
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-xs text-amber-400/70">Waiting for platform activity...</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              {(activeTest.status === 'WAITING' || activeTest.status === 'FAIL') && (
                <button onClick={retryTest} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/40 text-[0.6rem] font-bold uppercase tracking-[1px] press-scale">
                  <RotateCcw size={10} /> Retry
                </button>
              )}
              <button onClick={skipTest} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/40 text-[0.6rem] font-bold uppercase tracking-[1px] press-scale">
                <SkipForward size={10} /> Skip
              </button>
              {(activeTest.status === 'WAITING' || activeTest.id === 'connection' || activeTest.id === 'disconnect_flat' || activeTest.id === 'disconnect_open' || activeTest.id === 'reconnect' || activeTest.id === 'loss_reaction') && (
                <button onClick={manualPass} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/40 text-[0.6rem] font-bold uppercase tracking-[1px] press-scale">
                  <CheckCircle size={10} /> Manual Pass
                </button>
              )}
              {activeTest.status === 'PASS' && (
                <button onClick={() => activateTest(activeTestIndex + 1)} className="px-4 py-2 btn-premium text-[0.6rem] uppercase tracking-[1px] rounded-lg press-scale">
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test list */}
      <div className="space-y-1">
        {tests.map((t, i) => (
          <div key={t.id} onClick={() => setExpandedTest(expandedTest === t.id ? null : t.id)}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all ${i === activeTestIndex ? 'bg-white/[0.04] border border-white/[0.08]' : 'hover:bg-white/[0.02]'}`}>
            {STATUS_ICONS[t.status]}
            <span className={`text-xs flex-1 ${i === activeTestIndex ? 'text-white/70 font-medium' : 'text-white/30'}`}>{t.name}</span>
            {t.diagnostics.length > 0 && <span className="text-[0.5rem] text-white/15">{t.diagnostics.length} events</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
