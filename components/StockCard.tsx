
import React from 'react';
import { Sparkles, AlertTriangle, ArrowRight, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  isPortfolio?: boolean;
  unrealizedPL?: number;
  returnPercent?: number;
  buyPrice?: number;
  onSelect: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ 
  stock, 
  isPortfolio, 
  returnPercent = 0, 
  buyPrice, 
  onSelect 
}) => {
  const score = stock.ai_score || 0;
  
  // 決定視覺狀態
  let signalText = "HOLD";
  let signalColor = "text-slate-400";
  let bgColor = "bg-slate-50";
  let pulsing = false;
  let textColor = "text-slate-900";

  if (score >= 85) {
    signalText = "STRONG BUY";
    signalColor = "text-emerald-500";
    bgColor = "bg-emerald-50/50 border border-emerald-100";
    pulsing = true;
  } else if (score < 60) {
    signalText = isPortfolio ? "SELL ALERT" : "AVOID";
    signalColor = isPortfolio ? "text-white" : "text-rose-600";
    bgColor = isPortfolio ? "bg-rose-500" : "bg-rose-50 border border-rose-100";
    textColor = isPortfolio ? "text-white" : "text-slate-900";
    pulsing = isPortfolio;
  }

  return (
    <div 
      onClick={onSelect}
      className={`group relative flex flex-col lg:flex-row items-center justify-between p-6 lg:p-10 transition-all cursor-pointer mb-4 ${bgColor} ${pulsing ? 'animate-pulse' : ''} hover:scale-[1.01] hover:shadow-xl rounded-sm`}
    >
      {/* 左：名稱與代碼 */}
      <div className="flex items-center gap-6 w-full lg:w-1/4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className={`mono-text text-[10px] font-black uppercase ${isPortfolio && score < 60 ? 'text-rose-200' : 'text-slate-400'}`}>
              {stock.stock_code}
            </span>
            {isPortfolio && <ShieldCheck size={12} className={score < 60 ? 'text-white' : 'text-emerald-500'} />}
          </div>
          <h3 className={`text-3xl lg:text-4xl font-black italic tracking-tighter uppercase ${textColor}`}>
            {stock.stock_name}
          </h3>
        </div>
      </div>

      {/* 中：AI 評分與標籤 */}
      <div className={`w-full lg:w-1/4 flex flex-col items-center py-4 lg:py-0`}>
        <span className={`text-2xl lg:text-3xl font-black italic tracking-tighter uppercase ${signalColor}`}>
          {signalText}
        </span>
        <div className={`mono-text text-[9px] uppercase font-bold tracking-[0.2em] opacity-50 ${textColor}`}>
          AI Index: {score}
        </div>
      </div>

      {/* 右：本地量化建議 (這就是那個防呆理由) */}
      <div className="w-full lg:w-1/3 flex flex-col">
        <p className={`text-sm lg:text-base font-medium leading-relaxed italic border-l-2 pl-4 ${isPortfolio && score < 60 ? 'text-rose-100 border-rose-300' : 'text-slate-600 border-slate-200'}`}>
          「{stock.ai_suggestion}」
        </p>
      </div>

      {/* 數據區：P/L 呈現 */}
      <div className="w-full lg:w-auto mt-4 lg:mt-0 lg:ml-6 flex items-center justify-end gap-8">
        {isPortfolio ? (
          <div className="flex gap-8 items-center">
            <div className="text-right">
              <div className={`mono-text text-[9px] uppercase ${score < 60 ? 'text-rose-200' : 'text-slate-400'}`}>Entry</div>
              <div className={`text-lg font-bold ${textColor}`}>${buyPrice}</div>
            </div>
            <div className="text-right">
              <div className={`mono-text text-[9px] uppercase ${score < 60 ? 'text-rose-200' : 'text-slate-400'}`}>Return</div>
              <div className={`text-2xl font-black flex items-center gap-2 ${returnPercent >= 0 ? (isPortfolio && score < 60 ? 'text-white' : 'text-emerald-500') : (isPortfolio && score < 60 ? 'text-white' : 'text-rose-600')}`}>
                {returnPercent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                {returnPercent?.toFixed(1)}%
              </div>
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="mono-text text-[9px] uppercase text-slate-400">Current Quote</div>
            <div className="text-2xl font-black text-slate-900">${stock.close_price}</div>
          </div>
        )}
        <ArrowRight size={24} className={`${isPortfolio && score < 60 ? 'text-rose-200' : 'text-slate-300'} group-hover:translate-x-2 transition-all`} />
      </div>
    </div>
  );
};
