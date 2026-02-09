
import React, { useState, useEffect } from 'react';
import { 
  X, Zap, ChevronRight, History, Loader2, Target, Sparkles, TrendingUp, ShieldAlert, PlusCircle, MinusCircle, DollarSign, PieChart, Globe, ExternalLink, Activity
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
  onTogglePortfolio: (stock: DailyAnalysis, buyPrice?: number, quantity?: number) => Promise<void>;
  aiReport?: {text: string, links: {title: string, uri: string}[]} | null;
  isAiLoading?: boolean;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ 
  stock, onClose, onRunAi, onTogglePortfolio, aiReport, isAiLoading 
}) => {
  const [history, setHistory] = useState<DailyAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [inputPrice, setInputPrice] = useState(stock.close_price.toString());
  const [inputQuantity, setInputQuantity] = useState('1');

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

  const handleAction = async () => {
    setIsProcessing(true);
    try {
      if (stock.is_holding_item) {
        await onTogglePortfolio(stock);
      } else {
        if (!showAddForm) {
          setShowAddForm(true);
          setIsProcessing(false);
          return;
        }
        await onTogglePortfolio(stock, parseFloat(inputPrice), parseFloat(inputQuantity));
        setShowAddForm(false);
      }
    } catch (e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end lg:items-center justify-center p-0 lg:p-6 bg-[#0A0A0A]/60 backdrop-blur-md">
      <div className="w-full max-w-5xl bg-white rounded-t-[2.5rem] lg:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[92vh] lg:h-auto lg:max-h-[90vh] animate-in slide-in-from-bottom duration-500 relative">
        
        <button onClick={onClose} className="absolute top-6 right-8 z-50 bg-slate-100 p-2 rounded-full text-slate-800 hover:bg-slate-200 transition-all"><X size={20}/></button>

        {/* 左側戰術控制區 */}
        <div className="w-full lg:w-[340px] bg-[#1A1A1A] text-white p-8 lg:p-10 flex flex-col shrink-0">
          <div className="flex items-center gap-3 mb-8">
            <span className="bg-[#C83232] text-white text-[9px] font-bold px-2 py-0.5 rounded-md tracking-widest">審計終端</span>
            <span className="mono-text text-[11px] text-slate-500 font-bold">{stock.stock_code}</span>
          </div>
          
          <h2 className="serif-text text-4xl lg:text-5xl font-bold tracking-tight mb-2 leading-none">{stock.stock_name}</h2>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em] mb-8 italic">Alpha Strategy Audit</p>

          <div className="space-y-5 flex-1">
             <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                <span className="text-[10px] text-slate-500 font-bold block mb-2">AI 戰術評語</span>
                <p className="text-[13px] text-slate-300 font-medium leading-relaxed italic">
                  "{stock.ai_comment || '指標正常，正處於價值回歸區間。'}"
                </p>
             </div>
             
             <div className="grid grid-cols-1 gap-3">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex justify-between items-center">
                   <span className="text-[10px] text-emerald-500 font-bold">獲利目標 <span className="text-[8px] opacity-60 ml-1">TARGET</span></span>
                   <div className="text-xl font-bold text-emerald-500 mono-text italic">{stock.trade_tp1 || '--'}</div>
                </div>
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex justify-between items-center">
                   <span className="text-[10px] text-rose-500 font-bold">防守底線 <span className="text-[8px] opacity-60 ml-1">STOP</span></span>
                   <div className="text-xl font-bold text-rose-500 mono-text italic">{stock.trade_stop || '--'}</div>
                </div>
             </div>
          </div>

          <div className="mt-8 space-y-4">
            {showAddForm && !stock.is_holding_item && (
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">成交價</label>
                    <input type="number" value={inputPrice} onChange={e => setInputPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm font-bold mono-text text-white outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">數量</label>
                    <input type="number" value={inputQuantity} onChange={e => setInputQuantity(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm font-bold mono-text text-white outline-none" />
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={handleAction}
              disabled={isProcessing}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-bold transition-all
                ${stock.is_holding_item 
                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20' 
                  : showAddForm ? 'bg-[#C83232] text-white shadow-xl shadow-rose-900/20' : 'bg-white text-black hover:bg-slate-200'}`}
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : stock.is_holding_item ? <MinusCircle size={16} /> : <PlusCircle size={16} />}
              {stock.is_holding_item ? '移除此項持股' : showAddForm ? '確認登錄帳冊' : '登錄今日持股'}
            </button>
          </div>
        </div>

        {/* 右側資訊視覺區 */}
        <div className="flex-1 p-6 lg:p-12 overflow-y-auto scrollbar-hide bg-white">
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                 <History size={16} className="text-[#C83232]" /> 歷史趨勢審查
               </h3>
               <div className="flex items-center gap-4 text-[11px] font-bold mono-text">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1A1A1A]"></span> 價格</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C83232]"></span> 評分</span>
               </div>
            </div>
            <div className="h-[240px] lg:h-[300px] w-full bg-slate-50/50 rounded-3xl p-6 border border-slate-100 relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-slate-200" size={24} /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={history}>
                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="analysis_date" hide />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="ai_score" stroke="#C83232" fill="#C83232" fillOpacity={0.03} strokeWidth={2.5} />
                    <Line type="monotone" dataKey="close_price" stroke="#1A1A1A" strokeWidth={2} dot={{ r: 4, fill: '#1A1A1A', strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 數據矩陣 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10 py-8 border-y border-slate-100">
             {[
               { label: '股東權益 ROE', value: `${stock.roe || '--'}%`, sub: 'Profitability' },
               { label: '本益比 PE', value: `${stock.pe_ratio || '--'}x`, sub: 'Valuation' },
               { label: '成交量比', value: `${stock.vol_ratio || '--'}x`, sub: 'Volume' },
               { label: '預期波動', value: `${stock.volatility || '--'}%`, sub: 'Volatility' }
             ].map((stat, i) => (
               <div key={i}>
                 <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{stat.label}</span>
                 <div className="text-xl font-bold text-[#1A1A1A] mono-text italic">{stat.value}</div>
                 <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{stat.sub}</span>
               </div>
             ))}
          </div>

          {/* AI 聯網情報 */}
          <div className="space-y-4">
             {isAiLoading ? (
               <div className="w-full py-20 bg-[#1A1A1A] rounded-[2.5rem] flex flex-col items-center justify-center border border-white/5">
                 <Activity className="animate-pulse text-[#C83232] mb-4" size={32} />
                 <span className="text-[10px] font-bold text-[#C83232] uppercase tracking-[0.4em] animate-pulse">正在穿透情報網並解碼即時消息...</span>
               </div>
             ) : aiReport ? (
               <div className="bg-[#1A1A1A] p-8 lg:p-10 rounded-[2.5rem] text-white shadow-2xl border border-[#C83232]/30 animate-in fade-in zoom-in duration-700">
                 <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-3">
                     <div className="bg-[#C83232] p-2 rounded-xl text-white"><Globe size={18} /></div>
                     <span className="text-[11px] font-bold text-[#C83232] tracking-widest">AI 全球即時情報審核</span>
                   </div>
                   <div className="bg-white/5 px-4 py-1.5 rounded-full text-[9px] font-bold text-slate-500">INTERNAL USE ONLY</div>
                 </div>
                 
                 <div className="text-[14px] lg:text-[15px] text-slate-300 leading-relaxed italic whitespace-pre-line border-l-2 border-[#C83232]/40 pl-8 mb-10 serif-text">
                   {aiReport.text}
                 </div>

                 {aiReport.links.length > 0 && (
                   <div className="pt-8 border-t border-white/5">
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-4">來源驗證紀錄：</span>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                       {aiReport.links.slice(0, 4).map((link, idx) => (
                         <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-3 rounded-2xl text-[10px] font-bold text-slate-400 transition-all group">
                            <span className="truncate max-w-[160px]">{link.title}</span>
                            <ExternalLink size={12} className="text-slate-600 group-hover:text-white" />
                         </a>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             ) : (
               <button 
                 onClick={onRunAi}
                 className="w-full bg-[#1A1A1A] hover:bg-black text-white py-8 rounded-[2.5rem] shadow-xl transition-all flex flex-col items-center justify-center gap-3 active:scale-[0.98] group relative overflow-hidden"
               >
                 <div className="flex items-center gap-4">
                   <div className="bg-[#C83232] p-3 rounded-2xl group-hover:rotate-12 transition-transform shadow-lg shadow-[#C83232]/20"><Zap size={24} fill="currentColor" /></div>
                   <div className="text-left">
                     <span className="text-[10px] font-bold tracking-widest text-[#C83232] mb-0.5 block">解碼今日獲利機密</span>
                     <span className="text-xl font-bold tracking-tight italic serif-text">啟動 AI 深度情報偵蒐</span>
                   </div>
                   <ChevronRight size={20} className="ml-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
                 </div>
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
