
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Database, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface SystemStatusProps {
  lastUpdated: Date | null;
  isSyncing: boolean;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ lastUpdated, isSyncing }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-10 px-5 sm:px-10 py-4 sm:py-6 bg-white text-[10px] sm:text-[12px] font-bold tracking-[0.05em] sm:tracking-[0.1em] text-slate-400 rounded-2xl sm:rounded-3xl mb-6 sm:mb-12 border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-slate-950 shrink-0" />
        <span className="text-slate-950 whitespace-nowrap">
          <span className="opacity-50 mr-1 hidden sm:inline">系統時鐘:</span> 
          {format(currentTime, 'HH:mm:ss')}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Database size={14} className={`${isSyncing ? "animate-pulse text-amber-500" : "text-emerald-500"} shrink-0`} />
        <span className="text-slate-500 whitespace-nowrap">
          <span className="opacity-50 mr-1 hidden sm:inline">雲端節點:</span>
          {isSyncing ? '同步中...' : 'Alpha 核心'}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} className="text-blue-500 shrink-0" />
        <span className="text-slate-500 whitespace-nowrap">
          <span className="opacity-50 mr-1 hidden sm:inline">數據日期:</span>
          {lastUpdated ? format(lastUpdated, 'MM/dd HH:mm') : '讀取中'}
        </span>
      </div>

      <div className="hidden lg:flex items-center gap-3 ml-auto">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-emerald-600 font-black tracking-widest text-[9px] uppercase">Alpha System Active</span>
      </div>
    </div>
  );
};
