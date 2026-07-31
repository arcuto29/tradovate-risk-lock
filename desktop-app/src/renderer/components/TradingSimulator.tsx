import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface SimTrade {
  id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  pnl: number;
  time: string;
  blocked: boolean;
  reason?: string;
}

export const TradingSimulator: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [connected, setConnected] = useState(false);
  const [locked, setLocked] = useState(false);
  const [symbol, setSymbol] = useState('NQ');
  const [size, setSize] = useState(1);
  const [dailyPnL, setDailyPnL] = useState(0);
  const [trades, setTrades] = useState<SimTrade[]>([]);
  const [tiltScore, setTiltScore] = useState(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);
  const [lastAction, setLastAction] = useState('');
  const [autoRunning, setAutoRunning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const autoRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to the desktop app's WebSocket server (same as extension does)
  useEffect(() => {
    connectWS();
    return () => { wsRef.current?.close(); if (autoRef.current) clearInterval(autoRef.current); };
  }, []);

  const connectWS = () => {
    try {
      const ws = new WebSocket('ws://127.0.0.1:47392');
      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'check_lock' }));
        setLastAction('Connected to Trading Guardian');
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'connected' || msg.type === 'lock_state') {
            setLocked(msg.locked);
          }
          if (msg.type === 'lock_state_changed') {
            setLocked(msg.locked);
          }
          if (msg.type === 'bypass_recorded') {
            setLastAction('Bypass attempt recorded by desktop app');
          }
        } catch {}
      };
      ws.onclose = () => { setConnected(false); setTimeout(connectWS, 3000); };
      ws.onerror = () => { setConnected(false); };
      wsRef.current = ws;
    } catch { setConnected(false); }
  };

  const simulateOrder = (side: 'BUY' | 'SELL', forceBlock?: string) => {
    const trade: SimTrade = {
      id: Date.now(),
      symbol,
      side,
      size,
      pnl: 0,
      time: new Date().toLocaleTimeString(),
      blocked: false,
    };

    if (forceBlock) {
      trade.blocked = true;
      trade.reason = forceBlock;
      setLastAction(`BLOCKED: ${forceBlock}`);
      // Report bypass to desktop app
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'report_bypass', details: forceBlock }));
      }
    } else {
      setTradeCount(c => c + 1);
      setLastAction(`${side} ${size} ${symbol} - Order placed`);
    }

    setTrades(prev => [trade, ...prev].slice(0, 20));
  };

  const simulateLoss = (amount: number) => {
    const newPnL = dailyPnL - amount;
    setDailyPnL(newPnL);
    setConsecutiveLosses(c => c + 1);
    setLastAction(`Loss: -$${amount} (Daily P&L: $${newPnL})`);

    // Send tilt update
    const newTilt = Math.min(100, tiltScore + 15);
    setTiltScore(newTilt);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'tilt_update',
        score: newTilt,
        level: newTilt >= 61 ? 'red' : newTilt >= 31 ? 'yellow' : 'green',
        blocked: newTilt >= 61,
      }));
    }
  };

  const simulateWin = (amount: number) => {
    const newPnL = dailyPnL + amount;
    setDailyPnL(newPnL);
    setConsecutiveLosses(0);
    setTiltScore(s => Math.max(0, s - 10));
    setLastAction(`Win: +$${amount} (Daily P&L: $${newPnL})`);
  };

  const simulateOversizeBlock = () => {
    simulateOrder('BUY', `Position size ${size + 5} exceeds max for ${symbol}`);
  };

  const simulateSessionBlock = () => {
    simulateOrder('BUY', 'Outside trading hours - SESSION BLOCKED');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'report_bypass', details: 'Attempted trade outside session hours' }));
    }
  };

  const simulateNewsBlock = () => {
    simulateOrder('BUY', 'Trading blocked - major news event window active');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'report_bypass', details: 'Attempted trade during news blackout' }));
    }
  };

  const simulateSymbolBlock = () => {
    simulateOrder('BUY', `Symbol ${symbol} is blocked`);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'report_bypass', details: `Attempted trade on blocked symbol: ${symbol}` }));
    }
  };

  const simulateTiltBlock = () => {
    setTiltScore(85);
    simulateOrder('BUY', 'TILT DETECTED - Score 85/100 - Orders blocked');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'tilt_update', score: 85, level: 'red', blocked: true }));
    }
  };

  const simulateRapidFire = () => {
    setLastAction('Simulating 5 rapid orders...');
    let i = 0;
    const interval = setInterval(() => {
      simulateOrder(i % 2 === 0 ? 'BUY' : 'SELL');
      const newTilt = Math.min(100, tiltScore + 5 * (i + 1));
      setTiltScore(newTilt);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'tilt_update', score: newTilt, level: newTilt >= 61 ? 'red' : newTilt >= 31 ? 'yellow' : 'green', blocked: newTilt >= 61 }));
      }
      i++;
      if (i >= 5) clearInterval(interval);
    }, 800);
  };

  const simulateLosingStreak = () => {
    setLastAction('Simulating 4 consecutive losses...');
    let i = 0;
    const interval = setInterval(() => {
      const loss = Math.floor(Math.random() * 200) + 50;
      simulateLoss(loss);
      simulateOrder('SELL');
      i++;
      if (i >= 4) {
        clearInterval(interval);
        setLastAction('4 consecutive losses - circuit breaker should fire');
      }
    }, 1200);
  };

  const simulateBlowup = () => {
    setLastAction('Simulating account blowup scenario...');
    setDailyPnL(-800);
    setConsecutiveLosses(5);
    setTiltScore(95);
    setTradeCount(15);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'tilt_update', score: 95, level: 'red', blocked: true }));
      wsRef.current.send(JSON.stringify({ type: 'report_bypass', details: 'Daily loss limit exceeded: -$800' }));
    }
    setLastAction('BLOWUP: -$800, Tilt 95, 5 consecutive losses, 15 trades');
  };

  const resetSim = () => {
    setDailyPnL(0);
    setTrades([]);
    setTiltScore(0);
    setConsecutiveLosses(0);
    setTradeCount(0);
    setLastAction('Simulator reset');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'tilt_update', score: 0, level: 'green', blocked: false }));
    }
  };

  const toggleAutoRun = () => {
    if (autoRunning) {
      if (autoRef.current) clearInterval(autoRef.current);
      setAutoRunning(false);
      setLastAction('Auto-run stopped');
    } else {
      setAutoRunning(true);
      setLastAction('Auto-run started - random trades every 3s');
      autoRef.current = setInterval(() => {
        const rand = Math.random();
        if (rand < 0.4) {
          simulateOrder(Math.random() > 0.5 ? 'BUY' : 'SELL');
          if (Math.random() > 0.5) simulateLoss(Math.floor(Math.random() * 150) + 30);
          else simulateWin(Math.floor(Math.random() * 100) + 20);
        } else if (rand < 0.6) {
          simulateLoss(Math.floor(Math.random() * 200) + 50);
        } else if (rand < 0.8) {
          simulateWin(Math.floor(Math.random() * 150) + 30);
        } else {
          simulateOversizeBlock();
        }
      }, 3000);
    }
  };

  const getTiltColor = () => {
    if (tiltScore >= 61) return '#ef4444';
    if (tiltScore >= 31) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20`}}>
          <span className="text-lg">🎮</span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Trading Simulator</h2>
          <p className="text-[0.6rem] text-white/30">Test all protection features without risking real money</p>
        </div>
      </div>

      {/* Connection + Status bar */}
      <div className="flex items-center gap-4 mt-4 mb-6 animate-reveal">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${connected ? 'border-emerald-400/20 bg-emerald-400/[0.04]' : 'border-red-400/20 bg-red-400/[0.04]'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`} />
          <span className="text-[0.6rem] font-bold uppercase tracking-[1px] text-white/50">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${locked ? 'border-red-400/20 bg-red-400/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
          <span className="text-[0.6rem] font-bold uppercase tracking-[1px] text-white/50">{locked ? 'LOCKED' : 'UNLOCKED'}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02]">
          <span className="text-[0.6rem] font-bold uppercase tracking-[1px] text-white/50">Tilt: <span style={{color: getTiltColor()}}>{tiltScore}</span></span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02]">
          <span className={`text-[0.6rem] font-bold uppercase tracking-[1px] ${dailyPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>P&L: ${dailyPnL}</span>
        </div>
      </div>

      {/* Mock Order Entry */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{color: `${colors.primary}80`}}>Order Entry</p>
          <div className="flex gap-3 mb-4">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
              <option value="NQ">NQ (Nasdaq)</option>
              <option value="MNQ">MNQ (Micro Nasdaq)</option>
              <option value="ES">ES (S&P 500)</option>
              <option value="MES">MES (Micro S&P)</option>
              <option value="YM">YM (Dow)</option>
              <option value="CL">CL (Crude Oil)</option>
            </select>
            <input type="number" min="1" max="50" value={size} onChange={(e) => setSize(Number(e.target.value) || 1)} className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm text-center font-mono font-bold focus:outline-none" />
            <button onClick={() => simulateOrder('BUY')} className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-[1px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-all press-scale">Buy</button>
            <button onClick={() => simulateOrder('SELL')} className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-[1px] bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all press-scale">Sell</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => simulateWin(Math.floor(Math.random() * 200) + 50)} className="px-3 py-2 rounded-lg text-[0.6rem] font-bold bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 press-scale">+ Win</button>
            <button onClick={() => simulateLoss(Math.floor(Math.random() * 200) + 50)} className="px-3 py-2 rounded-lg text-[0.6rem] font-bold bg-red-400/10 border border-red-400/20 text-red-300 press-scale">+ Loss</button>
            <button onClick={resetSim} className="px-3 py-2 rounded-lg text-[0.6rem] font-bold bg-white/[0.03] border border-white/[0.08] text-white/40 press-scale">Reset</button>
          </div>
        </div>
      </div>

      {/* Scenario Triggers */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.secondary}30, transparent)`}} />
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{color: `${colors.secondary}80`}}>Test Scenarios</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={simulateOversizeBlock} className="py-3 px-4 rounded-lg text-[0.6rem] font-bold bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all press-scale text-left">
              <span className="block text-white/70 mb-0.5">Oversize Order</span>
              <span className="text-white/25">Exceeds position limit</span>
            </button>
            <button onClick={simulateSessionBlock} className="py-3 px-4 rounded-lg text-[0.6rem] font-bold bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all press-scale text-left">
              <span className="block text-white/70 mb-0.5">Session Block</span>
              <span className="text-white/25">Trade outside hours</span>
            </button>
            <button onClick={simulateNewsBlock} className="py-3 px-4 rounded-lg text-[0.6rem] font-bold bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all press-scale text-left">
              <span className="block text-white/70 mb-0.5">News Block</span>
              <span className="text-white/25">During high-impact event</span>
            </button>
            <button onClick={simulateSymbolBlock} className="py-3 px-4 rounded-lg text-[0.6rem] font-bold bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all press-scale text-left">
              <span className="block text-white/70 mb-0.5">Symbol Block</span>
              <span className="text-white/25">Blocked instrument</span>
            </button>
            <button onClick={simulateTiltBlock} className="py-3 px-4 rounded-lg text-[0.6rem] font-bold bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all press-scale text-left">
              <span className="block text-white/70 mb-0.5">Tilt Block</span>
              <span className="text-white/25">Score hits 85+</span>
            </button>
            <button onClick={simulateRapidFire} className="py-3 px-4 rounded-lg text-[0.6rem] font-bold bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all press-scale text-left">
              <span className="block text-white/70 mb-0.5">Rapid Fire</span>
              <span className="text-white/25">5 orders in 4 seconds</span>
            </button>
            <button onClick={simulateLosingStreak} className="py-3 px-4 rounded-lg text-[0.6rem] font-bold bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all press-scale text-left">
              <span className="block text-white/70 mb-0.5">Losing Streak</span>
              <span className="text-white/25">4 consecutive losses</span>
            </button>
            <button onClick={simulateBlowup} className="py-3 px-4 rounded-lg text-[0.6rem] font-bold bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all press-scale text-left">
              <span className="block text-red-300 mb-0.5">Full Blowup</span>
              <span className="text-red-300/40">-$800, tilt 95, 5 losses</span>
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <button onClick={toggleAutoRun} className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-[1.5px] transition-all press-scale ${autoRunning ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-white/[0.03] border border-white/[0.08] text-white/40'}`}>
              {autoRunning ? 'Stop Auto-Run' : 'Start Auto-Run (random trades every 3s)'}
            </button>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal">
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4 text-white/30">Live Activity</p>
          {lastAction && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-xs text-white/60 font-mono">{lastAction}</p>
            </div>
          )}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {trades.map((t) => (
              <div key={t.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-[0.6rem] ${t.blocked ? 'bg-red-400/[0.06] border border-red-400/10' : 'bg-white/[0.02] border border-white/[0.04]'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.blocked ? 'bg-red-400' : t.side === 'BUY' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                  <span className="text-white/50 font-mono">{t.time}</span>
                  <span className={`font-bold ${t.blocked ? 'text-red-400' : 'text-white/60'}`}>{t.blocked ? 'BLOCKED' : t.side}</span>
                  <span className="text-white/30">{t.size} {t.symbol}</span>
                </div>
                {t.reason && <span className="text-red-400/60 text-[0.5rem] max-w-[200px] truncate">{t.reason}</span>}
              </div>
            ))}
            {trades.length === 0 && <p className="text-xs text-white/15 text-center py-3">No trades yet. Place an order or run a scenario.</p>}
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.04] flex gap-4 text-[0.55rem] text-white/25">
            <span>Trades: {tradeCount}</span>
            <span>Losses: {consecutiveLosses} in a row</span>
            <span>Tilt: <span style={{color: getTiltColor()}}>{tiltScore}/100</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};
