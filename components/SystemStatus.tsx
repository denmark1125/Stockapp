
import React from 'react';
import { ShieldCheck, Database, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface SystemStatusProps {
  lastUpdated: Date | null;
  isSyncing: boolean;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ lastUpdated, isSyncing }) => {
  return (
    <div className="flex flex-wrap items-center gap-8 px-6 py-3 bg-white text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 rounded-xl mb-10 border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Database size={12} className={isSyncing ? "animate-pulse text-amber-500" : "text-emerald-500"} />
        <span className="text-slate-500">Node: {isSyncing ? 'Syncing...' : 'Encrypted'}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <ShieldCheck size={12} className="text-blue-500" />
        <span className="text-slate-500">Python Scan: {lastUpdated ? format(lastUpdated, 'yyyy/MM/dd HH:mm') : 'Syncing...'}</span>
      </div>
      <div className="flex items-center gap-2.5 ml-auto">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-emerald-500 font-black">AI Auditor Live</span>
      </div>
    </div>
  );
};
