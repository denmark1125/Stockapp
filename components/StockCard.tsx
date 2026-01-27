
import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight, Zap, Activity, ShieldAlert } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  quant: {
    signal: string;
    color: 'emerald' | 'rose' | 'slate' | 'amber';
    reason: string;
    isAlert: boolean;
    trend?: 'up' | 'down' | 'stable';
  };
  isPortfolio?: boolean;
  returnPercent?: number;
  buyPrice?: number;
  onSelect: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ 
  stock, 
  quant,
  isPortfolio, 
  returnPercent = 0, 
  buyPrice, 
  onSelect 
}) => {
  const roe = stock.roe || 0;
  const score = stock.ai_score || 0;
  const prevScore = stock.previous_ai_score || score;
  const deltaScore = score - prevScore;
  const revGrowth = stock.revenue_growth || 0;
  
  const styleMap = {
    emerald: {
      border: "border-l-4 border-l-emerald-500 border-slate-100",
      bg: "bg-white",
      signal: "text-emerald-600",
      badge: "bg-emerald-50 text-emerald-700"
    },
    rose: {
      border: isPortfolio ? "border-rose-600" : "border-l-4 border-l-rose-500 border-rose-100",
      bg: isPortfolio ? "bg-rose-600" : "bg-rose-50/30",
      signal: isPortfolio ? "text-white" : "text-rose-600",
      badge: isPortfolio ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
    },
    amber: {
      border: "border-l-4 border-l-amber-500 border-slate-100",
      bg: "bg-white",
      signal: "text-amber-600",
      badge: "bg-amber-50 text-amber-800"
    },
    slate: {
      border: "border-l-4 border-l-slate-300 border-slate-100",
      bg: "bg-slate-50/50",
      signal: "text-slate-400",
      badge: "bg-slate-100 text-slate-500"
    }
  };

  const s = styleMap[quant.color];
  const isStopLoss = isPortfolio && quant.color === 'rose';

  return (
    <div 
      onClick={onSelect}
      className={`relative flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-7 mb-3 rounded-lg border shadow-sm transition-all active:scale-[0.98] cursor-pointer ${s.border} ${s.bg}`}
    >
      {/* 標識與動能 */}
      <div className="flex justify-between items-start mb-4 sm:mb-0 sm:w-1/4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isStopLoss ? 'text-white/70' : 'text-slate-400'}`}>
              {stock.stock_code}
            </span>
            {deltaScore !== 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${deltaScore > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <Zap size={8} fill="currentColor" /> {deltaScore > 0 ? '+' : ''}{deltaScore}
              </span>
            )}
          </div>
          <h3 className={`text-xl sm:text-2xl font-black italic tracking-tighter uppercase leading-none ${isStopLoss ? 'text-white' : 'text-slate-900'}`}>
            {stock.stock_name}
          </h3>
        </div>
        <div className={`sm:hidden px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${s.badge}`}>
          {quant.signal}
        </div>
      </div>

      {/* 數據矩陣 */}
      <div className="grid grid-cols-3 gap-4 sm:flex sm:items-center sm:gap-8 sm:w-1/3 mb-4 sm:mb-0">
        <div className="flex flex-col">
           <span className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isStopLoss ? 'text-white/60' : 'text-slate-400'}`}>AI SCORE</span>
           <span className={`text-lg font-black ${isStopLoss ? 'text-white' : 'text-slate-900'}`}>{score}</span>
        </div>
        <div className="flex flex-col">
           <span className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isStopLoss ? 'text-white/60' : 'text-slate-400'}`}>ROE %</span>
           <span className={`text-lg font-black ${isStopLoss ? 'text-white' : 'text-slate-900'}`}>{roe}%</span>
        </div>
        <div className="flex flex-col">
           <span className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isStopLoss ? 'text-white/60' : 'text-slate-400'}`}>REV YOY</span>
           <span className={`text-lg font-black ${revGrowth > 30 ? (isStopLoss ? 'text-white' : 'text-amber-500') : (isStopLoss ? 'text-white' : 'text-slate-900')}`}>
             {revGrowth > 0 ? '+' : ''}{revGrowth}%
           </span>
        </div>
      </div>

      {/* 理由區（桌機版顯示詳細，手機版隱藏） */}
      <div className="hidden sm:flex flex-col w-1/4 px-6 border-l border-slate-100">
        <span className={`text-base font-black italic uppercase mb-1 ${s.signal}`}>{quant.signal}</span>
        <p className={`text-[11px] leading-relaxed line-clamp-2 italic ${isStopLoss ? 'text-rose-50' : 'text-slate-400'}`}>「{quant.reason}」</p>
      </div>

      {/* 價格與回報 */}
      <div className="flex items-end justify-between sm:flex-col sm:items-end sm:w-auto">
        <div className="sm:hidden text-[11px] font-medium opacity-60 italic max-w-[60%] truncate">
          {quant.reason}
        </div>
        <div className="text-right">
          {isPortfolio ? (
            <div className="flex flex-col items-end">
              <div className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${isStopLoss ? 'text-white/60' : 'text-slate-400'}`}>ALPHA</div>
              <div className={`text-2xl font-black flex items-center gap-1 ${returnPercent >= 0 ? (isStopLoss ? 'text-white' : 'text-emerald-500') : (isStopLoss ? 'text-white' : 'text-white')}`}>
                {returnPercent >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {returnPercent.toFixed(1)}%
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <div className="text-[8px] font-bold uppercase text-slate-400 mb-0.5 tracking-widest">QUOTE</div>
              <div className="text-2xl font-black text-slate-900">${stock.close_price}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
