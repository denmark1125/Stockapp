
import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight, Minus, AlertCircle, Zap } from 'lucide-react';
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
  
  const styleMap = {
    emerald: {
      signalColor: "text-emerald-500",
      borderColor: "border-emerald-100",
      indicatorColor: "bg-emerald-500",
      pulsing: !isPortfolio && quant.trend === 'up'
    },
    rose: {
      signalColor: isPortfolio ? "text-white" : "text-rose-600",
      borderColor: isPortfolio ? "border-rose-500" : "border-rose-100",
      indicatorColor: "bg-rose-600",
      pulsing: isPortfolio || quant.isAlert
    },
    amber: {
      signalColor: "text-amber-600",
      borderColor: "border-amber-100",
      indicatorColor: "bg-amber-400",
      pulsing: true
    },
    slate: {
      signalColor: "text-slate-400",
      borderColor: "border-slate-100",
      indicatorColor: "bg-slate-300",
      pulsing: false
    }
  };

  const currentStyle = styleMap[quant.color];
  const cardBg = (isPortfolio && quant.color === 'rose') ? "bg-rose-600" : "bg-white hover:bg-slate-50";
  const textColor = (isPortfolio && quant.color === 'rose') ? "text-white" : "text-slate-900";
  const mutedColor = (isPortfolio && quant.color === 'rose') ? "text-rose-100" : "text-slate-400";

  return (
    <div 
      onClick={onSelect}
      className={`group relative flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-8 lg:p-12 transition-all cursor-pointer border ${currentStyle.borderColor} ${cardBg} ${currentStyle.pulsing ? 'ring-2 ring-emerald-400/10' : ''} shadow-sm rounded-sm overflow-hidden`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${currentStyle.indicatorColor}`} />

      {/* 左側：基本資訊與變動 */}
      <div className="flex flex-col min-w-0 lg:w-1/4 mb-6 lg:mb-0 lg:pr-8">
        <div className="flex items-center gap-3 mb-2">
          <span className={`mono-text text-[10px] font-black uppercase tracking-widest ${mutedColor}`}>
            {stock.stock_code}
          </span>
          <div className={`flex items-center gap-1 text-[10px] font-bold ${deltaScore > 0 ? 'text-emerald-500' : deltaScore < 0 ? 'text-rose-500' : 'text-slate-300'}`}>
            <Zap size={10} fill="currentColor" />
            Δ {deltaScore > 0 ? '+' : ''}{deltaScore}
          </div>
        </div>
        <h3 className={`text-4xl lg:text-5xl font-black italic tracking-tighter uppercase leading-tight truncate ${textColor}`}>
          {stock.stock_name}
        </h3>
        <div className="mt-2 flex items-center gap-6">
           <div className={`text-[9px] font-bold uppercase tracking-widest ${mutedColor}`}>ROE: {roe}%</div>
           <div className={`text-[9px] font-bold uppercase tracking-widest ${mutedColor}`}>Rev: +{stock.revenue_growth}%</div>
        </div>
      </div>

      {/* 中間：信號 */}
      <div className="flex flex-col items-start lg:items-center lg:justify-center lg:w-1/5 mb-6 lg:mb-0 min-w-0">
        <span className={`text-3xl lg:text-4xl font-black italic tracking-tighter uppercase whitespace-nowrap ${currentStyle.signalColor}`}>
          {quant.signal}
        </span>
        <div className={`mt-2 mono-text text-[9px] uppercase font-bold tracking-[0.2em] opacity-50 ${textColor}`}>
          Score: {score}
        </div>
      </div>

      {/* 右側：動態理由 */}
      <div className="flex flex-col lg:w-1/3 min-w-0 mb-6 lg:mb-0 lg:px-8 border-l border-slate-50 lg:border-slate-100">
        <p className={`text-sm lg:text-base font-medium leading-relaxed italic line-clamp-2 ${isPortfolio && quant.color === 'rose' ? 'text-rose-50' : 'text-slate-500'}`}>
          「{quant.reason}」
        </p>
      </div>

      {/* 數據看板 */}
      <div className="flex items-center justify-between lg:justify-end gap-10 lg:ml-auto flex-shrink-0">
        {isPortfolio ? (
          <div className="flex gap-10 items-center">
            <div className="text-right">
              <div className={`mono-text text-[9px] uppercase ${mutedColor} mb-1 tracking-widest`}>Cost</div>
              <div className={`text-2xl font-black ${textColor}`}>${buyPrice}</div>
            </div>
            <div className="text-right">
              <div className={`mono-text text-[9px] uppercase ${mutedColor} mb-1 tracking-widest`}>Alpha</div>
              <div className={`text-3xl font-black flex items-center justify-end gap-2 ${returnPercent >= 0 ? (isPortfolio && quant.color === 'rose' ? 'text-white' : 'text-emerald-500') : (isPortfolio && quant.color === 'rose' ? 'text-white' : 'text-white')}`}>
                {returnPercent >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                {returnPercent?.toFixed(1)}%
              </div>
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="mono-text text-[9px] uppercase text-slate-300 mb-1 tracking-widest">Quote</div>
            <div className="text-3xl font-black text-slate-900">${stock.close_price}</div>
          </div>
        )}
        <ArrowRight size={28} className={`${mutedColor} group-hover:translate-x-3 transition-all duration-300 hidden lg:block`} />
      </div>
    </div>
  );
};
