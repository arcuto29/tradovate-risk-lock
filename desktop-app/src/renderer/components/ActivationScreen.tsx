import React, { useState } from 'react';

interface Props {
  onActivated: () => void;
}

export const ActivationScreen: React.FC<Props> = ({ onActivated }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!key.trim()) { setError('Enter a license key'); return; }
    setLoading(true);
    setError('');

    try {
      const result = await (window as any).electronAPI?.activateLicense?.(key.trim().toUpperCase());
      if (result?.success) {
        onActivated();
      } else {
        setError(result?.error || 'Invalid license key');
      }
    } catch (e: any) {
      setError('Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center relative">
      {/* Nebula background */}
      <div className="nebula-bg" />
      <div className="stars" />

      <div className="relative z-10 text-center max-w-md px-8">
        {/* Logo */}
        <p className="text-[0.62rem] font-bold tracking-[6px] uppercase text-glow-cyan mb-12 animate-breathe">
          Sentinel
        </p>

        {/* Title */}
        <h1 className="text-3xl font-black tracking-tighter text-white mb-3">
          Activate
        </h1>
        <p className="text-white/35 text-sm mb-10 leading-relaxed">
          Enter your license key to get started.
        </p>

        {/* Key input */}
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') handleActivate(); }}
          placeholder="TG-XXXX-XXXX-XXXX-XXXXXXXX"
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-5 py-4 text-white text-center text-sm font-mono tracking-wider focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all placeholder:text-white/15 mb-4"
        />

        {error && (
          <p className="text-red-400 text-xs font-medium mb-4">{error}</p>
        )}

        {/* Activate button */}
        <button
          onClick={handleActivate}
          disabled={loading || !key.trim()}
          className="w-full py-4 bg-cyan-400 text-black text-xs font-bold uppercase tracking-[3px] rounded-lg hover:bg-cyan-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all disabled:opacity-20 disabled:cursor-not-allowed btn-glow"
        >
          {loading ? 'Activating...' : 'Activate'}
        </button>

        <p className="text-white/15 text-[0.6rem] mt-8">
          Need a key? Contact the developer.
        </p>
      </div>
    </div>
  );
};
