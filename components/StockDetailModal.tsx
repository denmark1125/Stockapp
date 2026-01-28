
import React, { useState, useEffect } from 'react';
import { 
  X, Zap, ChevronRight, History, Loader2, Star, Target
} from 'lucide-react';
import { DailyAnalysis } from '../types';
import { fetchStockHistory } from '../services/supabase';
import { 
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';

interface StockDetailModalProps {
  stock: DailyAnalysis;
  onClose: () => void;
  onRunAi: (stock: DailyAnalysis) => void;
  onRemove?: (id: string) => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ stock, onClose, onRunAi }) => {
  const [history, setHistory] = useState<DailyAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistoryData = async () => {
      setLoading(true);
      try {
        const data = await fetchStockHistory(stock.stock_code);
        setHistory(data);
      } finally {
        setLoading(false);
      }
    };
    loadHistoryData();
  }, [stock.stock_code]);

  const isNewEntry = history.length <= 1;

  const getSignalLabel = (signal: string) => {
    switch (signal.toUpperCase()) {
      case 'TRADE_BUY': return '🎯 強力買進';
      case 'SELL': return '🛑 止損賣出';
      case 'INVEST_HOLD': return '💎 持有續抱';
      case 'TRADE_WATCH': return '👀 觀察等待';
      default: return '⚠️ 審慎評估';
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xl">
      <div className="w-full max-w-5xl bg-white rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] sm:h-fit sm:max-h-[90vh]">
        
        {/* Mobile Close Button */}
        <button onClick={onClose} className="sm:hidden absolute top-6 right-6 z-50 bg-white/10 backdrop-blur-md p-2 rounded-full text-white"><X size={20}/></button>

        {/* Sidebar / Header */}
        <div className="w-full md:w-[320px] bg-slate-950 text-white p-8 sm:p-10 flex flex-col shrink-0">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <span className="bg-rose-500 text-white text-[8px] sm:text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-widest">
              Alpha Terminal
            </span>
            <span className="mono-text text-[9px] sm:text-[10px] text-slate-500 font-bold">{stock.stock_code}</span>
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-black italic tracking-tighter uppercase leading-tight mb-2 sm:mb-4">
            {stock.stock_name}
          </h2>
          <p className="text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-6 sm:mb-10">價值審計終端</p>

          <div className="mt-auto hidden sm:block">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 mb-6">
              <span className="text-[10px] text-slate-500 uppercase font-black block mb-2 tracking-widest">當前實戰訊號</span>
              <div className="text-xl font-black text-rose-500">{getSignalLabel(stock.trade_signal)}</div>
            </div>
            <button onClick={onClose} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">返回主螢幕</button>
          </div>
          
          {/* Mobile Signal Badge */}
          <div className="sm:hidden inline-flex px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl w-fit">
            <span className="text-xs font-black text-rose-500">{getSignalLabel(stock.trade_signal)}</span>
          </div>
        </div>

        {/* Analytics Content */}
        <div className="flex-1 p-6 sm:p-14 overflow-y-auto bg-white">
          
          {/* Chart Section */}
          <div className="mb-8 sm:mb-12">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-4 sm:mb-8">
              <History size={14} className="text-rose-500" /> 30日 因子戰情
            </h3>
            <div className="h-[240px] sm:h-[340px] w-full bg-slate-50 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 border border-slate-100 relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="animate-spin text-rose-500" size={24} />
                </div>
              ) : isNewEntry ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <Star fill="currentColor" size={32} className="text-rose-500 mb-4 animate-pulse" />
                  <p className="font-black text-slate-900 uppercase tracking-widest text-sm mb-1">🔥 首度入榜新星</p>
                  <p className="text-[9px] uppercase tracking-widest leading-relaxed">此標的為今日首次通過篩選，動能正處於爆發點。</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={history}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="analysis_date" hide />
                    <YAxis yAxisId="left" hide domain={[0, 100]} />
                    <YAxis yAxisId="right" hide domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    />
                    <Area yAxisId="left" type="monotone" dataKey="ai_score" stroke="#f43f5e" fill="url(#colorScore)" strokeWidth={3} />
                    <Line yAxisId="right" type="monotone" dataKey="close_price" stroke="#1a1a1a" strokeWidth={2} dot={{ r: 4, fill: '#1a1a1a' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12 py-6 sm:py-10 border-y border-slate-100">
             <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-widest">ROE</span>
                <span className="text-xl sm:text-3xl font-black text-slate-900 mono-text">{stock.roe ? `${stock.roe}%` : '--'}</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-widest">P/E</span>
                <span className="text-xl sm:text-3xl font-black text-slate-900 mono-text">{stock.pe_ratio ? `${stock.pe_ratio}x` : '--'}</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-widest">YoY</span>
                <span className={`text-xl sm:text-3xl font-black mono-text ${ (stock.revenue_yoy || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {stock.revenue_yoy ? `${stock.revenue_yoy}%` : '--'}
                </span>
             </div>
             <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-widest">Alpha</span>
                <span className="text-xl sm:text-3xl font-black text-rose-600 italic mono-text">{stock.ai_score}</span>
             </div>
          </div>

          {/* AI Comment */}
          <div className="mb-8 sm:mb-12 p-6 sm:p-8 bg-slate-50 rounded-2xl sm:rounded-[2.5rem] border border-slate-100">
             <h4 className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase mb-3 tracking-[0.2em]">Intelligence Briefing</h4>
             <div className="serif-text text-lg sm:text-2xl italic font-medium text-slate-800 leading-relaxed">
                {stock.ai_comment ? `「${stock.ai_comment}」` : "「因子數據已完成全局校準。具備高度追蹤價值。」"}
             </div>
          </div>

          <button 
            onClick={() => onRunAi(stock)}
            className="w-full bg-slate-950 hover:bg-rose-500 text-white py-4 sm:py-6 rounded-xl sm:rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 sm:gap-4 active:scale-95 mb-10 sm:mb-0"
          >
            <Zap size={18} />
            <span className="text-xs sm:text-[14px] font-black tracking-[0.1em] sm:tracking-[0.2em] uppercase">請示最新決策指令</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
