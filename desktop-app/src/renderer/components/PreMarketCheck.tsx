import React, { useState } from 'react';

interface Props {
  onComplete: (result: { passed: boolean; tightened: boolean }) => void;
}

export const PreMarketCheck: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [sleepHours, setSleepHours] = useState('');
  const [revengeTrade, setRevengeTrade] = useState<boolean | null>(null);
  const [emotionalState, setEmotionalState] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [tightened, setTightened] = useState(false);

  const handleSleep = () => {
    const hours = Number(sleepHours);
    if (hours < 5) {
      setWarning('Low sleep affects decision making. Consider sitting today out.');
    }
    setStep(1);
  };

  const handleRevenge = (answer: boolean) => {
    setRevengeTrade(answer);
    if (answer) {
      setBlocked(true);
      setBlockMessage("You just admitted you're trading to make back losses. That's revenge trading. Come back tomorrow.");
      // Tell extension to block ALL orders for today
      (window as any).electronAPI?.fullDayBlock?.();
      return;
    }
    setStep(2);
  };

  const handleEmotional = (rating: number) => {
    setEmotionalState(rating);
    if (rating <= 2) {
      setTightened(true);
      onComplete({ passed: true, tightened: true });
    } else {
      onComplete({ passed: true, tightened: false });
    }
  };

  if (blocked) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-8 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
        <h2 className="text-3xl font-black tracking-tighter text-white mb-6">Blocked</h2>
        <p className="text-white/50 text-sm leading-relaxed mb-8">{blockMessage}</p>
        <p className="text-xs text-white/20">Close the app and come back tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <h2 className="text-3xl font-black tracking-tighter text-glow-white mb-3">Pre-Market Check</h2>
      <p className="text-white/35 text-sm mb-10 leading-relaxed">Answer honestly. This is for you.</p>

      {/* Step 0: Sleep */}
      {step === 0 && (
        <div className="glass rounded-xl p-8 animate-reveal">
          <p className="text-[0.6rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Question 1 of 3</p>
          <h3 className="text-lg font-bold text-white mb-6">How many hours did you sleep last night?</h3>
          <input
            type="number"
            min="0"
            max="24"
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            placeholder="Hours"
            className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white font-mono text-lg font-semibold text-center focus:border-cyan-400/50 focus:outline-none transition-all mb-6"
          />
          {warning && (
            <p className="text-amber-400/80 text-xs mb-4">{warning}</p>
          )}
          <div>
            <button
              onClick={handleSleep}
              disabled={!sleepHours}
              className="px-6 py-3 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:bg-cyan-400/20 transition-all disabled:opacity-20"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Revenge */}
      {step === 1 && (
        <div className="glass rounded-xl p-8 animate-reveal">
          <p className="text-[0.6rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Question 2 of 3</p>
          <h3 className="text-lg font-bold text-white mb-6">Are you trading to make back yesterday's loss?</h3>
          <div className="flex gap-4">
            <button
              onClick={() => handleRevenge(true)}
              className="flex-1 py-4 border border-red-400/20 text-red-300 text-sm font-semibold rounded-lg hover:bg-red-400/10 transition-all"
            >
              Yes
            </button>
            <button
              onClick={() => handleRevenge(false)}
              className="flex-1 py-4 border border-emerald-400/20 text-emerald-300 text-sm font-semibold rounded-lg hover:bg-emerald-400/10 transition-all"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Emotional State */}
      {step === 2 && (
        <div className="glass rounded-xl p-8 animate-reveal">
          <p className="text-[0.6rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Question 3 of 3</p>
          <h3 className="text-lg font-bold text-white mb-6">How are you feeling emotionally?</h3>
          <p className="text-xs text-white/30 mb-5">1 = terrible, 5 = great</p>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleEmotional(n)}
                className={`w-12 h-12 rounded-lg border text-lg font-bold transition-all ${
                  n <= 2
                    ? 'border-red-400/20 text-red-300 hover:bg-red-400/10'
                    : n === 3
                    ? 'border-amber-400/20 text-amber-300 hover:bg-amber-400/10'
                    : 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
