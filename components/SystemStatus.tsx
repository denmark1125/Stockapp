
import React from 'react';
import { Activity, ShieldCheck, Database, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface SystemStatusProps {
  lastUpdated: Date | null;
  isSyncing: boolean;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ lastUpdated, isSyncing }) => {
  const isToday = lastUpdated ? format(lastUpdated, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') : false;

  return (
    <div className="flex flex-wrap items-center gap-6 px-4 py-2 bg-slate-900 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 rounded-sm mb-6 border border-slate-800">
      <div className="flex items-center gap-2">
        <Database size={12} className={isSyncing ? "animate-pulse text-amber-500" : "text-emerald-500"} />
        <span>DB Sync: {isSyncing ? '正在同步 Syncing' : '連線正常 Stable'}</span>
      </div>
      <div className="flex items-center gap-2">
        <ShieldCheck size={12} className={isToday ? "text-emerald-500" : "text-rose-500"} />
        <span>Python Scan: {lastUpdated ? format(lastUpdated, 'yyyy/MM/dd HH:mm') : 'N/A'}</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-emerald-500">AI Auditor Online</span>
      </div>
    </div>
  );
};
