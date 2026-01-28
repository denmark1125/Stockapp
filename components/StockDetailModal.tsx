import React from 'react';
import { X, Sparkles, Loader2, TrendingUp, ChevronRight, Activity, Zap } from 'lucide-react';
import { DailyAnalysis } from '../types';

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
  if (!stock) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in slide-in-from-bottom duration-300">
        
        {/* 手機版頂部手把 */}
        <div className="sm:hidden w-12 h-1 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />

        {/* 標題與基本資訊 */}
        <div className="px-6 py-6 sm:px-10 sm:py-8 border-b border-slate-100 flex justify-between items-start bg-white shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="bg-slate-950 text-white px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest">
                {stock.stock_code}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest flex items-center gap-1
                ${stock.trade_signal === 'TRADE_BUY' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}
              `}>
                <TrendingUp size={10} /> {stock.trade_signal === 'TRADE_BUY' ? '強力買進' : '持續觀察'}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-slate-900 leading-none">
              {stock.stock_name}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors active-scale">
            <X size={24} className="text-slate-300" />
          </button>
        </div>

        {/* 捲動內容區 */}
        <div className="px-6 py-6 sm:px-10 sm:py-10 overflow-y-auto space-y-8 pb-10">
          
          {/* 數據網格 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
              <div className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">Alpha Score</div>
              <div className="text-2xl font-black text-rose-500 mono-text">{stock.ai_score}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
              <div className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">ROE %</div>
              <div className="text-2xl font-black text-slate-900 mono-text">{stock.roe}%</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
              <div className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">YoY %</div>
              <div className={`text-2xl font-black mono-text ${stock.revenue_yoy > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {stock.revenue_yoy}%
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
              <div className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">PE Ratio</div>
              <div className="text-2xl font-black text-slate-900 mono-text">{stock.pe_ratio || '--'}</div>
            </div>
          </div>

          {/* AI 戰略分析區 */}
          <div className="border-t border-slate-100 pt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black flex items-center gap-2 italic uppercase tracking-tighter">
                <Sparkles className="text-violet-600" size={20} />
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  Gemini 戰略分析
                </span>
              </h3>
              
              {!aiReport && !isAiLoading && (
                <button 
                  onClick={onRunAi}
                  className="px-5 py-2.5 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest rounded-xl active-scale shadow-lg shadow-slate-200 flex items-center gap-2"
                >
                  <Zap size={14} fill="currentColor" /> 啟動分析
                </button>
              )}
            </div>

            {isAiLoading && (
              <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Loader2 className="animate-spin text-violet-600 mb-4" size={32} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
                  正在同步全球金融數據...
                </span>
              </div>
            )}

            {aiReport && (
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 p-6 sm:p-8 rounded-[2rem] border border-indigo-100 text-slate-800 leading-relaxed text-sm sm:text-base font-medium whitespace-pre-line shadow-inner serif-text">
                {aiReport}
              </div>
            )}
            
            {!aiReport && !isAiLoading && (
              <div className="text-center py-10 px-8 bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
                <Activity size={32} className="mx-auto text-slate-200 mb-4" />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] leading-relaxed">
                  點擊上方按鈕，讓 Gemini AI 結合 Alpha 因子<br/>為您解讀當前技術面與籌碼。
                </p>
              </div>
            )}
          </div>

          <div className="pt-4">
             <button className="w-full py-5 bg-slate-50 hover:bg-slate-100 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2 transition-colors active-scale">
                查看更多歷史數據 <ChevronRight size={14} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};