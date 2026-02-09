
import React from 'react';
import { Target, Shield, ArrowUpRight, ArrowDownRight, TrendingUp, Zap, Sparkles } from 'lucide-react';
import { DailyAnalysis } from '../types';
import { getManagerAdvice } from '../utils/managerLogic';

interface ActionCardProps {
  stock: DailyAnalysis;
  onSelect: () => void;
  strategyMode: 'short' | 'long';
}

export const ActionCard: React.FC<ActionCardProps> = ({ stock, onSelect, strategyMode }) => {
  const advice = getManagerAdvice(stock, strategyMode);
  const isProfit = (stock.profit_loss_ratio || 0) >= 0;

  return (
    <div 
      onClick={onSelect}
      className={`group relative rounded-[2.5rem] border japanese-border bg-white transition-all duration-500 cursor-pointer hover:shadow-2xl active:scale-[0.98] overflow-hidden flex flex-col h-full
        ${advice.status === 'ENTRY' ? 'ring-2 ring-[#C83232] ring-offset-4' : ''}
        ${stock.is_holding_item ? 'border-[#1A1A1A] bg-slate-50/30' : ''}`}
    >
      {/* 信心指數裝飾條 */}
      <div className="absolute top-0 left-0 h-1.5 bg-[#C83232]" style={{ width: `${advice.conviction}%` }}></div>

      <div className="p-7 pb-4">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold mono-text text-slate-300 tracking-widest">{stock.stock_code}</span>
              {advice.conviction > 90 && <Sparkles size={12} className="text-[#C83232]" />}
            </div>
            <h3 className="serif-text text-3xl font-bold text-[#1A1A1A] leading-tight">{stock.stock_name}</h3>
          </div>
          <div className="text-right">
             <div className="text-2xl font-bold mono-text leading-none italic text-[#1A1A1A]">
               {stock.close_price}
             </div>
             {stock.is_holding_item && (
               <div className={`text-[11px] font-bold mt-1.5 flex items-center justify-end gap-1 ${isProfit ? 'text-emerald-600' : 'text-[#C83232]'}`}>
                 {isProfit ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                 {stock.profit_loss_ratio?.toFixed(1)}%
               </div>
             )}
          </div>
        </div>

        {/* 狀態標籤 */}
        <div className="flex flex-wrap gap-2 mb-8">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all
            ${advice.status === 'ENTRY' ? 'bg-[#C83232] text-white border-[#C83232]' : 
              advice.status === 'HOLD' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            {advice.statusLabel}
          </span>
          <span className="bg-slate-50 text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-100">
            {advice.modeLabel}
          </span>
        </div>

        {/* 經理人指令 */}
        <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-widest">獲利指令 / Instruction</span>
          <p className="text-sm font-bold text-[#1A1A1A] leading-relaxed italic">
            「{advice.action}」
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
             <span className="text-[9px] font-bold text-slate-400 block mb-1">進場建議</span>
             <div className="text-[15px] font-bold mono-text italic">{advice.entry.price}</div>
           </div>
           <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
             <span className="text-[9px] font-bold text-slate-400 block mb-1">停利目標</span>
             <div className="text-[15px] font-bold mono-text text-emerald-600 italic">{advice.exit.price}</div>
           </div>
        </div>
      </div>

      <div className="mt-auto border-t border-slate-50 p-5 flex items-center justify-between">
         <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase">量比</span>
              <span className="text-xs font-bold text-[#1A1A1A] mono-text">{stock.vol_ratio?.toFixed(1)}x</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase">信心</span>
              <span className="text-xs font-bold text-[#C83232] mono-text">{advice.conviction}%</span>
            </div>
         </div>
         <button className="bg-[#1A1A1A] text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 hover:bg-[#C83232] transition-colors">
            詳情審核 <TrendingUp size={12} />
         </button>
      </div>
    </div>
  );
};
