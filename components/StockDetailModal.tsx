
import React from 'react';
import { 
  X, Target, ShieldAlert, Zap, TrendingUp, 
  ChevronRight, Microscope, Info, BarChart3
} from 'lucide-react';
import { DailyAnalysis } from '../types';

interface StockDetailModalProps {
  stock: DailyAnalysis;
  onClose: () => void;
  onRunAi: (stock: DailyAnalysis) => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ stock, onClose, onRunAi }) => {
  const techSignal = stock.technical_signal || "N/A";
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-sm shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 text-white p-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm tracking-widest">
                {stock.trade_signal || "AVOID"}
              </span>
              <span className="mono-text text-sm text-slate-400 tracking-widest uppercase">
                {stock.stock_code}
              </span>
            </div>
            <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">
              {stock.stock_name}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={32} className="text-slate-500" />
          </button>
        </div>

        <div className="p-8 lg:p-10 max-h-[80vh] overflow-y-auto">
          
          {/* 1. 風控核心板塊 (ATR 策略) */}
          <div className="mb-10">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <ShieldAlert size={16} /> Risk Management Audit 風控審計
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 bg-rose-50 border border-rose-100 rounded-sm">
                <span className="text-[10px] font-black text-rose-400 uppercase block mb-1">Discipline Stop 紀律停損</span>
                <span className="text-3xl font-black text-rose-600">${stock.trade_stop || '--'}</span>
                <p className="text-[10px] text-rose-400/80 mt-2 italic font-medium">基於 2.0x ATR 波動計算</p>
              </div>
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-sm">
                <span className="text-[10px] font-black text-emerald-400 uppercase block mb-1">Primary Target 首要目標</span>
                <span className="text-3xl font-black text-emerald-600">${stock.trade_tp1 || '--'}</span>
                <p className="text-[10px] text-emerald-400/80 mt-2 italic font-medium">基於 2.5x ATR 波動預期</p>
              </div>
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-sm">
                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Max Potential 極致目標</span>
                <span className="text-3xl font-black text-amber-400">${stock.trade_tp2 || '--'}</span>
                <p className="text-[10px] text-slate-500 mt-2 italic font-medium">波段極限 4.0x ATR</p>
              </div>
            </div>
          </div>

          {/* 2. 數據矩陣 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 pb-10 border-b border-slate-100">
             <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">ROE</span>
                <span className="text-xl font-black">{stock.roe || 'N/A'}%</span>
             </div>
             <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">PE Ratio</span>
                <span className="text-xl font-black">{stock.pe_ratio || 'N/A'}</span>
             </div>
             <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">ATR Proxy</span>
                <span className="text-xl font-black text-slate-400">{stock.atr_proxy?.toFixed(2) || '0.00'}</span>
             </div>
             <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">AI Score</span>
                <span className="text-xl font-black text-emerald-500">{stock.ai_score}</span>
             </div>
          </div>

          {/* 3. AI 點評 (直接顯示後端 AI Comment) */}
          <div className="mb-12 p-8 bg-slate-50 border border-slate-200 rounded-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                {/* Fixed typo from Microsocope to Microscope */}
                <Microscope size={64} />
             </div>
             <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Strategist Insight 股神點評</h4>
             <div className="serif-text text-xl italic font-medium text-slate-800 leading-relaxed">
                {stock.ai_comment ? `「${stock.ai_comment}」` : "「數據分析中，請參考風控價位執行交易。」"}
             </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={() => onRunAi(stock)}
            className="w-full bg-slate-950 hover:bg-emerald-600 text-white py-6 rounded-sm shadow-xl transition-all duration-300 flex items-center justify-center gap-4 active:scale-[0.98]"
          >
            <Zap size={20} className="fill-current" />
            <span className="text-xs font-black uppercase tracking-[0.5em]">啟動實時 AI 審計 RE-AUDIT DATA</span>
            <ChevronRight size={18} />
          </button>

        </div>
      </div>
    </div>
  );
};
