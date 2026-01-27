
import React from 'react';
import { Target, ShieldAlert, ArrowUpRight, ArrowDownRight, ChevronRight, Activity } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  isPortfolio?: boolean;
  returnPercent?: number;
  onSelect: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ 
  stock, isPortfolio, returnPercent = 0, onSelect 
}) => {
  const score = stock.ai_score || 0;

  const getSignalConfig = (signal: string) => {
    switch (signal) {
      case 'TRADE_BUY': return { color: 'text-emerald-500', bg: 'bg-emerald-500', label: '多頭進場' };
      case 'TRADE_WATCH': return { color: 'text-amber-500', bg: 'bg-amber-500', label: '持續觀察' };
      case 'INVEST_HOLD': return { color: 'text-blue-500', bg: 'bg-blue-500', label: '穩健持倉' };
      case 'AVOID': return { color: 'text-rose-500', bg: 'bg-rose-500', label: '風險迴避' };
      default: return { color: 'text-slate-400', bg: 'bg-slate-400', label: '掃描中' };
    }
  };

  const config = getSignalConfig(stock.trade_signal);

  return (
    <div 
      onClick={onSelect}
      className="relative p-6 mb-3 bg-white rounded-xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)] transition-all duration-300 cursor-pointer group hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-slate-200"
    >
      {/* 狀態色條 */}
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${config.bg} opacity-80`}></div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* 基本資訊區塊 */}
        <div className="lg:w-1/4">
          <div className="flex items-center gap-2 mb-2">
            <span className="mono-text text-[10px] font-bold text-slate-400 tracking-tighter">{stock.stock_code}</span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${config.bg} text-white uppercase tracking-wider`}>
              {config.label}
            </span>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">
            {stock.stock_name}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em] mt-1.5 flex items-center gap-2">
            <Activity size={10} className="text-slate-300" /> {stock.sector || 'ALPHA SECTOR'}
          </p>
        </div>

        {/* ATR 風控區塊 (對應 Python 2.0x ATR 邏輯) */}
        <div className="flex-1 grid grid-cols-2 gap-4 lg:px-8 lg:border-x border-slate-50">
          <div className="flex items-center gap-3 p-3 bg-rose-50/40 rounded-xl border border-rose-100/30">
            <div className="p-2 bg-white text-rose-500 rounded-lg shadow-sm">
              <ShieldAlert size={14} />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase block tracking-widest mb-0.5">Discipline Stop</span>
              <span className="text-lg font-black text-rose-600 mono-text tracking-tighter">
                {stock.trade_stop ? `$${stock.trade_stop}` : '--'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/30">
            <div className="p-2 bg-white text-emerald-500 rounded-lg shadow-sm">
              <Target size={14} />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase block tracking-widest mb-0.5">Audit Target</span>
              <span className="text-lg font-black text-emerald-600 mono-text tracking-tighter">
                {stock.trade_tp1 ? `$${stock.trade_tp1}` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 評分與績效區塊 */}
        <div className="flex items-center gap-10 lg:w-56 justify-end">
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">AI Score</span>
            <span className={`text-4xl font-black italic tracking-tighter ${score >= 80 ? 'text-emerald-500' : 'text-slate-900'}`}>
              {score > 0 ? score : '--'}
            </span>
          </div>
          
          <div className="text-right min-w-[90px]">
            {isPortfolio ? (
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Return</span>
                <div className={`text-xl font-black flex items-center justify-end gap-1 ${returnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {returnPercent >= 0 ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
                  {Math.abs(returnPercent).toFixed(1)}%
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Market Close</span>
                <div className="text-xl font-black text-slate-900 mono-text tracking-tighter">${stock.close_price}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
        <ChevronRight size={20} className="text-slate-200" />
      </div>
    </div>
  );
};
