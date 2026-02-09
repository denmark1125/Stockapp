
import React from 'react';
import { Activity, Info, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface MarketBriefingProps {
  brief: DailyAnalysis | null;
  loading: boolean;
}

export const MarketBriefing: React.FC<MarketBriefingProps> = ({ brief, loading }) => {
  if (loading) return (
    <div className="w-full bg-slate-50 rounded-3xl p-10 animate-pulse border border-slate-100 mb-10"></div>
  );

  if (!brief) return null;

  const isBull = brief.trade_signal === 'BULL' || brief.trade_signal === 'TRADE_BUY';
  const isBear = brief.trade_signal === 'BEAR';

  return (
    <div className="w-full bg-white rounded-3xl p-8 lg:p-10 mb-10 border japanese-border shadow-sm flex flex-col lg:flex-row gap-8 items-start lg:items-center">
      <div className="shrink-0">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${isBull ? 'border-emerald-500 text-emerald-500' : isBear ? 'border-rose-500 text-rose-500' : 'border-slate-300 text-slate-300'}`}>
          {isBull ? <TrendingUp size={28} /> : isBear ? <TrendingDown size={28} /> : <Activity size={28} />}
        </div>
      </div>
      
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">今日市場審計</span>
           <span className="h-px bg-slate-100 flex-1"></span>
           <span className="text-[9px] text-slate-300 mono-text uppercase">{brief.analysis_date}</span>
        </div>
        <h2 className="serif-text text-2xl lg:text-3xl font-bold text-[#2D2D2D] leading-tight">
          {brief.ai_comment || '目前市場環境相對穩定，適合觀測趨勢標的。'}
        </h2>
        <div className="flex gap-6 pt-2 text-[10px] font-bold text-slate-400">
           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 預期波動 {brief.volatility || '0.0'}%</div>
           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2D2D2D]"></span> 成交量能 {brief.vol_ratio || '1.0'}x</div>
        </div>
      </div>

      <div className="hidden lg:block w-px h-20 bg-slate-100"></div>

      <div className="bg-slate-50 p-5 rounded-2xl w-full lg:w-64 border border-slate-100">
         <div className="flex items-center gap-2 mb-2">
           <Info size={14} className="text-slate-400" />
           <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">操作方略</span>
         </div>
         <p className="text-[11px] font-medium text-slate-600 italic">
           {isBull ? '多頭氣勢強勁，聚焦動能領頭標的。' : isBear ? '保守至上，建議配置防禦型資產。' : '等待市場量能沉澱，觀察支撐區。'}
         </p>
      </div>
    </div>
  );
};
