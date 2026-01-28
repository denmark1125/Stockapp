
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Database, Clock, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';

interface SystemStatusProps {
  lastUpdated: Date | null;
  isSyncing: boolean;
  dataDate?: string | null;
  isCurrent?: boolean;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ lastUpdated, isSyncing, dataDate, isCurrent }) => {
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
          <span className="opacity-50 mr-1 hidden sm:inline uppercase">系統時鐘:</span> 
          {format(currentTime, 'HH:mm:ss')}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Database size={14} className={`${isSyncing ? "animate-spin text-amber-500" : "text-emerald-500"} shrink-0`} />
        <span className="text-slate-500 whitespace-nowrap">
          <span className="opacity-50 mr-1 hidden sm:inline uppercase">雲端同步:</span>
          {isSyncing ? '同步中' : '已連線'}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} className={`${isCurrent ? 'text-emerald-500' : 'text-amber-500'} shrink-0`} />
        <span className="text-slate-500 whitespace-nowrap">
          <span className="opacity-50 mr-1 hidden sm:inline uppercase">數據日期:</span>
          {dataDate || '讀取中'} 
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-tighter ${isCurrent ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            {isCurrent ? '今日最新' : '待更新'}
          </span>
        </span>
      </div>

      <div className="hidden lg:flex items-center gap-3 ml-auto">
        <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></div>
        <span className={`${isSyncing ? 'text-amber-600' : 'text-emerald-600'} font-black tracking-widest text-[9px] uppercase`}>
          {isSyncing ? 'Synchronizing Alpha...' : 'Alpha Terminal Active'}
        </span>
      </div>
    </div>
  );
};
