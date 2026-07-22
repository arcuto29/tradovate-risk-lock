import React, { useState } from 'react';

interface Props {
  isLocked: boolean;
  trustedPersonEnabled: boolean;
}

export const TrustedPerson: React.FC<Props> = ({ isLocked, trustedPersonEnabled }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [removePassword, setRemovePassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSet = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    const result = await window.electronAPI.setTrustedPassword(password);
    if (result.success) {
      setSuccess('Trusted person password set.');
      setPassword('');
      setConfirmPassword('');
    } else {
      setError(result.error || 'Failed');
    }
  };

  const handleRemove = async () => {
    setError('');
    const result = await window.electronAPI.removeTrustedPassword(removePassword);
    if (result.success) {
      setSuccess('Trusted person removed.');
      setRemovePassword('');
    } else {
      setError(result.error || 'Failed');
    }
  };

  return (
    <div className="trusted-person">
      <h2>Trusted Person Mode</h2>
      <p className="section-description">
        A trusted person sets a password the trader does not know. During an active lock, early unlock requires this password.
      </p>

      {isLocked && (
        <div className="warning-box">Cannot change while locked.</div>
      )}

      {!isLocked && !trustedPersonEnabled && (
        <div className="form-section">
          <h3>Set Password</h3>
          <div className="form-group">
            <label>Password (min 6 chars)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button className="primary-button" onClick={handleSet}>Set Password</button>
        </div>
      )}

      {!isLocked && trustedPersonEnabled && (
        <div className="form-section">
          <h3>Remove Trusted Person</h3>
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={removePassword}
              onChange={(e) => setRemovePassword(e.target.value)}
            />
          </div>
          <button className="danger-button" onClick={handleRemove}>Remove</button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </div>
  );
};
