import React, { useState, useEffect } from 'react';

const FUTURES_SYMBOLS = [
  { symbol: 'NQ', label: 'NQ — Nasdaq 100' },
  { symbol: 'MNQ', label: 'MNQ — Micro Nasdaq 100' },
  { symbol: 'ES', label: 'ES — S&P 500' },
  { symbol: 'MES', label: 'MES — Micro S&P 500' },
  { symbol: 'YM', label: 'YM — Dow Jones' },
  { symbol: 'MYM', label: 'MYM — Micro Dow Jones' },
  { symbol: 'RTY', label: 'RTY — Russell 2000' },
  { symbol: 'M2K', label: 'M2K — Micro Russell 2000' },
  { symbol: 'CL', label: 'CL — Crude Oil' },
  { symbol: 'MCL', label: 'MCL — Micro Crude Oil' },
  { symbol: 'NG', label: 'NG — Natural Gas' },
  { symbol: 'MNG', label: 'MNG — Micro Natural Gas' },
  { symbol: 'HO', label: 'HO — Heating Oil' },
  { symbol: 'RB', label: 'RB — RBOB Gasoline' },
  { symbol: 'GC', label: 'GC — Gold' },
  { symbol: 'MGC', label: 'MGC — Micro Gold' },
  { symbol: 'SI', label: 'SI — Silver' },
  { symbol: 'SIL', label: 'SIL — Micro Silver' },
  { symbol: 'HG', label: 'HG — Copper' },
  { symbol: 'PL', label: 'PL — Platinum' },
  { symbol: 'ZB', label: 'ZB — 30-Year Bond' },
  { symbol: 'ZN', label: 'ZN — 10-Year Note' },
  { symbol: 'ZF', label: 'ZF — 5-Year Note' },
  { symbol: 'ZT', label: 'ZT — 2-Year Note' },
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
  { symbol: '6E', label: '6E — Euro' },
  { symbol: '6J', label: '6J — Japanese Yen' },
  { symbol: '6B', label: '6B — British Pound' },
  { symbol: '6A', label: '6A — Australian Dollar' },
  { symbol: '6C', label: '6C — Canadian Dollar' },
  { symbol: '6S', label: '6S — Swiss Franc' },
  { symbol: '6N', label: '6N — New Zealand Dollar' },
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
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [lossLimitEnabled, setLossLimitEnabled] = useState(false);
  const [lossLimitAmount, setLossLimitAmount] = useState('');
  const [profitTargetEnabled, setProfitTargetEnabled] = useState(false);
  const [profitTargetAmount, setProfitTargetAmount] = useState('');
  const [maxTradesEnabled, setMaxTradesEnabled] = useState(false);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState('');
  const [blockedSymbolsEnabled, setBlockedSymbolsEnabled] = useState(false);
  const [blockedSymbols, setBlockedSymbols] = useState<string[]>([]);
  const [maxContractsEnabled, setMaxContractsEnabled] = useState(false);
  const [contractLimits, setContractLimits] = useState<ContractLimit[]>([]);
  const [defaultMax, setDefaultMax] = useState('');
  const [pyramidingEnabled, setPyramidingEnabled] = useState(false);
  const [pyramidMaxContracts, setPyramidMaxContracts] = useState('');
  const [pyramidMaxAddOns, setPyramidMaxAddOns] = useState('');
  const [lockoutEnabled, setLockoutEnabled] = useState(false);
  const [resetTime, setResetTime] = useState('17:00');
  const [resetTimezone, setResetTimezone] = useState('America/New_York');
  const [lockMode, setLockMode] = useState<'time' | 'duration'>('time');
  const [lockDurationHours, setLockDurationHours] = useState('4');
  const [selectedBlockedSymbol, setSelectedBlockedSymbol] = useState('');
  const [selectedContractSymbol, setSelectedContractSymbol] = useState('');
  const [selectedContractMax, setSelectedContractMax] = useState('');

  useEffect(() => {
    (window as any).electronAPI?.getPositionLimits?.().then((limits: any) => {
      if (!limits) return;
      if (limits.lossLimitEnabled !== undefined) setLossLimitEnabled(limits.lossLimitEnabled);
      if (limits.lossLimitAmount !== undefined) setLossLimitAmount(String(limits.lossLimitAmount));
      if (limits.profitTargetEnabled !== undefined) setProfitTargetEnabled(limits.profitTargetEnabled);
      if (limits.profitTargetAmount !== undefined) setProfitTargetAmount(String(limits.profitTargetAmount));
      if (limits.maxTradesEnabled !== undefined) setMaxTradesEnabled(limits.maxTradesEnabled);
      if (limits.maxTradesPerDay !== undefined) setMaxTradesPerDay(String(limits.maxTradesPerDay));
      if (limits.blockedSymbolsEnabled !== undefined) setBlockedSymbolsEnabled(limits.blockedSymbolsEnabled);
      if (limits.blockedSymbols) setBlockedSymbols(limits.blockedSymbols);
      if (limits.maxContractsEnabled !== undefined) setMaxContractsEnabled(limits.maxContractsEnabled);
      if (limits.contractLimits) setContractLimits(limits.contractLimits);
      if (limits.defaultMax !== undefined) setDefaultMax(String(limits.defaultMax));
      if (limits.pyramidingEnabled !== undefined) setPyramidingEnabled(limits.pyramidingEnabled);
      if (limits.pyramidMaxContracts !== undefined) setPyramidMaxContracts(String(limits.pyramidMaxContracts));
      if (limits.pyramidMaxAddOns !== undefined) setPyramidMaxAddOns(String(limits.pyramidMaxAddOns));
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
    });
    return () => cleanup?.();
  }, []);


  const buildPayload = () => ({
    lossLimitEnabled,
    lossLimitAmount: Number(lossLimitAmount) || 0,
    profitTargetEnabled,
    profitTargetAmount: Number(profitTargetAmount) || 0,
    maxTradesEnabled,
    maxTradesPerDay: Number(maxTradesPerDay) || 0,
    blockedSymbolsEnabled,
    blockedSymbols,
    maxContractsEnabled,
    contractLimits,
    defaultMax: Number(defaultMax) || 0,
    pyramidingEnabled,
    pyramidMaxContracts: Number(pyramidMaxContracts) || 0,
    pyramidMaxAddOns: Number(pyramidMaxAddOns) || 0,
    lockoutEnabled,
    resetTime,
    resetTimezone,
  });

  const handleLock = async () => {
    setLocking(true);
    setError('');
    try {
      await (window as any).electronAPI.updatePositionLimits(buildPayload());
      
      // Calculate reset time based on lock mode
      let finalResetTime = resetTime;
      if (lockMode === 'duration') {
        const hours = Number(lockDurationHours) || 4;
        const unlockAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        finalResetTime = unlockAt.getHours().toString().padStart(2, '0') + ':' + unlockAt.getMinutes().toString().padStart(2, '0');
      }
      
      const lockSettings = {
        dailyLossLimit: Number(lossLimitAmount) || 0,
        dailyProfitTarget: Number(profitTargetAmount) || 0,
        maxContracts: Number(defaultMax) || (contractLimits.length > 0 ? Math.min(...contractLimits.map(c => c.maxSize)) : 0),
        resetTime: finalResetTime,
        resetTimezone,
        platform: 'web',
      };
      const result = await (window as any).electronAPI.lockSettings(lockSettings);
      if (result.success) onLocked();
      else setError(result.error || 'Failed to lock');
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
    'w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.08),0_0_15px_rgba(56,189,248,0.1)] focus:outline-none transition-all placeholder:text-white/15 disabled:opacity-30 input-premium';
  const selectClass =
    'w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.08),0_0_15px_rgba(56,189,248,0.1)] focus:outline-none transition-all placeholder:text-white/15 disabled:opacity-30 appearance-none cursor-pointer [&>option]:bg-[#0a0a1a] [&>option]:text-white input-premium';

  const sidebarPages: { key: SettingPage; label: string; enabled: boolean; icon: string }[] = [
    { key: 'loss_limit', label: 'Loss Limit', enabled: lossLimitEnabled, icon: '↓' },
    { key: 'profit_target', label: 'Profit Target', enabled: profitTargetEnabled, icon: '↑' },
    { key: 'max_trades', label: 'Max Trades', enabled: maxTradesEnabled, icon: '#' },
    { key: 'blocked_symbols', label: 'Blocked', enabled: blockedSymbolsEnabled, icon: '⊘' },
    { key: 'max_contracts', label: 'Contracts', enabled: maxContractsEnabled, icon: '▣' },
    { key: 'lockout', label: 'Lockout', enabled: lockoutEnabled, icon: '⏱' },
  ];

  const filteredBlockedSymbols = FUTURES_SYMBOLS.filter((f) => !blockedSymbols.includes(f.symbol));
  const filteredContractSymbols = FUTURES_SYMBOLS.filter((f) => !contractLimits.find((c) => c.symbol === f.symbol));


  const renderRightPanel = () => {
    switch (activePage) {
      case 'loss_limit':
        return (
          <div className="animate-reveal">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-sm">↓</div>
              <h2 className="text-xl font-bold text-gradient">Daily Loss Limit</h2>
            </div>
            <p className="text-white/30 text-xs mb-8 leading-relaxed ml-11">Maximum dollar amount you can lose per day. Trading blocked when hit.</p>
            <div className="relative rounded-xl p-6 overflow-hidden card-premium">
              <div className="relative z-10 space-y-4">
                <div>
                  <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">Amount ($)</label>
                  <input type="number" className={inputClass} value={lossLimitAmount} onChange={(e) => setLossLimitAmount(e.target.value)} placeholder="e.g. 500" disabled={isLocked} />
                </div>
              </div>
            </div>
            <button className="mt-6 px-6 py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale" onClick={handleSave} disabled={isLocked}>Save</button>
          </div>
        );

      case 'profit_target':
        return (
          <div className="animate-reveal">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">↑</div>
              <h2 className="text-xl font-bold text-gradient">Daily Profit Target</h2>
            </div>
            <p className="text-white/30 text-xs mb-8 leading-relaxed ml-11">When reached, trading blocked to protect profits.</p>
            <div className="relative rounded-xl p-6 overflow-hidden card-premium">
              <div className="relative z-10 space-y-4">
                <div>
                  <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">Amount ($)</label>
                  <input type="number" className={inputClass} value={profitTargetAmount} onChange={(e) => setProfitTargetAmount(e.target.value)} placeholder="e.g. 1000" disabled={isLocked} />
                </div>
              </div>
            </div>
            <button className="mt-6 px-6 py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale" onClick={handleSave} disabled={isLocked}>Save</button>
          </div>
        );

      case 'max_trades':
        return (
          <div className="animate-reveal">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-sm">#</div>
              <h2 className="text-xl font-bold text-gradient">Max Trades</h2>
            </div>
            <p className="text-white/30 text-xs mb-8 leading-relaxed ml-11">Prevents overtrading and revenge trading.</p>
            <div className="relative rounded-xl p-6 overflow-hidden card-premium">
              <div className="relative z-10 space-y-4">
                <div>
                  <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">Per Day</label>
                  <input type="number" className={inputClass} value={maxTradesPerDay} onChange={(e) => setMaxTradesPerDay(e.target.value)} placeholder="e.g. 5" disabled={isLocked} />
                </div>
              </div>
            </div>
            <button className="mt-6 px-6 py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale" onClick={handleSave} disabled={isLocked}>Save</button>
          </div>
        );


      case 'blocked_symbols':
        return (
          <div className="animate-reveal">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-sm">⊘</div>
              <h2 className="text-xl font-bold text-gradient">Blocked Symbols</h2>
            </div>
            <p className="text-white/30 text-xs mb-8 leading-relaxed ml-11">Orders for these symbols will be rejected.</p>
            <div className="relative rounded-xl p-6 overflow-hidden card-premium">
              <div className="relative z-10">
                <div className="flex gap-2 mb-5">
                  <select className={selectClass} value={selectedBlockedSymbol} onChange={(e) => setSelectedBlockedSymbol(e.target.value)} disabled={isLocked}>
                    <option value="">Select symbol...</option>
                    {filteredBlockedSymbols.map((f) => (<option key={f.symbol} value={f.symbol}>{f.label}</option>))}
                  </select>
                  <button className="px-5 py-2 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-bold rounded-xl hover:bg-cyan-400/20 hover:border-cyan-400/40 transition-all disabled:opacity-30 press-scale" onClick={addBlockedSymbol} disabled={isLocked || !selectedBlockedSymbol}>Add</button>
                </div>
                <div className="space-y-2">
                  {blockedSymbols.map((symbol) => {
                    const found = FUTURES_SYMBOLS.find((f) => f.symbol === symbol);
                    return (
                      <div key={symbol} className="flex items-center justify-between py-3 px-4 bg-white/[0.02] rounded-xl border border-white/[0.04] hover:border-amber-400/20 transition-all group">
                        <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">{found?.label || symbol}</span>
                        {!isLocked && (
                          <button className="text-white/20 hover:text-red-400 transition-colors text-sm press-scale" onClick={() => removeBlockedSymbol(symbol)}>✕</button>
                        )}
                      </div>
                    );
                  })}
                  {blockedSymbols.length === 0 && <p className="text-xs text-white/15 text-center py-4">No symbols blocked</p>}
                </div>
              </div>
            </div>
            <button className="mt-6 px-6 py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale" onClick={handleSave} disabled={isLocked}>Save</button>
          </div>
        );


      case 'max_contracts':
        return (
          <div className="animate-reveal">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm">▣</div>
              <h2 className="text-xl font-bold text-gradient">Max Contracts</h2>
            </div>
            <p className="text-white/30 text-xs mb-8 leading-relaxed ml-11">Limit position size per symbol.</p>
            <div className="relative rounded-xl p-6 overflow-hidden card-premium">
              <div className="relative z-10">
                <div className="flex gap-2 mb-5">
                  <select className={selectClass} value={selectedContractSymbol} onChange={(e) => setSelectedContractSymbol(e.target.value)} disabled={isLocked}>
                    <option value="">Select symbol...</option>
                    {filteredContractSymbols.map((f) => (<option key={f.symbol} value={f.symbol}>{f.label}</option>))}
                  </select>
                  <input type="number" min="1" max="100" className={inputClass + ' !w-24'} value={selectedContractMax} onChange={(e) => setSelectedContractMax(e.target.value)} placeholder="Max" disabled={isLocked} />
                  <button className="px-5 py-2 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-bold rounded-xl hover:bg-cyan-400/20 hover:border-cyan-400/40 transition-all disabled:opacity-30 press-scale" onClick={addContractLimit} disabled={isLocked || !selectedContractSymbol || !selectedContractMax}>Add</button>
                </div>
                <div className="space-y-2">
                  {contractLimits.map((cl) => (
                    <div key={cl.symbol} className="flex items-center justify-between py-3 px-4 bg-white/[0.02] rounded-xl border border-white/[0.04] hover:border-cyan-400/20 transition-all group">
                      <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">{cl.label}</span>
                      <div className="flex items-center gap-3">
                        <input type="number" min="1" max="100" className="w-16 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white text-sm text-center focus:border-cyan-400/50 focus:outline-none disabled:opacity-30 font-mono font-bold" value={cl.maxSize} onChange={(e) => updateContractMax(cl.symbol, e.target.value)} disabled={isLocked} />
                        {!isLocked && (
                          <button className="text-white/20 hover:text-red-400 transition-colors text-sm press-scale" onClick={() => removeContractLimit(cl.symbol)}>✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {contractLimits.length === 0 && <p className="text-xs text-white/15 text-center py-4">No limits set</p>}
                </div>
              </div>
            </div>

            {/* Pyramiding */}
            <div className="relative rounded-xl p-6 overflow-hidden card-premium mt-5">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400/60 text-sm">📐</span>
                    <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-purple-400/60">Pyramiding</p>
                  </div>
                  <div
                    className={`toggle-premium ${pyramidingEnabled ? 'active' : ''}`}
                    onClick={() => !isLocked && setPyramidingEnabled(!pyramidingEnabled)}
                    style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                  />
                </div>
                <p className="text-xs text-white/20 mb-4">
                  {pyramidingEnabled
                    ? 'Scaling into positions allowed within limits below.'
                    : 'Stacking blocked. One entry per symbol. Cannot add to positions.'}
                </p>

                {pyramidingEnabled && (
                  <div className="space-y-4 pt-3 border-t border-white/[0.04]">
                    <div>
                      <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Max total contracts per position</label>
                      <input type="number" min="1" max="50" className={inputClass + ' !w-24'} value={pyramidMaxContracts} onChange={(e) => setPyramidMaxContracts(e.target.value)} placeholder="e.g. 3" disabled={isLocked} />
                      <p className="text-[0.6rem] text-white/15 mt-1">Total size you can build up to</p>
                    </div>
                    <div>
                      <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Max add-ons</label>
                      <input type="number" min="1" max="10" className={inputClass + ' !w-24'} value={pyramidMaxAddOns} onChange={(e) => setPyramidMaxAddOns(e.target.value)} placeholder="e.g. 2" disabled={isLocked} />
                      <p className="text-[0.6rem] text-white/15 mt-1">How many times you can add to a position</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button className="mt-6 px-6 py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale" onClick={handleSave} disabled={isLocked}>Save</button>
          </div>
        );


      case 'lockout':
        return (
          <div className="animate-reveal">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm">⏱</div>
              <h2 className="text-xl font-bold text-gradient">Lockout Options</h2>
            </div>
            <p className="text-white/30 text-xs mb-8 leading-relaxed ml-11">Choose how long to lock.</p>
            <div className="relative rounded-xl p-6 overflow-hidden card-premium">
              <div className="relative z-10 space-y-5">
                {/* Mode selector */}
                <div>
                  <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-3">Lock Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => !isLocked && setLockMode('duration')}
                      disabled={isLocked}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-[1px] transition-all press-scale ${
                        lockMode === 'duration'
                          ? 'btn-premium'
                          : 'bg-white/[0.03] border border-white/[0.08] text-white/30'
                      }`}
                    >
                      For X hours
                    </button>
                    <button
                      onClick={() => !isLocked && setLockMode('time')}
                      disabled={isLocked}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-[1px] transition-all press-scale ${
                        lockMode === 'time'
                          ? 'btn-premium'
                          : 'bg-white/[0.03] border border-white/[0.08] text-white/30'
                      }`}
                    >
                      Until time
                    </button>
                  </div>
                </div>

                {/* Duration mode */}
                {lockMode === 'duration' && (
                  <div>
                    <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">Lock for (hours)</label>
                    <div className="flex gap-2 mb-3">
                      {['1', '2', '4', '8'].map((h) => (
                        <button
                          key={h}
                          onClick={() => !isLocked && setLockDurationHours(h)}
                          disabled={isLocked}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all press-scale ${
                            lockDurationHours === h
                              ? 'btn-premium'
                              : 'bg-white/[0.03] border border-white/[0.08] text-white/30'
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                    <input type="number" min="1" max="24" className={inputClass + ' !w-24'} value={lockDurationHours} onChange={(e) => setLockDurationHours(e.target.value)} placeholder="4" disabled={isLocked} />
                    <p className="text-[0.6rem] text-white/15 mt-2">Unlocks {lockDurationHours} hours from when you lock</p>
                  </div>
                )}

                {/* Time mode */}
                {lockMode === 'time' && (
                  <>
                    <div>
                      <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">Unlock At</label>
                      <input type="time" className={inputClass} value={resetTime} onChange={(e) => setResetTime(e.target.value)} disabled={isLocked} />
                    </div>
                    <div>
                      <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">Timezone</label>
                      <select className={selectClass} value={resetTimezone} onChange={(e) => setResetTimezone(e.target.value)} disabled={isLocked}>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
            <button className="mt-6 px-6 py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale" onClick={handleSave} disabled={isLocked}>Save</button>
          </div>
        );

      default:
        return null;
    }
  };


  return (
    <div className="flex flex-row h-full">
      {/* Sidebar */}
      <div className="w-56 flex flex-col border-r border-white/[0.04] p-5">
        <div className="mb-6">
          <h3 className="text-[0.6rem] font-bold tracking-[3px] uppercase text-white/40 mb-2">Risk Controls</h3>
          <span className={`inline-flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
            isLocked
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-white/[0.03] border border-white/[0.06] text-white/25'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-white/20'}`} />
            {isLocked ? 'ACTIVE' : 'UNLOCKED'}
          </span>
        </div>

        <div className="flex-1 space-y-1">
          {sidebarPages.map((page, i) => (
            <button
              key={page.key}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-all animate-slide-in ${
                activePage === page.key
                  ? 'bg-gradient-to-r from-cyan-500/[0.08] to-purple-500/[0.05] text-white border border-cyan-400/15 shadow-[0_0_15px_rgba(56,189,248,0.05)] sidebar-active'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[0.02]'
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => setActivePage(page.key)}
            >
              <span className={`text-base ${activePage === page.key ? 'opacity-100' : 'opacity-40'}`}>{page.icon}</span>
              <span className="flex-1 text-left">{page.label}</span>
              <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                page.enabled
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                  : 'bg-white/10'
              }`} />
            </button>
          ))}
        </div>

        {!isLocked && (
          <div className="mt-5 pt-5 border-t border-white/[0.04]">
            <button className="w-full py-3 btn-premium text-[0.6rem] font-bold uppercase tracking-[2.5px] rounded-xl press-scale" disabled={locking} onClick={handleLock}>
              {locking ? 'Locking...' : 'Lock & Activate'}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-[0.6rem] text-red-400 animate-reveal">{error}</p>}
        {saved && <p className="mt-3 text-[0.6rem] text-emerald-400 animate-reveal">Saved</p>}
      </div>

      {/* Right Panel */}
      <div className="flex-1 p-8 overflow-y-auto">{renderRightPanel()}</div>
    </div>
  );
};

export default RiskSettings;
