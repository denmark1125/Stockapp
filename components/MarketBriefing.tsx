
import React from 'react';
import { ShieldAlert, TrendingUp, TrendingDown, Activity, Zap, Target, Calendar, Clock } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface MarketBriefingProps {
  brief: DailyAnalysis | null;
  loading: boolean;
}

export const MarketBriefing: React.FC<MarketBriefingProps> = ({ brief, loading }) => {
  if (loading) return (
    <div className="w-full bg-slate-900 rounded-[2rem] p-10 animate-pulse border border-white/5 mb-8">
      <div className="h-4 w-32 bg-slate-800 rounded-full mb-4"></div>
      <div className="h-8 w-full bg-slate-800 rounded-xl"></div>
    </div>
  );

  if (!brief) return (
    <div className="w-full bg-slate-900 rounded-[2rem] p-8 mb-8 border border-white/10 flex items-center gap-4">
       <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
          <Calendar size={20} />
       </div>
       <div>
          <h3 className="text-white text-xs font-black uppercase tracking-widest">等待開盤戰報</h3>
          <p className="text-slate-500 text-[10px] mt-0.5">系統同步中...</p>
       </div>
    </div>
  );

  const isBull = brief.trade_signal === 'BULL' || brief.trade_signal === 'TRADE_BUY';
  const isBear = brief.trade_signal === 'BEAR';

  return (
    <div className="relative overflow-hidden w-full bg-slate-950 rounded-[2rem] lg:rounded-[2.5rem] p-8 lg:p-10 mb-8 border border-white/10 shadow-xl">
      <div className={`absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-20 ${isBull ? 'bg-emerald-500' : isBear ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
      
      <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-start lg:items-center">
        {/* 左側：訊號燈 - 縮小 */}
        <div className="flex flex-col items-center shrink-0 w-full lg:w-auto">
          <div className={`w-20 h-20 lg:w-28 lg:h-28 rounded-full flex items-center justify-center shadow-lg border-4 ${isBull ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : isBear ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-amber-500/10 border-amber-500 text-amber-500'}`}>
            {isBull ? <TrendingUp size={36} /> : isBear ? <TrendingDown size={36} /> : <Activity size={36} />}
          </div>
          <div className="mt-3 text-center">
            <div className={`text-[9px] font-black uppercase tracking-[0.3em] ${isBull ? 'text-emerald-500' : isBear ? 'text-rose-500' : 'text-amber-500'}`}>
              {isBull ? '攻擊訊號' : isBear ? '減碼防禦' : '觀望震盪'}
            </div>
          </div>
        </div>

        {/* 中間：戰略報告 - 縮小字體 */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
             <div className="w-6 h-px bg-amber-500/50"></div>
             <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">市場審計報告</h2>
             <span className="text-slate-600 text-[9px] mono-text ml-auto border border-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock size={10} /> {brief.analysis_date}
             </span>
          </div>
          <div className="text-xl lg:text-3xl font-black text-white italic tracking-tighter leading-snug">
            "{brief.ai_comment || '因子校準完畢。'}"
          </div>
          <div className="flex gap-4 pt-2">
            <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
              <span className="text-[8px] text-slate-500 uppercase font-black block mb-1">預估波動</span>
              <span className={`text-xl font-black mono-text ${isBull ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isBull ? '+' : ''}{brief.volatility || '0.0'}%
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
              <span className="text-[8px] text-slate-500 uppercase font-black block mb-1">成交量能</span>
              <span className="text-xl font-black text-white mono-text">{brief.vol_ratio || '1.0'}x</span>
            </div>
          </div>
        </div>

        {/* 右側：行動建議 */}
        <div className="w-full lg:w-64 space-y-3">
          <div className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-rose-500" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">決策執行建議</span>
            </div>
            <p className="text-[11px] font-bold text-slate-300 leading-relaxed italic">
              {isBull ? '進攻強勢股，嚴守目標。' : isBear ? '保留現金，防禦性掛單。' : '等待量能確認。'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
