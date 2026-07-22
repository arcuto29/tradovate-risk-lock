import React, { useState, useEffect } from 'react';

export const ActivityLog: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLog = async () => {
    try { setEntries(await window.electronAPI.getActivityLog(100)); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadLog(); const i = setInterval(loadLog, 5000); return () => clearInterval(i); }, []);

  const filtered = entries.filter((e) => e.type !== 'heartbeat');

  if (loading) return <span className="text-neutral-600 text-sm font-mono">Loading...</span>;

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-10">Activity</h2>

      {filtered.length === 0 ? (
        <p className="text-neutral-600 text-sm py-16">No activity recorded yet.</p>
      ) : (
        <div className="border-t border-white/[0.07]">
          {filtered.map((entry) => (
            <div key={entry.id} className="py-5 border-b border-white/[0.07] group">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-mono text-[0.6rem] font-semibold tracking-wide uppercase text-neutral-500 border border-white/[0.07] px-2 py-0.5">
                  {entry.type}
                </span>
                <span className="font-mono text-[0.6rem] text-neutral-700">
                  {new Date(entry.timestamp + 'Z').toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {entry.details}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
