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
      <div className="max-w-md mx-auto text-center py-16 animate-reveal">
        <div className="relative inline-block mb-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto" style={{animation: 'nuclearPulse 2s ease-in-out infinite'}}>
            <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse" />
          </div>
        </div>
        <h2 className="text-4xl font-black tracking-tight text-red-400 mb-4" style={{textShadow: '0 0 20px rgba(248,113,113,0.5)'}}>Blocked</h2>
        <p className="text-white/40 text-sm leading-relaxed mb-8 max-w-xs mx-auto">{blockMessage}</p>
        <p className="text-[0.65rem] text-white/15 uppercase tracking-[2px]">Close the app and come back tomorrow</p>
      </div>
    );
  }

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[0, 1, 2].map((s) => (
        <div key={s} className={`h-1 rounded-full transition-all duration-500 ${
          s === step ? 'w-8 bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]'
          : s < step ? 'w-4 bg-cyan-400/40'
          : 'w-4 bg-white/10'
        }`} />
      ))}
    </div>
  );

  return (
    <div className="max-w-md mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-8 animate-reveal">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-xl" style={{filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.5))'}}>🧘</span>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient mb-2">Pre-Market Check</h2>
        <p className="text-white/30 text-sm">Answer honestly. This is for you.</p>
      </div>

      {stepIndicator}


      {/* Step 0: Sleep */}
      {step === 0 && (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium animate-scale-in">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          <div className="relative z-10">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-cyan-400/50 mb-5">Question 1 of 3</p>
            <h3 className="text-xl font-bold text-white mb-6">How many hours did you sleep last night?</h3>
            <input
              type="number"
              min="0"
              max="24"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="0"
              className="w-28 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-4 text-white font-mono text-2xl font-bold text-center focus:border-cyan-400/50 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.08),0_0_15px_rgba(56,189,248,0.1)] focus:outline-none transition-all input-premium mb-6"
            />
            {warning && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-amber-400/[0.05] border border-amber-400/20">
                <p className="text-amber-300/80 text-xs">{warning}</p>
              </div>
            )}
            <div>
              <button
                onClick={handleSleep}
                disabled={!sleepHours}
                className="px-8 py-3.5 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale disabled:opacity-20 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Revenge */}
      {step === 1 && (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium animate-scale-in">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
          <div className="relative z-10">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-purple-400/50 mb-5">Question 2 of 3</p>
            <h3 className="text-xl font-bold text-white mb-8">Are you trading to make back yesterday's loss?</h3>
            <div className="flex gap-4">
              <button
                onClick={() => handleRevenge(true)}
                className="flex-1 py-5 rounded-xl border border-red-400/20 bg-red-400/[0.03] text-red-300 text-sm font-bold hover:bg-red-400/10 hover:border-red-400/40 hover:shadow-[0_0_20px_rgba(248,113,113,0.1)] transition-all press-scale"
              >
                Yes
              </button>
              <button
                onClick={() => handleRevenge(false)}
                className="flex-1 py-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.03] text-emerald-300 text-sm font-bold hover:bg-emerald-400/10 hover:border-emerald-400/40 hover:shadow-[0_0_20px_rgba(52,211,153,0.1)] transition-all press-scale"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Emotional State */}
      {step === 2 && (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium animate-scale-in">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <div className="relative z-10">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-emerald-400/50 mb-5">Question 3 of 3</p>
            <h3 className="text-xl font-bold text-white mb-3">How are you feeling emotionally?</h3>
            <p className="text-xs text-white/25 mb-8">1 = terrible, 5 = great</p>
            <div className="flex gap-3 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => handleEmotional(n)}
                  className={`w-14 h-14 rounded-xl text-lg font-bold transition-all press-scale hover-lift ${
                    n <= 2
                      ? 'border border-red-400/20 bg-red-400/[0.03] text-red-300 hover:bg-red-400/10 hover:border-red-400/40 hover:shadow-[0_0_15px_rgba(248,113,113,0.15)]'
                      : n === 3
                      ? 'border border-amber-400/20 bg-amber-400/[0.03] text-amber-300 hover:bg-amber-400/10 hover:border-amber-400/40 hover:shadow-[0_0_15px_rgba(251,191,36,0.15)]'
                      : 'border border-emerald-400/20 bg-emerald-400/[0.03] text-emerald-300 hover:bg-emerald-400/10 hover:border-emerald-400/40 hover:shadow-[0_0_15px_rgba(52,211,153,0.15)]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
