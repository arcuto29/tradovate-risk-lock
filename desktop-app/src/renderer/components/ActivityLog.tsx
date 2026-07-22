import React, { useState, useEffect } from 'react';

export const ActivityLog: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLog = async () => { try { setEntries(await window.electronAPI.getActivityLog(100)); } catch {} finally { setLoading(false); } };
  useEffect(() => { loadLog(); const i = setInterval(loadLog, 5000); return () => clearInterval(i); }, []);

  const filtered = entries.filter((e) => e.type !== 'heartbeat');
  if (loading) return <span className="text-cyan-300/40 text-sm font-mono animate-pulse-glow">Loading...</span>;

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-8 text-glow-white">Activity</h2>
      {filtered.length === 0 ? (
        <p className="text-white/20 text-sm py-12">No activity recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div key={entry.id} className="glass rounded-lg p-4 hover:border-glow-cyan transition-all">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-mono text-[0.6rem] font-semibold tracking-wide uppercase text-cyan-400/60 border border-cyan-400/15 px-2 py-0.5 rounded">{entry.type}</span>
                <span className="font-mono text-[0.6rem] text-white/20">{new Date(entry.timestamp + 'Z').toLocaleString()}</span>
              </div>
              <p className="text-sm text-white/40 leading-relaxed">{entry.details}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
