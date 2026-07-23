import React, { useState, useEffect } from 'react';

const FUTURES_SYMBOLS = [
  // Index
  { symbol: 'NQ', label: 'NQ — Nasdaq 100' },
  { symbol: 'MNQ', label: 'MNQ — Micro Nasdaq 100' },
  { symbol: 'ES', label: 'ES — S&P 500' },
  { symbol: 'MES', label: 'MES — Micro S&P 500' },
  { symbol: 'YM', label: 'YM — Dow Jones' },
  { symbol: 'MYM', label: 'MYM — Micro Dow Jones' },
  { symbol: 'RTY', label: 'RTY — Russell 2000' },
  { symbol: 'M2K', label: 'M2K — Micro Russell 2000' },
  // Energy
  { symbol: 'CL', label: 'CL — Crude Oil' },
  { symbol: 'MCL', label: 'MCL — Micro Crude Oil' },
  { symbol: 'NG', label: 'NG — Natural Gas' },
  { symbol: 'MNG', label: 'MNG — Micro Natural Gas' },
  { symbol: 'HO', label: 'HO — Heating Oil' },
  { symbol: 'RB', label: 'RB — RBOB Gasoline' },
  // Metals
  { symbol: 'GC', label: 'GC — Gold' },
  { symbol: 'MGC', label: 'MGC — Micro Gold' },
  { symbol: 'SI', label: 'SI — Silver' },
  { symbol: 'SIL', label: 'SIL — Micro Silver' },
  { symbol: 'HG', label: 'HG — Copper' },
  { symbol: 'PL', label: 'PL — Platinum' },
  // Bonds
  { symbol: 'ZB', label: 'ZB — 30-Year Bond' },
  { symbol: 'ZN', label: 'ZN — 10-Year Note' },
  { symbol: 'ZF', label: 'ZF — 5-Year Note' },
  { symbol: 'ZT', label: 'ZT — 2-Year Note' },
  // Agriculture
  { symbol: 'ZC', label: 'ZC — Corn' },
  { symbol: 'ZS', label: 'ZS — Soybeans' },
  { symbol: 'ZW', label: 'ZW — Wheat' },
  { symbol: 'ZL', label: 'ZL — Soybean Oil' },
  { symbol: 'ZM', label: 'ZM — Soybean Meal' },
  { symbol: 'CT', label: 'CT — Cotton' },
  { symbol: 'KC', label: 'KC — Coffee' },
  { symbol: 'SB', label: 'SB — Sugar' },
  { symbol: 'CC', label: 'CC — Cocoa' },
  { symbol: 'LE', label: 'LE — Live Cattle' },
  { symbol: 'HE', label: 'HE — Lean Hogs' },
  // Currency
  { symbol: '6E', label: '6E — Euro' },
  { symbol: '6J', label: '6J — Japanese Yen' },
  { symbol: '6B', label: '6B — British Pound' },
  { symbol: '6A', label: '6A — Australian Dollar' },
  { symbol: '6C', label: '6C — Canadian Dollar' },
  { symbol: '6S', label: '6S — Swiss Franc' },
  { symbol: '6N', label: '6N — New Zealand Dollar' },
  // Volatility
  { symbol: 'VX', label: 'VX — VIX Futures' },
];

type SettingPage = 'loss_limit' | 'profit_target' | 'max_trades' | 'blocked_symbols' | 'max_contracts' | 'lockout';

interface ContractLimit {
  symbol: string;
  label: string;
  maxSize: number;
}

interface Props {
  isLocked: boolean;
  onLocked: () => void;
}

const RiskSettings: React.FC<Props> = ({ isLocked, onLocked }) => {
  const [activePage, setActivePage] = useState<SettingPage>('loss_limit');
  const [lockConfirmed, setLockConfirmed] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Loss Limit
  const [lossLimitEnabled, setLossLimitEnabled] = useState(false);
  const [lossLimitAmount, setLossLimitAmount] = useState('');
  const [lossLimitAction, setLossLimitAction] = useState('block');
  const [trailingEnabled, setTrailingEnabled] = useState(false);

  // Profit Target
  const [profitTargetEnabled, setProfitTargetEnabled] = useState(false);
  const [profitTargetAmount, setProfitTargetAmount] = useState('');
  const [profitTargetAction, setProfitTargetAction] = useState('block');

  // Max Trades
  const [maxTradesEnabled, setMaxTradesEnabled] = useState(false);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState('');
  const [maxTradesPerWeek, setMaxTradesPerWeek] = useState('');

  // Blocked Symbols
  const [blockedSymbolsEnabled, setBlockedSymbolsEnabled] = useState(false);
  const [blockedSymbols, setBlockedSymbols] = useState<string[]>([]);

  // Max Contracts
  const [maxContractsEnabled, setMaxContractsEnabled] = useState(false);
  const [contractLimits, setContractLimits] = useState<ContractLimit[]>([]);
  const [defaultMax, setDefaultMax] = useState('');

  // Lockout
  const [lockoutEnabled, setLockoutEnabled] = useState(false);
  const [resetTime, setResetTime] = useState('17:00');
  const [resetTimezone, setResetTimezone] = useState('America/New_York');

  // Dropdown state for blocked symbols
  const [selectedBlockedSymbol, setSelectedBlockedSymbol] = useState('');

  // Dropdown state for contract limits
  const [selectedContractSymbol, setSelectedContractSymbol] = useState('');
  const [selectedContractMax, setSelectedContractMax] = useState('');

  useEffect(() => {
    (window as any).electronAPI?.getPositionLimits?.().then((limits: any) => {
      if (!limits) return;
      if (limits.lossLimitEnabled !== undefined) setLossLimitEnabled(limits.lossLimitEnabled);
      if (limits.lossLimitAmount !== undefined) setLossLimitAmount(String(limits.lossLimitAmount));
      if (limits.lossLimitAction) setLossLimitAction(limits.lossLimitAction);
      if (limits.trailingEnabled !== undefined) setTrailingEnabled(limits.trailingEnabled);
      if (limits.profitTargetEnabled !== undefined) setProfitTargetEnabled(limits.profitTargetEnabled);
      if (limits.profitTargetAmount !== undefined) setProfitTargetAmount(String(limits.profitTargetAmount));
      if (limits.profitTargetAction) setProfitTargetAction(limits.profitTargetAction);
      if (limits.maxTradesEnabled !== undefined) setMaxTradesEnabled(limits.maxTradesEnabled);
      if (limits.maxTradesPerDay !== undefined) setMaxTradesPerDay(String(limits.maxTradesPerDay));
      if (limits.maxTradesPerWeek !== undefined) setMaxTradesPerWeek(String(limits.maxTradesPerWeek));
      if (limits.blockedSymbolsEnabled !== undefined) setBlockedSymbolsEnabled(limits.blockedSymbolsEnabled);
      if (limits.blockedSymbols) setBlockedSymbols(limits.blockedSymbols);
      if (limits.maxContractsEnabled !== undefined) setMaxContractsEnabled(limits.maxContractsEnabled);
      if (limits.contractLimits) setContractLimits(limits.contractLimits);
      if (limits.defaultMax !== undefined) setDefaultMax(String(limits.defaultMax));
      if (limits.lockoutEnabled !== undefined) setLockoutEnabled(limits.lockoutEnabled);
      if (limits.resetTime) setResetTime(limits.resetTime);
      if (limits.resetTimezone) setResetTimezone(limits.resetTimezone);
    });
  }, []);

  useEffect(() => {
    const cleanup = (window as any).electronAPI?.onTradovateSettingsSynced?.((settings: any) => {
      if (!settings) return;
      if (settings.lossLimitAmount !== undefined) setLossLimitAmount(String(settings.lossLimitAmount));
      if (settings.profitTargetAmount !== undefined) setProfitTargetAmount(String(settings.profitTargetAmount));
      if (settings.maxTradesPerDay !== undefined) setMaxTradesPerDay(String(settings.maxTradesPerDay));
      if (settings.blockedSymbols) setBlockedSymbols(settings.blockedSymbols);
      if (settings.contractLimits) setContractLimits(settings.contractLimits);
    });
    return () => cleanup?.();
  }, []);

  const buildPayload = () => ({
    lossLimitEnabled,
    lossLimitAmount: Number(lossLimitAmount) || 0,
    lossLimitAction,
    trailingEnabled,
    profitTargetEnabled,
    profitTargetAmount: Number(profitTargetAmount) || 0,
    profitTargetAction,
    maxTradesEnabled,
    maxTradesPerDay: Number(maxTradesPerDay) || 0,
    maxTradesPerWeek: Number(maxTradesPerWeek) || 0,
    blockedSymbolsEnabled,
    blockedSymbols,
    maxContractsEnabled,
    contractLimits,
    defaultMax: Number(defaultMax) || 0,
    lockoutEnabled,
    resetTime,
    resetTimezone,
  });

  const handleLock = async () => {
    setLocking(true);
    setError('');
    try {
      await (window as any).electronAPI.updatePositionLimits(buildPayload());
      await (window as any).electronAPI.lockSettings();
      onLocked();
    } catch (e: any) {
      setError(e?.message || 'Failed to lock settings');
    } finally {
      setLocking(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSaved(false);
    try {
      await (window as any).electronAPI.updatePositionLimits(buildPayload());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
    }
  };

  const addBlockedSymbol = () => {
    if (selectedBlockedSymbol && !blockedSymbols.includes(selectedBlockedSymbol)) {
      setBlockedSymbols([...blockedSymbols, selectedBlockedSymbol]);
      setSelectedBlockedSymbol('');
    }
  };

  const removeBlockedSymbol = (symbol: string) => {
    setBlockedSymbols(blockedSymbols.filter((s) => s !== symbol));
  };

  const addContractLimit = () => {
    if (selectedContractSymbol && selectedContractMax) {
      const existing = contractLimits.find((c) => c.symbol === selectedContractSymbol);
      if (!existing) {
        const found = FUTURES_SYMBOLS.find((f) => f.symbol === selectedContractSymbol);
        setContractLimits([
          ...contractLimits,
          { symbol: selectedContractSymbol, label: found?.label || selectedContractSymbol, maxSize: Number(selectedContractMax) || 1 },
        ]);
        setSelectedContractSymbol('');
        setSelectedContractMax('');
      }
    }
  };

  const removeContractLimit = (symbol: string) => {
    setContractLimits(contractLimits.filter((c) => c.symbol !== symbol));
  };

  const updateContractMax = (symbol: string, value: string) => {
    setContractLimits(contractLimits.map((c) => (c.symbol === symbol ? { ...c, maxSize: Number(value) || 0 } : c)));
  };

  const inputClass =
    'w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all placeholder:text-white/15 disabled:opacity-30';
  const selectClass =
    'w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all placeholder:text-white/15 disabled:opacity-30 appearance-none cursor-pointer [&>option]:bg-[#0a0a1a] [&>option]:text-white';
  const sectionTitle = 'text-base font-bold text-white mb-2';
  const description = 'text-xs text-white/30 mb-6 max-w-md leading-relaxed';
  const labelClass = 'block text-[0.68rem] text-white/35 mb-1.5';
  const saveBtn =
    'mt-6 px-5 py-2.5 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-[0.62rem] font-semibold uppercase tracking-[1.5px] rounded-lg hover:bg-cyan-400/20 transition-all';
  const lockBtn =
    'w-full py-2.5 bg-cyan-400 text-black text-[0.62rem] font-bold uppercase tracking-[2px] rounded-lg hover:bg-cyan-300 transition-all disabled:opacity-10 btn-glow';

  const sidebarPages: { key: SettingPage; label: string; enabled: boolean }[] = [
    { key: 'loss_limit', label: 'Loss Limit', enabled: lossLimitEnabled },
    { key: 'profit_target', label: 'Profit Target', enabled: profitTargetEnabled },
    { key: 'max_trades', label: 'Max Trades', enabled: maxTradesEnabled },
    { key: 'blocked_symbols', label: 'Blocked Symbols', enabled: blockedSymbolsEnabled },
    { key: 'max_contracts', label: 'Max Contracts', enabled: maxContractsEnabled },
    { key: 'lockout', label: 'Lockout', enabled: lockoutEnabled },
  ];

  const filteredBlockedSymbols = FUTURES_SYMBOLS.filter((f) => !blockedSymbols.includes(f.symbol));
  const filteredContractSymbols = FUTURES_SYMBOLS.filter((f) => !contractLimits.find((c) => c.symbol === f.symbol));

  const renderRightPanel = () => {
    switch (activePage) {
      case 'loss_limit':
        return (
          <div className="animate-reveal">
            <h2 className={sectionTitle}>Personal Daily Loss Limit</h2>
            <p className={description}>
              Set a maximum dollar amount you are willing to lose per day. When this limit is reached, trading will be blocked or you will be warned depending on the action selected.
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Amount ($)</label>
                <input
                  type="number"
                  className={inputClass}
                  value={lossLimitAmount}
                  onChange={(e) => setLossLimitAmount(e.target.value)}
                  placeholder="e.g. 500"
                  disabled={isLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Action</label>
                <select className={selectClass} value={lossLimitAction} onChange={(e) => setLossLimitAction(e.target.value)} disabled={isLocked}>
                  <option value="block">Block Trading</option>
                  <option value="warn">Warn Only</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={trailingEnabled}
                  onChange={(e) => setTrailingEnabled(e.target.checked)}
                  disabled={isLocked}
                  className="accent-cyan-400"
                />
                <span className="text-xs text-white/50">Enable trailing (locks in gains)</span>
              </div>
            </div>
            <button className={saveBtn} onClick={handleSave} disabled={isLocked}>
              Save
            </button>
          </div>
        );

      case 'profit_target':
        return (
          <div className="animate-reveal">
            <h2 className={sectionTitle}>Personal Daily Profit Target</h2>
            <p className={description}>
              Set a daily profit target. When reached, you can choose to stop trading for the day or simply receive a notification.
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Amount ($)</label>
                <input
                  type="number"
                  className={inputClass}
                  value={profitTargetAmount}
                  onChange={(e) => setProfitTargetAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  disabled={isLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Action</label>
                <select className={selectClass} value={profitTargetAction} onChange={(e) => setProfitTargetAction(e.target.value)} disabled={isLocked}>
                  <option value="block">Block Trading</option>
                  <option value="warn">Warn Only</option>
                </select>
              </div>
            </div>
            <button className={saveBtn} onClick={handleSave} disabled={isLocked}>
              Save
            </button>
          </div>
        );

      case 'max_trades':
        return (
          <div className="animate-reveal">
            <h2 className={sectionTitle}>Max Trades</h2>
            <p className={description}>
              Limit the number of trades you can take per day or per week. Helps prevent overtrading and revenge trading.
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Per Day</label>
                <input
                  type="number"
                  className={inputClass}
                  value={maxTradesPerDay}
                  onChange={(e) => setMaxTradesPerDay(e.target.value)}
                  placeholder="e.g. 5"
                  disabled={isLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Per Week</label>
                <input
                  type="number"
                  className={inputClass}
                  value={maxTradesPerWeek}
                  onChange={(e) => setMaxTradesPerWeek(e.target.value)}
                  placeholder="e.g. 20"
                  disabled={isLocked}
                />
              </div>
            </div>
            <button className={saveBtn} onClick={handleSave} disabled={isLocked}>
              Save
            </button>
          </div>
        );

      case 'blocked_symbols':
        return (
          <div className="animate-reveal">
            <h2 className={sectionTitle}>Blocked Symbols</h2>
            <p className={description}>
              Block specific futures symbols from being traded. Orders for these symbols will be rejected.
            </p>
            <div className="flex gap-2 mb-4">
              <select
                className={selectClass}
                value={selectedBlockedSymbol}
                onChange={(e) => setSelectedBlockedSymbol(e.target.value)}
                disabled={isLocked}
              >
                <option value="">Select symbol...</option>
                {filteredBlockedSymbols.map((f) => (
                  <option key={f.symbol} value={f.symbol}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                className="px-4 py-2 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold rounded-lg hover:bg-cyan-400/20 transition-all disabled:opacity-30"
                onClick={addBlockedSymbol}
                disabled={isLocked || !selectedBlockedSymbol}
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {blockedSymbols.map((symbol) => {
                const found = FUTURES_SYMBOLS.find((f) => f.symbol === symbol);
                return (
                  <div key={symbol} className="flex items-center justify-between py-2.5 px-3 bg-white/[0.02] rounded-lg">
                    <span className="text-sm text-white/70">{found?.label || symbol}</span>
                    {!isLocked && (
                      <button className="text-white/30 hover:text-red-400 transition-colors text-sm" onClick={() => removeBlockedSymbol(symbol)}>
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button className={saveBtn} onClick={handleSave} disabled={isLocked}>
              Save
            </button>
          </div>
        );

      case 'max_contracts':
        return (
          <div className="animate-reveal">
            <h2 className={sectionTitle}>Max Contracts</h2>
            <p className={description}>
              Limit the maximum contract size per symbol. Prevents oversizing positions on specific instruments.
            </p>
            <div className="flex gap-2 mb-4">
              <select
                className={selectClass}
                value={selectedContractSymbol}
                onChange={(e) => setSelectedContractSymbol(e.target.value)}
                disabled={isLocked}
              >
                <option value="">Select symbol...</option>
                {filteredContractSymbols.map((f) => (
                  <option key={f.symbol} value={f.symbol}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className={inputClass + ' !w-24'}
                value={selectedContractMax}
                onChange={(e) => setSelectedContractMax(e.target.value)}
                placeholder="Max"
                disabled={isLocked}
              />
              <button
                className="px-4 py-2 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold rounded-lg hover:bg-cyan-400/20 transition-all disabled:opacity-30"
                onClick={addContractLimit}
                disabled={isLocked || !selectedContractSymbol || !selectedContractMax}
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {contractLimits.map((cl) => (
                <div key={cl.symbol} className="flex items-center justify-between py-2.5 px-3 bg-white/[0.02] rounded-lg">
                  <span className="text-sm text-white/70">{cl.label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-16 bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-white text-sm text-center focus:border-cyan-400/50 focus:outline-none disabled:opacity-30"
                      value={cl.maxSize}
                      onChange={(e) => updateContractMax(cl.symbol, e.target.value)}
                      disabled={isLocked}
                    />
                    {!isLocked && (
                      <button className="text-white/30 hover:text-red-400 transition-colors text-sm" onClick={() => removeContractLimit(cl.symbol)}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button className={saveBtn} onClick={handleSave} disabled={isLocked}>
              Save
            </button>
          </div>
        );

      case 'lockout':
        return (
          <div className="animate-reveal">
            <h2 className={sectionTitle}>Lockout Options</h2>
            <p className={description}>
              Configure when the daily reset occurs. After a lockout, trading will resume at the reset time in the selected timezone.
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Reset Time</label>
                <input
                  type="time"
                  className={inputClass}
                  value={resetTime}
                  onChange={(e) => setResetTime(e.target.value)}
                  disabled={isLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Timezone</label>
                <select className={selectClass} value={resetTimezone} onChange={(e) => setResetTimezone(e.target.value)} disabled={isLocked}>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
            <button className={saveBtn} onClick={handleSave} disabled={isLocked}>
              Save
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-row h-full">
      {/* Sidebar */}
      <div className="w-52 flex flex-col border-r border-white/[0.04] p-4">
        <div className="mb-4">
          <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Settings</h3>
          <span className={`text-[0.6rem] font-semibold uppercase tracking-wider ${isLocked ? 'text-cyan-400' : 'text-white/25'}`}>
            {isLocked ? 'LOCKED' : 'UNLOCKED'}
          </span>
        </div>

        <div className="flex-1 space-y-0.5">
          {sidebarPages.map((page) => (
            <button
              key={page.key}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activePage === page.key ? 'bg-cyan-400/[0.07] text-cyan-300' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
              }`}
              onClick={() => setActivePage(page.key)}
            >
              <span>{page.label}</span>
              <span className={`text-[0.6rem] font-bold ${page.enabled ? 'text-cyan-400' : 'text-white/15'}`}>
                {page.enabled ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}
        </div>

        {!isLocked && (
          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lockConfirmed}
                onChange={(e) => setLockConfirmed(e.target.checked)}
                className="accent-cyan-400"
              />
              <span className="text-[0.62rem] text-white/40">I confirm lock</span>
            </label>
            <button className={lockBtn} disabled={!lockConfirmed || locking} onClick={handleLock}>
              {locking ? 'Locking...' : 'Lock Settings'}
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-[0.6rem] text-red-400">{error}</p>}
        {saved && <p className="mt-2 text-[0.6rem] text-emerald-400">Saved</p>}
      </div>

      {/* Right Panel */}
      <div className="flex-1 p-6 overflow-y-auto">{renderRightPanel()}</div>
    </div>
  );
};

export default RiskSettings;
