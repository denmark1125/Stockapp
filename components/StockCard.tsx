
import React from 'react';
import { Sparkles, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  isPortfolio?: boolean;
  unrealizedPL?: number;
  returnPercent?: number;
  onSelect: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ stock, isPortfolio, unrealizedPL, returnPercent, onSelect }) => {
  const score = stock.ai_score || 0;
  
  // 決策邏輯
  let signal = "HOLD";
  let signalColor = "text-slate-400";
  let bgColor = "bg-slate-50";
  let pulsing = false;

  if (score >= 85) {
    signal = "STRONG BUY";
    signalColor = "text-white";
    bgColor = "bg-emerald-500";
    pulsing = true;
  } else if (score >= 75) {
    signal = "BUY";
    signalColor = "text-emerald-600";
    bgColor = "bg-emerald-50 border-emerald-100 border";
  } else if (score < 60) {
    signal = isPortfolio ? "SELL ALERT" : "AVOID";
    signalColor = "text-rose-600 font-black";
    bgColor = "bg-rose-50 border-rose-100 border";
  }

  const getAiReason = (s: DailyAnalysis) => {
    if (s.ai_score && s.ai_score >= 85) return "領先指標全面噴發，法人籌碼高度集中，建議果斷佈局。";
    if (s.technical_signal?.includes('金叉')) return "技術面呈現黃金交叉，短線動能強勁。";
    if (s.roe && s.roe > 20) return "超高 ROE 展現強大護城河，基本面無懈可擊。";
    if (s.revenue_growth && s.revenue_growth > 20) return "營收高速成長，動能足以支撐當前評價。";
    if (s.ai_score && s.ai_score < 60) return "AI 評分轉弱，技術面出現頂部背離訊號。";
    return "評價合理，適合分批佈局或繼續觀察。";
  };

  return (
    <div 
      onClick={onSelect}
      className={`group relative flex flex-col lg:flex-row items-center justify-between p-6 lg:p-10 transition-all cursor-pointer mb-4 ${bgColor} ${pulsing ? 'animate-pulse' : ''} hover:scale-[1.01] hover:shadow-xl`}
    >
      {/* 左：身分/名稱 */}
      <div className="flex items-center gap-6 w-full lg:w-1/4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="mono-text text-[10px] font-black uppercase text-slate-400">{stock.stock_code}</span>
            {isPortfolio && <ShieldCheck size={12} className="text-emerald-500" />}
          </div>
          <h3 className="text-3xl lg:text-4xl font-black italic tracking-tighter uppercase">{stock.stock_name}</h3>
        </div>
      </div>

      {/* 中：信號 */}
      <div className={`w-full lg:w-1/4 flex flex-col items-center py-4 lg:py-0`}>
        <span className={`text-2xl lg:text-3xl font-black italic tracking-tighter ${signalColor}`}>
          {signal}
        </span>
        <div className="mono-text text-[9px] uppercase font-bold tracking-[0.2em] opacity-50">Score: {score}</div>
      </div>

      {/* 右：理由 */}
      <div className="w-full lg:w-1/3 flex flex-col">
        <p className="text-slate-600 text-sm lg:text-base font-medium leading-relaxed italic border-l-2 border-slate-200 pl-4">
          「{getAiReason(stock)}」
        </p>
      </div>

      {/* 底部數據 (僅 CEO 關心的) */}
      <div className="w-full lg:w-auto mt-4 lg:mt-0 lg:ml-6 flex items-center justify-end gap-6">
        {isPortfolio ? (
          <div className="text-right">
            <div className="mono-text text-[9px] uppercase text-slate-400">P/L Impact</div>
            <div className={`text-xl font-black ${unrealizedPL && unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {returnPercent?.toFixed(1)}%
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="mono-text text-[9px] uppercase text-slate-400">Entry Target</div>
            <div className="text-xl font-black text-slate-900">${stock.close_price}</div>
          </div>
        )}
        <ArrowRight size={24} className="text-slate-300 group-hover:text-slate-900 group-hover:translate-x-2 transition-all" />
      </div>
    </div>
  );
};
