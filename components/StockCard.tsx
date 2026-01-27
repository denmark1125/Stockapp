
import React from 'react';
import { TrendingUp, Target, ShieldAlert, ArrowUpRight, ArrowDownRight, Activity, ChevronRight } from 'lucide-react';
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
  const score = stock.ai_score || 0;

  // 對應 Python 腳本的信號顏色
  const getSignalStyle = (signal: string) => {
    if (signal === 'TRADE_BUY' || signal === 'INVEST_BUY') return { bg: 'bg-emerald-500', text: 'text-emerald-500', label: '多頭確信' };
    if (signal === 'TRADE_WATCH' || signal === 'INVEST_HOLD') return { bg: 'bg-amber-500', text: 'text-amber-500', label: '持續觀察' };
    return { bg: 'bg-slate-400', text: 'text-slate-400', label: '暫避風險' };
  };

  const sigStyle = getSignalStyle(stock.trade_signal || '');

  return (
    <div 
      onClick={onSelect}
      className="relative p-5 mb-3 bg-white rounded-sm border border-slate-200/60 shadow-sm transition-all duration-300 cursor-pointer group hover:shadow-lg hover:border-slate-300 overflow-hidden"
    >
      {/* 頂部信號條 */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${sigStyle.bg}`}></div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* 1. 標的基本資訊 */}
        <div className="lg:w-1/4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="mono-text text-[10px] font-bold text-slate-400">{stock.stock_code}</span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm bg-slate-100 ${sigStyle.text} uppercase tracking-tighter`}>
              {stock.trade_signal || 'AVOID'}
            </span>
          </div>
          <h3 className="text-2xl font-black italic tracking-tighter text-slate-900 group-hover:text-emerald-600 transition-colors">
            {stock.stock_name}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {stock.data_tier ? `Tier ${stock.data_tier}` : 'Standard'} Analysis
          </p>
        </div>

        {/* 2. 風控價位區 (核心更新) */}
        <div className="flex-1 grid grid-cols-2 gap-4 lg:px-8 lg:border-x border-slate-100">
          <div className="flex items-center gap-4 p-3 bg-rose-50/50 rounded-sm border border-rose-100/50">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
              <ShieldAlert size={16} />
            </div>
            <div>
              <span className="text-[9px] font-black text-rose-400 uppercase block tracking-tighter">STOP LOSS 停損</span>
              <span className="text-xl font-black text-rose-600">
                {stock.trade_stop ? `$${stock.trade_stop}` : '--'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 p-3 bg-emerald-50/50 rounded-sm border border-emerald-100/50">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
              <Target size={16} />
            </div>
            <div>
              <span className="text-[9px] font-black text-emerald-400 uppercase block tracking-tighter">TARGET 獲利</span>
              <span className="text-xl font-black text-emerald-600">
                {stock.trade_tp1 ? `$${stock.trade_tp1}` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. AI 分數 */}
        <div className="flex items-center gap-6 lg:w-48 justify-end">
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">AI Score</span>
            <span className={`text-3xl font-black italic ${score >= 80 ? 'text-emerald-500' : 'text-slate-900'}`}>
              {score}
            </span>
          </div>
          
          <div className="text-right min-w-[100px]">
            {isPortfolio ? (
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Return 損益</span>
                <div className={`text-2xl font-black flex items-center justify-end gap-1 ${returnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {returnPercent >= 0 ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>}
                  {returnPercent.toFixed(1)}%
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Price 現價</span>
                <div className="text-2xl font-black text-slate-900">${stock.close_price}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="absolute right-2 bottom-2 opacity-20 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={20} className="text-slate-300" />
      </div>
    </div>
  );
};
