
import React from 'react';
import { Zap, Target, ShieldAlert, TrendingUp, AlertTriangle, ArrowRightCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { DailyAnalysis } from '../types';
import { getManagerAdvice } from '../utils/managerLogic';

interface ActionCardProps {
  stock: DailyAnalysis;
  onSelect: () => void;
  strategyMode: 'short' | 'long';
}

export const ActionCard: React.FC<ActionCardProps> = ({ stock, onSelect, strategyMode }) => {
  const advice = getManagerAdvice(stock, strategyMode);
  const isShort = strategyMode === 'short';
  const isProfit = (stock.profit_loss_ratio || 0) >= 0;

  return (
    <div 
      onClick={onSelect}
      className={`group relative rounded-[2rem] lg:rounded-[2.5rem] border-2 transition-all duration-300 cursor-pointer bg-white hover:shadow-xl active:scale-[0.99] overflow-hidden flex flex-col
        ${isShort ? 'border-rose-100 hover:border-rose-300' : 'border-blue-100 hover:border-blue-300'}
        ${stock.is_holding_item ? 'ring-2 ring-slate-950 ring-offset-2' : ''}`}
    >
      <div className="p-6 lg:p-8 pb-4 lg:pb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm border
              ${isShort ? 'bg-rose-600 text-white border-rose-700' : 'bg-blue-600 text-white border-blue-700'}`}>
              {advice.modeLabel}
            </span>
            {stock.is_holding_item && (
              <span className="bg-slate-950 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1">
                <ShieldAlert size={10} className="text-amber-500" /> IN VAULT
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
        
        <div className="flex gap-6 items-center">
          {stock.is_holding_item && (
            <div className="text-right border-r border-slate-100 pr-6">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">UNREALIZED P/L</span>
              <div className={`text-xl font-black mono-text leading-none italic flex items-center gap-1 justify-end ${isProfit ? 'text-emerald-500' : 'text-rose-600'}`}>
                {isProfit ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {stock.profit_loss_ratio?.toFixed(2)}%
              </div>
            </div>
          )}
          <div className="text-right">
            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest block mb-0.5">Market Price</span>
            <div className="text-3xl lg:text-4xl font-black text-slate-950 mono-text leading-none italic flex items-baseline gap-1 lg:justify-end">
              <span className="text-lg text-slate-300">$</span>{stock.close_price}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-4 mb-6">
        <div className={`${stock.is_holding_item ? 'bg-slate-950' : 'bg-emerald-500'} p-5 lg:p-6 rounded-2xl text-white flex flex-col justify-between shadow-md transition-colors`}>
          <div className="flex items-center gap-1.5 mb-2 opacity-80 uppercase text-[8px] font-black">
            {stock.is_holding_item ? 'YOUR COST' : 'BUY DIRECTION'}
          </div>
          <div className="text-2xl lg:text-3xl font-black mono-text tracking-tighter">
            {stock.is_holding_item ? stock.buy_price : advice.entry.price}
          </div>
        </div>
        <div className={`${isShort ? 'bg-rose-500' : 'bg-blue-500'} p-5 lg:p-6 rounded-2xl text-white flex flex-col justify-between shadow-md`}>
          <div className="flex items-center gap-1.5 mb-2 opacity-80 uppercase text-[8px] font-black">TARGET EXIT</div>
          <div className="text-2xl lg:text-3xl font-black mono-text tracking-tighter">{advice.exit.price}</div>
        </div>
        <div className="bg-slate-800 p-5 lg:p-6 rounded-2xl text-white flex flex-col justify-between shadow-md">
          <div className="flex items-center gap-1.5 mb-2 opacity-80 uppercase text-[8px] font-black">HARD STOP</div>
          <div className="text-2xl lg:text-3xl font-black mono-text tracking-tighter">{advice.stop.price}</div>
        </div>
      </div>

      <div className="mt-auto bg-slate-50 p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:items-center border-t border-slate-100">
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-600 italic leading-snug">
            "{stock.ai_comment || '因子已校準。'}"
          </p>
        </div>
        <div className="flex gap-2">
            <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl text-center min-w-[60px]">
              <span className="text-[8px] font-bold text-slate-400 uppercase block">量比</span>
              <span className="text-sm font-black text-slate-800 mono-text">{stock.vol_ratio?.toFixed(1)}x</span>
            </div>
            <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl text-center min-w-[60px]">
              <span className="text-[8px] font-bold text-slate-400 uppercase block">波動</span>
              <span className="text-sm font-black text-rose-600 mono-text">{stock.volatility?.toFixed(1)}%</span>
            </div>
            {stock.is_holding_item && (
              <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-center min-w-[60px]">
                <span className="text-[8px] font-bold text-slate-500 uppercase block">持股</span>
                <span className="text-sm font-black text-white mono-text">{stock.quantity}</span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
