
import React from 'react';
import { Zap, Activity, Clock, Award, Rocket, Target } from 'lucide-react';
import { DailyAnalysis } from '../types';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface ActionCardProps {
  stock: DailyAnalysis;
  history?: { close_price: number }[];
  isPortfolio?: boolean;
  isStale?: boolean;
  onSelect: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ 
  stock, history = [], isPortfolio, isStale = false, onSelect 
}) => {
  const isBuy = stock.trade_signal === 'TRADE_BUY';
  const score = stock.ai_score || 0;

  const getBadges = () => {
    const list = [];
    if (isStale) list.push({ text: '待更新', color: 'bg-slate-100 text-slate-400', icon: Clock });
    if (score >= 90) list.push({ text: 'Alpha 核心', color: 'bg-rose-500 text-white shadow-sm', icon: Award });
    if ((stock.roe || 0) > 15) list.push({ text: '品質', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100', icon: Target });
    if ((stock.revenue_yoy || 0) > 20) list.push({ text: '成長', color: 'bg-amber-50 text-amber-600 border border-amber-100', icon: Rocket });
    return list;
  };

  const getTrendColor = () => {
    if (history.length < 2) return '#94a3b8';
    const firstPrice = history[0].close_price;
    const lastPrice = history[history.length - 1].close_price;
    return lastPrice >= firstPrice ? '#f43f5e' : '#10b981';
  };

  return (
    <div 
      onClick={onSelect}
      className={`group relative p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border transition-all duration-500 cursor-pointer bg-white hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] active:scale-[0.98] overflow-hidden
        ${isBuy && !isStale ? 'border-rose-100' : 'border-slate-100'}
        ${isStale ? 'opacity-70 grayscale-[0.3]' : ''}
      `}
    >
      {/* Background Sparkline - 精簡行動版寬度 */}
      {history.length > 1 && (
        <div className="absolute bottom-0 right-0 w-32 sm:w-80 h-16 sm:h-32 opacity-[0.05] sm:opacity-[0.08] pointer-events-none group-hover:opacity-20 transition-opacity duration-700 -z-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line 
                type="monotone" 
                dataKey="close_price" 
                stroke={getTrendColor()} 
                strokeWidth={3} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative z-10 flex flex-col lg:flex-row gap-4 sm:gap-8 items-start sm:items-center">
        {/* Top Info Header */}
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center shadow-md transition-transform group-hover:scale-105 shrink-0
            ${isBuy && !isStale ? 'bg-rose-500 text-white' : 'bg-slate-50 text-slate-400'}
          `}>
            {isBuy ? <Zap size={20} fill="currentColor" className="sm:w-7 sm:h-7" /> : <Activity size={20} className="sm:w-7 sm:h-7" />}
            <span className="text-[8px] sm:text-[9px] font-black uppercase mt-0.5 tracking-widest">{isBuy ? 'Alpha' : 'Audit'}</span>
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap gap-1.5 mb-1 sm:mb-2">
              {getBadges().map((b, i) => (
                <span key={i} className={`${b.color} text-[8px] sm:text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 tracking-tighter`}>
                  <b.icon size={10} /> {b.text}
                </span>
              ))}
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-4xl font-black tracking-tighter text-slate-900 group-hover:text-rose-500 transition-colors">
                {stock.stock_name}
              </h3>
              <span className="text-xs sm:text-lg font-bold text-slate-300 mono-text italic tracking-tighter">{stock.stock_code}</span>
            </div>
          </div>
        </div>

        {/* Comment Section - 行動版隱藏或縮短 */}
        <div className="flex-1 hidden sm:block">
          <p className="serif-text italic text-[15px] text-slate-400 leading-relaxed line-clamp-1">
            {stock.ai_comment || '因子能量顯示當前位置具備高度動能與溢價空間。'}
          </p>
        </div>

        {/* Data Grid - 行動版自適應網格 */}
        <div className="grid grid-cols-3 lg:flex lg:flex-row items-center gap-4 sm:gap-8 w-full lg:w-auto lg:pl-8 lg:border-l lg:border-slate-100 pt-4 sm:pt-0 border-t border-slate-50 sm:border-none">
          <div className="text-left sm:text-right">
            <span className="text-[8px] sm:text-[10px] font-bold text-slate-300 uppercase block mb-0.5">Score</span>
            <div className={`text-xl sm:text-4xl font-black italic tracking-tighter mono-text ${score >= 90 ? 'text-rose-500' : 'text-slate-900'}`}>{score}</div>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[8px] sm:text-[10px] font-bold text-slate-300 uppercase block mb-0.5">Price</span>
            <div className="text-xl sm:text-4xl font-black tracking-tighter mono-text text-slate-950">${stock.close_price}</div>
          </div>
          <div className="bg-slate-50 p-2 sm:p-5 rounded-xl sm:rounded-2xl min-w-0 sm:min-w-[130px] text-center group-hover:bg-rose-50 transition-colors">
             <span className="text-[7px] sm:text-[9px] font-black text-slate-300 group-hover:text-rose-400 block mb-0.5 uppercase tracking-widest">ROE / YoY</span>
             <div className="text-[10px] sm:text-lg font-black mono-text text-slate-900 group-hover:text-rose-600 truncate">
               {stock.roe || 0}% / {stock.revenue_yoy || 0}%
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
