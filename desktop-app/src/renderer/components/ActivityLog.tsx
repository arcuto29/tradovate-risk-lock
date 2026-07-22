import React, { useState, useEffect } from 'react';

export const ActivityLog: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLog = async () => {
    try {
      setEntries(await window.electronAPI.getActivityLog(100));
    } catch {
      // silently fail — log will show empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLog();
    const interval = setInterval(loadLog, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = entries.filter((e) => e.type !== 'heartbeat');

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="activity-log">
      <h2>Activity Log</h2>
      {filtered.length === 0 ? (
        <div className="empty-state">No activity recorded yet.</div>
      ) : (
        <div className="log-entries">
          {filtered.map((entry) => (
            <div key={entry.id} className="log-entry">
              <div className="log-entry-header">
                <span className="log-type-badge">{entry.type}</span>
                <span className="log-timestamp">
                  {new Date(entry.timestamp + 'Z').toLocaleString()}
                </span>
              </div>
              <div className="log-details">{entry.details}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
