import React, { useState } from 'react';

interface Props { isLocked: boolean; trustedPersonEnabled: boolean; }

export const TrustedPerson: React.FC<Props> = ({ isLocked, trustedPersonEnabled }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [removePassword, setRemovePassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inputClass = "w-full bg-transparent border-b border-white/[0.07] py-4 text-white text-base font-medium focus:border-white focus:outline-none transition-colors";

  const handleSet = async () => {
    setError('');
    if (password.length < 6) { setError('Min 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords don\'t match'); return; }
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
      <h2 className="text-4xl font-black tracking-tighter mb-3">Trusted Person</h2>
      <p className="text-neutral-500 text-sm mb-10 leading-relaxed">
        Someone else holds the unlock password. You can't early-unlock without them.
      </p>

      {isLocked && (
        <div className="mb-6 px-5 py-3.5 bg-amber-500/8 border-l-2 border-amber-500 text-amber-400 text-xs font-medium">
          Cannot change while locked
        </div>
      )}

      {!isLocked && !trustedPersonEnabled && (
        <div className="border-t border-white/[0.07] py-7 space-y-5">
          <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Set Password</p>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2.5">Password (min 6)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2.5">Confirm</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
          </div>
          <button onClick={handleSet} className="px-7 py-3.5 border border-white/[0.14] text-neutral-400 text-xs font-semibold uppercase tracking-[2px] hover:border-white hover:text-white transition-all">
            Set Password
          </button>
        </div>
      )}

      {!isLocked && trustedPersonEnabled && (
        <div className="border-t border-white/[0.07] py-7 space-y-5">
          <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Remove</p>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2.5">Current Password</label>
            <input type="password" value={removePassword} onChange={(e) => setRemovePassword(e.target.value)} className={inputClass} />
          </div>
          <button onClick={handleRemove} className="px-7 py-3.5 border border-red-500 text-red-400 text-xs font-semibold uppercase tracking-[2px] hover:bg-red-500 hover:text-black transition-all">
            Remove
          </button>
        </div>
      )}

      {error && <div className="mt-4 px-5 py-3.5 bg-red-500/10 border-l-2 border-red-500 text-red-400 text-xs font-medium">{error}</div>}
      {success && <div className="mt-4 px-5 py-3.5 bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-400 text-xs font-medium">{success}</div>}
    </div>
  );
};
