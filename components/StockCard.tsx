import React from 'react';
import { Zap, Activity, Award, Rocket, Target } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  history?: { close_price: number }[];
  isPortfolio?: boolean;
  onSelect: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ 
  stock, isPortfolio, onSelect 
}) => {
  const isBuy = stock.trade_signal === 'TRADE_BUY';
  const score = stock.ai_score || 0;

  return (
    <div 
      onClick={onSelect}
      className={`group relative p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border transition-all duration-500 cursor-pointer bg-white hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] active-scale overflow-hidden
        ${isBuy ? 'border-rose-100 shadow-sm shadow-rose-50' : 'border-slate-100'}
      `}
    >
      <div className="relative z-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        {/* 指標頭部 */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center shadow-md transition-transform group-hover:scale-110 shrink-0
            ${isBuy ? 'bg-rose-500 text-white' : 'bg-slate-50 text-slate-300'}
          `}>
            {isBuy ? <Zap size={18} fill="currentColor" /> : <Activity size={18} />}
            <span className="text-[7px] font-black uppercase mt-1 tracking-widest">{isBuy ? 'Alpha' : 'Audit'}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
               {score >= 90 && (
                 <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 tracking-widest">
                   <Award size={8} /> TOP 1%
                 </span>
               )}
               {stock.roe > 15 && (
                 <span className="bg-slate-950 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 tracking-widest">
                   <Target size={8} /> QUALITY
                 </span>
               )}
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-3xl font-black tracking-tighter text-slate-900 group-hover:text-rose-500 transition-colors truncate">
                {stock.stock_name}
              </h3>
              <span className="text-[10px] sm:text-xs font-bold text-slate-300 mono-text italic tracking-tighter">{stock.stock_code}</span>
            </div>
          </div>
        </div>

        {/* 核心數據區 - 行動版左右排版 */}
        <div className="flex items-center justify-between w-full sm:w-auto sm:ml-auto gap-4 pt-4 sm:pt-0 border-t border-slate-50 sm:border-none">
          <div className="text-left sm:text-right">
            <span className="text-[8px] font-black text-slate-300 uppercase block mb-0.5 tracking-widest">Score</span>
            <div className={`text-xl sm:text-3xl font-black italic tracking-tighter mono-text leading-none ${score >= 90 ? 'text-rose-500' : 'text-slate-950'}`}>{score}</div>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[8px] font-black text-slate-300 uppercase block mb-0.5 tracking-widest">Close</span>
            <div className="text-xl sm:text-3xl font-black tracking-tighter mono-text text-slate-950 leading-none">${stock.close_price}</div>
          </div>
          <div className="bg-slate-50 px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl text-center group-hover:bg-rose-50 transition-colors shrink-0">
             <span className="text-[7px] font-black text-slate-300 group-hover:text-rose-400 block mb-0.5 uppercase tracking-widest">ROE / YoY</span>
             <div className="text-[11px] sm:text-sm font-black mono-text text-slate-900 group-hover:text-rose-600">
               {stock.roe || 0}% / {stock.revenue_yoy || 0}%
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};