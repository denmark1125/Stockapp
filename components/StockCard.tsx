
import React from 'react';
import { ShieldCheck, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  quant: {
    signal: string;
    color: 'emerald' | 'rose' | 'slate';
    reason: string;
    isAlert: boolean;
  };
  isPortfolio?: boolean;
  unrealizedPL?: number;
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
  
  // 依照傳入的 quant.color 決定視覺風格
  const styleMap = {
    emerald: {
      signalColor: "text-emerald-500",
      bgColor: "bg-emerald-50/50 border border-emerald-100",
      pulsing: !isPortfolio // 非庫存的高分股可以跳動吸引注意
    },
    rose: {
      signalColor: isPortfolio ? "text-white" : "text-rose-600",
      bgColor: isPortfolio ? "bg-rose-500" : "bg-rose-50 border border-rose-100",
      pulsing: isPortfolio // 庫存警報必須跳動
    },
    slate: {
      signalColor: "text-slate-400",
      bgColor: "bg-slate-50 border border-slate-100",
      pulsing: false
    }
  };

  const currentStyle = styleMap[quant.color];
  const textColor = (isPortfolio && quant.color === 'rose') ? "text-white" : "text-slate-900";

  return (
    <div 
      onClick={onSelect}
      className={`group relative flex flex-col lg:flex-row items-center justify-between p-6 lg:p-10 transition-all cursor-pointer mb-4 ${currentStyle.bgColor} ${currentStyle.pulsing ? 'animate-pulse' : ''} hover:scale-[1.01] hover:shadow-xl rounded-sm`}
    >
      {/* 左：名稱與代碼 */}
      <div className="flex items-center gap-6 w-full lg:w-1/4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className={`mono-text text-[10px] font-black uppercase ${isPortfolio && quant.color === 'rose' ? 'text-rose-200' : 'text-slate-400'}`}>
              {stock.stock_code}
            </span>
            {isPortfolio && <ShieldCheck size={12} className={quant.color === 'rose' ? 'text-white' : 'text-emerald-500'} />}
          </div>
          <h3 className={`text-3xl lg:text-4xl font-black italic tracking-tighter uppercase ${textColor}`}>
            {stock.stock_name}
          </h3>
          <div className={`text-[10px] font-bold uppercase opacity-60 ${textColor}`}>ROE: {roe}%</div>
        </div>
      </div>

      {/* 中：訊號 */}
      <div className={`w-full lg:w-1/4 flex flex-col items-center py-4 lg:py-0`}>
        <span className={`text-2xl lg:text-3xl font-black italic tracking-tighter uppercase ${currentStyle.signalColor}`}>
          {quant.signal}
        </span>
        <div className={`mono-text text-[9px] uppercase font-bold tracking-[0.2em] opacity-50 ${textColor}`}>
          AI Rating: {stock.ai_score || 0}
        </div>
      </div>

      {/* 右：量化理由 (由父組件統一提供) */}
      <div className="w-full lg:w-1/3 flex flex-col">
        <p className={`text-sm lg:text-base font-medium leading-relaxed italic border-l-2 pl-4 ${isPortfolio && quant.color === 'rose' ? 'text-rose-100 border-rose-300' : 'text-slate-600 border-slate-200'}`}>
          「{quant.reason}」
        </p>
      </div>

      {/* 數據區 */}
      <div className="w-full lg:w-auto mt-4 lg:mt-0 lg:ml-6 flex items-center justify-end gap-8">
        {isPortfolio ? (
          <div className="flex gap-8 items-center">
            <div className="text-right">
              <div className={`mono-text text-[9px] uppercase ${isPortfolio && quant.color === 'rose' ? 'text-rose-200' : 'text-slate-400'}`}>成本</div>
              <div className={`text-lg font-bold ${textColor}`}>${buyPrice}</div>
            </div>
            <div className="text-right">
              <div className={`mono-text text-[9px] uppercase ${isPortfolio && quant.color === 'rose' ? 'text-rose-200' : 'text-slate-400'}`}>報酬</div>
              <div className={`text-2xl font-black flex items-center gap-2 ${returnPercent >= 0 ? (isPortfolio && quant.color === 'rose' ? 'text-white' : 'text-emerald-500') : (isPortfolio && quant.color === 'rose' ? 'text-white' : 'text-rose-600')}`}>
                {returnPercent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                {returnPercent?.toFixed(1)}%
              </div>
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="mono-text text-[9px] uppercase text-slate-400">目前股價</div>
            <div className="text-2xl font-black text-slate-900">${stock.close_price}</div>
          </div>
        )}
        <ArrowRight size={24} className={`${isPortfolio && quant.color === 'rose' ? 'text-rose-200' : 'text-slate-300'} group-hover:translate-x-2 transition-all`} />
      </div>
    </div>
  );
};
