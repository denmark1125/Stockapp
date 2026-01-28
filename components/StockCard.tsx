
import React from 'react';
import { Zap, Target, ShieldAlert, TrendingUp, AlertTriangle, ArrowRightCircle } from 'lucide-react';
import { DailyAnalysis } from '../types';
import { getManagerAdvice } from '../utils/managerLogic';

interface ActionCardProps {
  stock: DailyAnalysis;
  onSelect: () => void;
  strategyMode: 'short' | 'long';
}

export const ActionCard: React.FC<ActionCardProps> = ({ stock, onSelect, strategyMode }) => {
  // 根據主介面的切換模式獲取建議，確保分類與建議一致
  const advice = getManagerAdvice(stock, strategyMode);
  const isShort = strategyMode === 'short';

  return (
    <div 
      onClick={onSelect}
      className={`group relative rounded-[2rem] lg:rounded-[2.5rem] border-2 transition-all duration-300 cursor-pointer bg-white hover:shadow-xl active:scale-[0.99] overflow-hidden flex flex-col
        ${isShort ? 'border-rose-100 hover:border-rose-300' : 'border-blue-100 hover:border-blue-300'}`}
    >
      {/* 上半部：核心識別 - 縮小 Padding */}
      <div className="p-6 lg:p-8 pb-4 lg:pb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm border
              ${isShort ? 'bg-rose-600 text-white border-rose-700' : 'bg-blue-600 text-white border-blue-700'}`}>
              {advice.modeLabel}
            </span>
            {advice.riskWarning && (
              <span className="bg-amber-50 text-amber-700 text-[8px] font-black px-2 py-1 rounded-lg uppercase flex items-center gap-1 border border-amber-100">
                <AlertTriangle size={10} /> {advice.riskWarning}
              </span>
            )}
            <span className="bg-slate-50 text-slate-400 text-[9px] font-bold px-2 py-1 rounded-lg border border-slate-100">
              {stock.stock_code}
            </span>
          </div>
          <h3 className="text-2xl lg:text-4xl font-black tracking-tighter text-slate-900 uppercase leading-tight truncate">
            {stock.stock_name}
          </h3>
        </div>
        
        <div className="text-left lg:text-right shrink-0">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Current Price</span>
          <div className="text-3xl lg:text-4xl font-black text-slate-950 mono-text leading-none italic flex items-baseline gap-1 lg:justify-end">
            <span className="text-lg text-slate-300">$</span>{stock.close_price}
          </div>
        </div>
      </div>

      {/* 中部：執行指令格 - 縮小高度與間距 */}
      <div className="px-4 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-4 mb-6">
        {/* 進場 */}
        <div className="bg-emerald-500 p-5 lg:p-6 rounded-2xl text-white flex flex-col justify-between shadow-md transition-transform group-hover:translate-y-[-2px]">
          <div>
            <div className="flex items-center gap-1.5 mb-2 opacity-80">
              <TrendingUp size={14} />
              <span className="text-[8px] font-black uppercase tracking-widest">BUY</span>
            </div>
            <p className="text-[10px] font-bold leading-tight line-clamp-1 mb-2 opacity-90">{advice.entry.text}</p>
          </div>
          <div className="text-2xl lg:text-3xl font-black mono-text tracking-tighter">{advice.entry.price}</div>
        </div>

        {/* 出場 */}
        <div className={`${isShort ? 'bg-rose-500' : 'bg-blue-500'} p-5 lg:p-6 rounded-2xl text-white flex flex-col justify-between shadow-md transition-transform delay-75 group-hover:translate-y-[-2px]`}>
          <div>
            <div className="flex items-center gap-1.5 mb-2 opacity-80">
              <Target size={14} />
              <span className="text-[8px] font-black uppercase tracking-widest">EXIT</span>
            </div>
            <p className="text-[10px] font-bold leading-tight line-clamp-1 mb-2 opacity-90">{advice.exit.text}</p>
          </div>
          <div className="text-2xl lg:text-3xl font-black mono-text tracking-tighter">{advice.exit.price}</div>
        </div>

        {/* 停損 */}
        <div className="bg-slate-800 p-5 lg:p-6 rounded-2xl text-white flex flex-col justify-between shadow-md transition-transform delay-150 group-hover:translate-y-[-2px]">
          <div>
            <div className="flex items-center gap-1.5 mb-2 opacity-80">
              <ShieldAlert size={14} />
              <span className="text-[8px] font-black uppercase tracking-widest">STOP</span>
            </div>
            <p className="text-[10px] font-bold leading-tight line-clamp-1 mb-2 opacity-90">{advice.stop.text}</p>
          </div>
          <div className="text-2xl lg:text-3xl font-black mono-text tracking-tighter">{advice.stop.price}</div>
        </div>
      </div>

      {/* 下半部：短評 - 縮減 Padding */}
      <div className="mt-auto bg-slate-50 p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:items-center border-t border-slate-100">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-500 fill-amber-500" />
            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Terminal Intelligence</span>
          </div>
          <p className="text-xs font-bold text-slate-600 italic leading-snug">
            "{stock.ai_comment || '因子已校準。'}"
          </p>
        </div>
        
        <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-none border-slate-100 pt-3 lg:pt-0">
          <div className="flex gap-2 text-center">
            <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl">
              <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-tighter">量比</span>
              <span className="text-sm font-black text-slate-800 mono-text">{stock.vol_ratio?.toFixed(1)}x</span>
            </div>
            <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl">
              <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-tighter">當沖分</span>
              <span className="text-sm font-black text-rose-600 mono-text">{stock.score_short}</span>
            </div>
          </div>
          <div className="bg-slate-900 p-2 rounded-full text-white hover:bg-rose-600 transition-all">
            <ArrowRightCircle size={20} />
          </div>
        </div>
      </div>
    </div>
  );
};
