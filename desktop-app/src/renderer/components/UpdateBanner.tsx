import React, { useState, useEffect } from 'react';

export const UpdateBanner: React.FC = () => {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    if (window.electronAPI.onUpdateStatus) {
      window.electronAPI.onUpdateStatus((s: any) => setStatus(s));
    }
  }, []);

  if (!status) return null;
  if (status.status === 'up-to-date' || status.status === 'checking') return null;
  if (status.status === 'error') return null;

  if (status.status === 'downloading') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 px-8 py-2.5 glass-strong text-center">
        <span className="text-xs text-cyan-300/80 font-medium">
          Downloading update... {status.percent}%
        </span>
      </div>
    );
  }

  if (status.status === 'ready') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 px-8 py-2.5 glass-strong flex items-center justify-center gap-4">
        <span className="text-xs text-cyan-300/80 font-medium">
          Update v{status.version} ready
        </span>
        <button
          onClick={() => window.electronAPI.installUpdate()}
          className="px-4 py-1.5 bg-cyan-400 text-black text-[0.65rem] font-bold uppercase tracking-[1.5px] rounded hover:bg-cyan-300 transition-all"
        >
          Restart & Update
        </button>
      </div>
    );
  }

  if (status.status === 'available') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 px-8 py-2.5 glass-strong text-center">
        <span className="text-xs text-cyan-300/60 font-medium">
          Update v{status.version} available — downloading...
        </span>
      </div>
    );
  }

  return null;
};
