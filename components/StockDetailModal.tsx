
import React, { useState, useEffect } from 'react';
import { 
  X, Zap, ChevronRight, History, Loader2, Star, Target, Sparkles, TrendingUp, ShieldAlert, PlusCircle, MinusCircle, Briefcase, DollarSign, PieChart, Globe, ExternalLink
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
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-5xl bg-white rounded-t-[2rem] lg:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[95vh] lg:h-auto lg:max-h-[90vh] animate-in slide-in-from-bottom duration-300 relative">
        
        <button onClick={onClose} className="absolute top-5 right-6 z-50 bg-slate-100 p-2 rounded-full text-slate-800 hover:bg-slate-200 transition-colors"><X size={18}/></button>

        {/* 左側資訊列 */}
        <div className="w-full lg:w-[320px] bg-slate-950 text-white p-8 lg:p-10 flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-8">
            <span className="bg-rose-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg tracking-widest">TERMINAL</span>
            <span className="mono-text text-[10px] text-slate-500 font-bold">{stock.stock_code}</span>
          </div>
          
          <h2 className="text-3xl lg:text-4xl font-black italic tracking-tighter uppercase leading-none mb-2">{stock.stock_name}</h2>
          <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.3em] mb-8">Premium Audit</p>

          <div className="space-y-4 mb-auto">
             <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                <span className="text-[9px] text-slate-500 uppercase font-black block mb-2">經理人預測訊號</span>
                <div className="text-xl font-black text-rose-500 italic mb-1">{stock.trade_signal === 'TRADE_BUY' || stock.trade_signal === 'BULL' ? '🎯 強力獵殺' : '⌛ 觀望觀測'}</div>
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

          <div className="mt-8 space-y-4">
            {showAddForm && !stock.is_holding_item && (
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3 animate-in fade-in zoom-in duration-200">
                <div>
                  <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">成交價格</label>
                  <div className="relative">
                    <DollarSign size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="number" 
                      value={inputPrice} 
                      onChange={e => setInputPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-sm font-black mono-text text-white outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">成交數量</label>
                  <div className="relative">
                    <PieChart size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="number" 
                      value={inputQuantity} 
                      onChange={e => setInputQuantity(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-sm font-black mono-text text-white outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={handleAction}
              disabled={isProcessing}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all border
                ${stock.is_holding_item 
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20' 
                  : showAddForm ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : stock.is_holding_item ? <MinusCircle size={14} /> : <PlusCircle size={14} />}
              {stock.is_holding_item ? '賣出此項資產' : showAddForm ? '確認儲存' : '登錄今日交易'}
            </button>
          </div>
        </div>

        {/* 右側內容 */}
        <div className="flex-1 p-6 lg:p-10 overflow-y-auto bg-white scrollbar-hide">
          <div className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-6">
              <History size={14} className="text-rose-600" /> 歷史走勢與趨勢因子
            </h3>
            <div className="h-[220px] lg:h-[280px] w-full bg-slate-50 rounded-3xl p-4 border border-slate-100 relative shadow-inner">
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
               { label: 'ROE', value: `${stock.roe || '--'}%` },
               { label: 'PE', value: `${stock.pe_ratio || '--'}x` },
               { label: '量比', value: `${stock.vol_ratio || '--'}x` },
               { label: '波動', value: `${stock.volatility || '--'}%` }
             ].map((stat, i) => (
               <div key={i}>
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                 <div className="text-xl font-black text-slate-900 mono-text">{stat.value}</div>
               </div>
             ))}
          </div>

          {/* AI 聯網情報區域 */}
          <div className="space-y-4">
             {isAiLoading ? (
               <div className="w-full py-16 bg-slate-950 rounded-3xl flex flex-col items-center justify-center border border-white/5 relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/5 to-transparent animate-shimmer"></div>
                 <Loader2 className="animate-spin text-rose-500 mb-4" size={32} />
                 <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] animate-pulse">正在掃描全球情報網與小道消息...</span>
               </div>
             ) : aiReport ? (
               <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl border border-rose-500/30 animate-in fade-in zoom-in duration-500">
                 <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-2">
                     <div className="bg-rose-500 p-1.5 rounded-lg text-white"><Globe size={16} /></div>
                     <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">AI 深度聯網情報解密</span>
                   </div>
                   <div className="bg-white/10 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-slate-400">機密文件 - 僅供參考</div>
                 </div>
                 
                 <div className="text-sm lg:text-base text-slate-200 leading-relaxed italic whitespace-pre-line border-l-2 border-rose-500/50 pl-6 mb-8">
                   {aiReport.text}
                 </div>

                 {aiReport.links.length > 0 && (
                   <div className="pt-6 border-t border-white/5">
                     <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-3">參考來源與即時新聞：</span>
                     <div className="flex flex-wrap gap-2">
                       {aiReport.links.slice(0, 4).map((link, idx) => (
                         <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[9px] font-bold text-slate-300 transition-colors">
                            <span className="truncate max-w-[120px]">{link.title}</span>
                            <ExternalLink size={10} className="text-slate-500" />
                         </a>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             ) : (
               <button 
                 onClick={onRunAi}
                 className="w-full bg-slate-950 hover:bg-slate-900 text-white py-6 rounded-3xl shadow-xl transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98] group border border-white/10 relative overflow-hidden"
               >
                 <div className="flex items-center gap-3">
                   <div className="bg-rose-600 p-2 rounded-xl group-hover:scale-110 transition-transform"><Zap size={20} fill="currentColor" /></div>
                   <div className="text-left">
                     <span className="text-[10px] font-black tracking-widest uppercase block text-rose-500 mb-0.5">解鎖今日戰術</span>
                     <span className="text-lg font-black tracking-tighter uppercase italic">啟動 AI 聯網情報解密</span>
                   </div>
                   <ChevronRight size={20} className="ml-4 opacity-30 group-hover:translate-x-1 transition-transform" />
                 </div>
                 <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] mt-2">包含當沖/波段建議與即時小道消息搜尋</p>
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
