
import React from 'react';
import { TrendingUp, TrendingDown, Zap, Activity, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import { DailyAnalysis, TradeSignal } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  quant: TradeSignal;
  isPortfolio?: boolean;
  returnPercent?: number;
  buyPrice?: number;
  onSelect: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ 
  stock, quant, isPortfolio, returnPercent = 0, buyPrice, onSelect 
}) => {
  const roe = stock.roe;
  const score = stock.ai_score || 0;
  const revGrowth = stock.revenue_growth || 0;
  const pe = stock.pe_ratio;

  const styleMap = {
    emerald: {
      border: "border-l-4 border-l-emerald-500",
      bg: "bg-white",
      text: "text-emerald-700",
      icon: <TrendingUp size={18} className="text-emerald-500" />
    },
    amber: {
      border: "border-l-4 border-l-amber-500",
      bg: "bg-white",
      text: "text-amber-700",
      icon: <Zap size={18} className="text-amber-500" />
    },
    rose: {
      border: "border-l-4 border-l-rose-500",
      bg: isPortfolio ? "bg-rose-50/30" : "bg-white",
      text: "text-rose-700",
      icon: <AlertTriangle size={18} className="text-rose-500" />
    },
    slate: {
      border: "border-l-4 border-l-slate-300",
      bg: "bg-slate-50/50",
      text: "text-slate-600",
      icon: <Activity size={18} className="text-slate-400" />
    }
  };

  const s = styleMap[quant.color];

  return (
    <div 
      onClick={onSelect}
      className={`relative p-5 mb-3 rounded-sm border border-slate-200/60 shadow-sm transition-all duration-300 cursor-pointer group hover:shadow-md ${s.border} ${s.bg}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* 標的資訊與標籤 */}
        <div className="lg:w-1/4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="mono-text text-[10px] font-bold text-slate-400">{stock.stock_code}</span>
            <div className="flex gap-1">
              {quant.tags.slice(0, 2).map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 text-[9px] font-black rounded-sm bg-slate-100 text-slate-500 uppercase tracking-tighter">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <h3 className="text-xl font-black italic tracking-tighter text-slate-900 group-hover:text-emerald-600 transition-colors">
            {stock.stock_name}
          </h3>
        </div>

        {/* 核心數據矩陣 */}
        <div className="grid grid-cols-4 gap-4 lg:w-1/3 py-3 lg:py-0 border-y lg:border-none border-slate-50">
          <div className="text-center md:text-left">
            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">AI 分數</span>
            <span className={`text-lg font-black ${score >= 80 ? 'text-emerald-600' : 'text-slate-900'}`}>{score}</span>
          </div>
          <div className="text-center md:text-left">
            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">ROE %</span>
            <span className={`text-lg font-black ${roe === null || roe <= 0 ? 'text-rose-500' : 'text-slate-900'}`}>
              {roe === null || roe <= 0 ? '虧損' : `${roe}%`}
            </span>
          </div>
          <div className="text-center md:text-left">
            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">營收年增</span>
            <span className={`text-lg font-black ${revGrowth >= 25 ? 'text-amber-500' : 'text-slate-900'}`}>{revGrowth}%</span>
          </div>
          <div className="text-center md:text-left">
            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">本益比</span>
            <span className="text-lg font-black text-slate-900">
              {pe === null || pe === 0 ? '-' : pe}
            </span>
          </div>
        </div>

        {/* 審計點評 */}
        <div className="lg:w-1/4 lg:px-6 lg:border-l border-slate-100">
           <div className="flex items-center gap-2 mb-1">
             <span className={`text-[10px] font-black italic uppercase px-1.5 py-0.5 rounded ${s.text} bg-slate-50`}>
               {quant.signal}
             </span>
           </div>
           <p className="text-[11px] text-slate-500 font-medium italic leading-snug line-clamp-2">「{quant.reason}」</p>
        </div>

        {/* 報價與損益 */}
        <div className="flex justify-between items-center lg:flex-col lg:items-end lg:w-40">
          {isPortfolio ? (
            <div className="text-right space-y-1">
              <div className="flex justify-end gap-3 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                <span>Buy ${buyPrice}</span>
                <span className="text-slate-900">Curr ${stock.close_price}</span>
              </div>
              <div className={`text-2xl font-black ${returnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(1)}%
              </div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">成交價 Price</div>
              <div className="text-2xl font-black text-slate-900">${stock.close_price}</div>
            </div>
          )}
        </div>
      </div>
      <div className="absolute right-2 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={14} className="text-slate-300" />
      </div>
    </div>
  );
};
