
import React, { useState, useEffect } from 'react';
import { 
  X, Zap, ChevronRight, History, Loader2, Star, Target, Sparkles, TrendingUp, ShieldAlert, ArrowDownCircle, ArrowUpCircle
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
  onRunAi: () => void;
  aiReport?: string | null;
  isAiLoading?: boolean;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ 
  stock, onClose, onRunAi, aiReport, isAiLoading 
}) => {
  const [history, setHistory] = useState<DailyAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistoryData = async () => {
      setLoading(true);
      try {
        const data = await fetchStockHistory(stock.stock_code);
        setHistory(data);
      } finally { setLoading(false); }
    };
    loadHistoryData();
  }, [stock.stock_code]);

  return (
    <div className="fixed inset-0 z-[300] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-5xl bg-white rounded-t-[2rem] lg:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[90vh] lg:h-auto lg:max-h-[85vh] animate-in slide-in-from-bottom duration-300 relative">
        
        <button onClick={onClose} className="absolute top-5 right-6 z-50 bg-slate-100 p-2 rounded-full text-slate-800"><X size={18}/></button>

        {/* 左側資訊列 */}
        <div className="w-full lg:w-[320px] bg-slate-950 text-white p-8 lg:p-10 flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-8">
            <span className="bg-rose-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg tracking-widest">TERMINAL</span>
            <span className="mono-text text-[10px] text-slate-500 font-bold">{stock.stock_code}</span>
          </div>
          
          <h2 className="text-3xl lg:text-4xl font-black italic tracking-tighter uppercase leading-none mb-2">{stock.stock_name}</h2>
          <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.3em] mb-8">Premium Audit</p>

          <div className="space-y-4">
             <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                <span className="text-[9px] text-slate-500 uppercase font-black block mb-2">經理人戰術</span>
                <div className="text-xl font-black text-rose-500 italic mb-1">{stock.trade_signal === 'TRADE_BUY' ? '🎯 強力獵殺' : '⌛ 觀望觀測'}</div>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed line-clamp-2">{stock.ai_comment}</p>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-center">
                   <span className="text-[8px] text-emerald-500 uppercase font-black block tracking-widest mb-1">目標</span>
                   <div className="text-lg font-black text-emerald-500 mono-text">{stock.trade_tp1 || '--'}</div>
                </div>
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl text-center">
                   <span className="text-[8px] text-rose-500 uppercase font-black block tracking-widest mb-1">停損</span>
                   <div className="text-lg font-black text-rose-500 mono-text">{stock.trade_stop || '--'}</div>
                </div>
             </div>
          </div>
        </div>

        {/* 右側內容 */}
        <div className="flex-1 p-6 lg:p-10 overflow-y-auto bg-white scrollbar-hide">
          <div className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-6">
              <History size={14} className="text-rose-600" /> 趨勢因子分析
            </h3>
            <div className="h-[220px] lg:h-[300px] w-full bg-slate-50 rounded-3xl p-4 border border-slate-100 relative shadow-inner">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-rose-600" size={24} /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={history}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="analysis_date" hide />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="ai_score" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.05} strokeWidth={3} />
                    <Line type="monotone" dataKey="close_price" stroke="#0F172A" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 py-6 border-y border-slate-100">
             {[
               { label: 'ROE', value: `${stock.roe}%` },
               { label: 'PE', value: `${stock.pe_ratio}x` },
               { label: '當沖分', value: stock.score_short },
               { label: '波段分', value: stock.score_long }
             ].map((stat, i) => (
               <div key={i}>
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                 <div className="text-xl font-black text-slate-900 mono-text">{stat.value}</div>
               </div>
             ))}
          </div>

          <div>
             {isAiLoading ? (
               <div className="w-full py-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center animate-pulse">
                 <Loader2 className="animate-spin text-slate-300 mb-2" size={20} />
                 <span className="text-[8px] font-black text-slate-400 uppercase">AI 深度掃描中...</span>
               </div>
             ) : aiReport ? (
               <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl border border-rose-500/30">
                 <div className="flex items-center gap-2 mb-4">
                   <Sparkles size={16} className="text-rose-500" />
                   <span className="text-[10px] font-black text-rose-500 uppercase">AI 總表健檢報告</span>
                 </div>
                 <div className="text-sm lg:text-base text-slate-300 leading-relaxed italic whitespace-pre-line">
                   {aiReport}
                 </div>
               </div>
             ) : (
               <button 
                 onClick={onRunAi}
                 className="w-full bg-slate-950 hover:bg-slate-900 text-white py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] group border border-white/10"
               >
                 <Zap size={18} className="text-rose-500" />
                 <span className="text-xs font-black tracking-widest uppercase">執行 AI 總表全維度健檢</span>
                 <ChevronRight size={18} />
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
