import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "You set these rules for a reason. Whatever you're about to do — you already know it's wrong.",
  "You made this decision while calm. Right now you're not calm. Trust the version of you that was thinking clearly.",
  "One emotional trade can undo a week of discipline. Is it worth it?",
  "The market will be here tomorrow. Will your account?",
  "You're not thinking straight right now. Close everything and walk away.",
  "Every blown account started with 'just one more trade.' Don't be that person.",
  "This feeling will pass in 10 minutes. Your losses won't come back.",
  "You disabled your protection. That means you know what you're about to do is wrong.",
];

export const BypassWarning: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if ((window as any).electronAPI?.onExtensionDisconnected) {
      (window as any).electronAPI.onExtensionDisconnected(() => {
        setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
        setVisible(true);
      });
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-12">
      {/* Pulsing red dot */}
      <div className="w-4 h-4 rounded-full bg-red-500 mb-10 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8),0_0_40px_rgba(239,68,68,0.4)]" />

      {/* Warning title */}
      <h1 className="text-4xl font-black tracking-tighter text-white mb-8 text-center">
        Protection Disabled
      </h1>

      {/* Message */}
      <p className="text-lg text-white/60 text-center max-w-lg leading-relaxed mb-12">
        {message}
      </p>

      {/* Trading platforms killed notice */}
      <p className="text-sm text-red-400/80 text-center mb-12">
        Your trading platforms have been closed.
      </p>

      {/* Dismiss */}
      <button
        onClick={() => setVisible(false)}
        className="px-8 py-4 border border-white/10 text-white/30 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:border-white/20 hover:text-white/50 transition-all"
      >
        I understand
      </button>
    </div>
  );
};
