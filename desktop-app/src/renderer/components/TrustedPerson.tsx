import React, { useState } from 'react';

interface Props { isLocked: boolean; trustedPersonEnabled: boolean; }

export const TrustedPerson: React.FC<Props> = ({ isLocked, trustedPersonEnabled }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [removePassword, setRemovePassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all placeholder:text-white/15";

  const handleSet = async () => {
    setError('');
    if (password.length < 6) { setError('Min 6 characters'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    const r = await window.electronAPI.setTrustedPassword(password);
    if (r.success) { setSuccess('Password set'); setPassword(''); setConfirmPassword(''); }
    else setError(r.error || 'Failed');
  };

  const handleRemove = async () => {
    setError('');
    const r = await window.electronAPI.removeTrustedPassword(removePassword);
    if (r.success) { setSuccess('Removed'); setRemovePassword(''); }
    else setError(r.error || 'Failed');
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3 text-glow-white">Trusted Person</h2>
      <p className="text-white/35 text-sm mb-8 leading-relaxed">
        Someone else holds the unlock password.
      </p>

      {isLocked && (
        <div className="mb-6 px-5 py-3.5 glass rounded-lg border border-amber-400/20 text-amber-300/80 text-xs font-medium">
          Cannot change while locked
        </div>
      )}

      {!isLocked && !trustedPersonEnabled && (
        <div className="glass rounded-xl p-6 space-y-4">
          <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-2">Set Password</p>

          <div>
            <label className="block text-xs text-white/35 mb-2">Password (min 6)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-white/35 mb-2">Confirm</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
          </div>
          <button onClick={handleSet} className="px-6 py-3 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:bg-cyan-400/20 hover:border-cyan-400/40 transition-all btn-glow">Set Password</button>
        </div>
      )}

      {!isLocked && trustedPersonEnabled && (
        <div className="glass rounded-xl p-6 space-y-4">
          <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-2">Remove</p>
          <div>
            <label className="block text-xs text-white/35 mb-2">Current Password</label>
            <input type="password" value={removePassword} onChange={(e) => setRemovePassword(e.target.value)} className={inputClass} />
          </div>
          <button onClick={handleRemove} className="px-6 py-3 border border-red-400/30 text-red-300 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:bg-red-400/10 hover:border-red-400/50 transition-all">Remove</button>
        </div>
      )}

      {error && <div className="mt-4 px-5 py-3.5 glass rounded-lg border border-red-400/20 text-red-300 text-xs font-medium">{error}</div>}
      {success && <div className="mt-4 px-5 py-3.5 glass rounded-lg border border-emerald-400/20 text-glow-green text-xs font-medium">{success}</div>}
    </div>
  );
};
