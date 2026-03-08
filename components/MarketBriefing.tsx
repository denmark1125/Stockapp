import React from 'react';
import { Activity, Info, TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface MarketBriefingProps {
  brief: DailyAnalysis | null;
  loading: boolean;
  marketRegime?: string;  // 問題5：新增大盤狀態
}

export const MarketBriefing: React.FC<MarketBriefingProps> = ({ brief, loading, marketRegime }) => {
  if (loading) return (
    <div className="w-full bg-slate-50 rounded-3xl p-10 animate-pulse border border-slate-100 mb-10 h-32"></div>
  );

  // 問題5：大盤空頭時整個元件變成醒目紅底
  if (marketRegime === 'BEAR') {
    return (
      <div className="w-full bg-[#C83232] text-white rounded-3xl p-8 lg:p-10 mb-10 border border-red-700 shadow-xl shadow-red-900/20 flex flex-col lg:flex-row gap-6 items-start lg:items-center">
        <div className="shrink-0">
          <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-white/30 bg-white/10">
            <AlertTriangle size={28} className="animate-pulse" />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-red-200">大盤空頭警戒</span>
          </div>
          <h2 className="serif-text text-2xl lg:text-3xl font-bold leading-tight mb-3">
            大盤跌破季線，市場進入空頭模式
          </h2>
          <p className="text-[12px] text-red-100 font-medium">
            系統已自動封鎖所有新買進訊號。建議：空手觀望、管理庫存停損、等待大盤站回 MA60 再考慮進場。
          </p>
        </div>
        <div className="bg-white/10 p-5 rounded-2xl w-full lg:w-64 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-red-200" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-red-200">現在該做什麼</span>
          </div>
          <p className="text-[11px] font-medium text-white">
            🔴 空手保命，不要逢低攤平<br />
            📋 檢查庫存，跌破停損立即出場<br />
            ⏳ 耐心等待大盤回穩訊號
          </p>
        </div>
      </div>
    );
  }

  if (!brief && marketRegime !== 'BULL' && marketRegime !== 'SIDEWAYS') return null;

  const isBull = marketRegime === 'BULL' || brief?.trade_signal === 'BULL';
  const isSideways = marketRegime === 'SIDEWAYS';

  return (
    <div className={`w-full rounded-3xl p-8 lg:p-10 mb-10 border shadow-sm flex flex-col lg:flex-row gap-8 items-start lg:items-center japanese-border
      ${isBull ? 'bg-emerald-50 border-emerald-100' : isSideways ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-slate-100'}`}>

      <div className="shrink-0">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2
          ${isBull ? 'border-emerald-500 text-emerald-500' : isSideways ? 'border-yellow-500 text-yellow-600' : 'border-slate-300 text-slate-400'}`}>
          {isBull ? <TrendingUp size={28} /> : isSideways ? <Activity size={28} /> : <TrendingDown size={28} />}
        </div>
      </div>

      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <span className={`text-[9px] font-black uppercase tracking-[0.3em]
            ${isBull ? 'text-emerald-500' : isSideways ? 'text-yellow-600' : 'text-slate-400'}`}>
            {isBull ? '🟢 多頭市場' : isSideways ? '🟡 盤整觀望' : '今日市場'}
          </span>
          <span className="h-px bg-slate-100 flex-1"></span>
          {brief?.analysis_date && <span className="text-[9px] text-slate-300 mono-text uppercase">{brief.analysis_date}</span>}
        </div>
        <h2 className="serif-text text-2xl lg:text-3xl font-bold text-[#2D2D2D] leading-tight">
          {isBull ? '多頭氣勢強勁，聚焦動能領頭標的' :
           isSideways ? '大盤盤整，選股需更嚴格，優先波段布局' :
           brief?.ai_comment || '目前市場環境相對穩定，適合觀測趨勢標的。'}
        </h2>
        {(brief?.volatility || brief?.vol_ratio) && (
          <div className="flex gap-6 pt-2 text-[10px] font-bold text-slate-400">
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 預期波動 {brief.volatility || '0.0'}%</div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2D2D2D]"></span> 量能 {brief.vol_ratio || '1.0'}x</div>
          </div>
        )}
      </div>

      <div className="hidden lg:block w-px h-20 bg-slate-100"></div>

      <div className={`p-5 rounded-2xl w-full lg:w-64 border
        ${isBull ? 'bg-white border-emerald-100' : isSideways ? 'bg-white border-yellow-100' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Info size={14} className="text-slate-400" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">操作方略</span>
        </div>
        <p className="text-[11px] font-medium text-slate-600 italic">
          {isBull ? '多頭確立，聚焦強勢題材股，可積極布局。' :
           isSideways ? '盤整格局，評分需更高門檻，等待突破方向。' :
           '等待市場量能沉澱，觀察支撐區。'}
        </p>
      </div>
    </div>
  );
};
