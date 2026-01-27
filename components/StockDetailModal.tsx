
import React from 'react';
import { 
  X, Target, ShieldAlert, Zap, 
  ChevronRight, Microscope, Info, BarChart3
} from 'lucide-react';
import { DailyAnalysis } from '../types';

interface StockDetailModalProps {
  stock: DailyAnalysis;
  onClose: () => void;
  onRunAi: (stock: DailyAnalysis) => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ stock, onClose, onRunAi }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-slate-100">
        
        {/* Header */}
        <div className="bg-slate-950 text-white p-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest">
                {stock.trade_signal?.replace('_', ' ') || "AVOID"}
              </span>
              <span className="mono-text text-sm text-slate-500 tracking-widest font-bold">
                {stock.stock_code}
              </span>
            </div>
            <h2 className="text-6xl font-black italic tracking-tighter uppercase leading-none">
              {stock.stock_name}
            </h2>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} className="text-slate-500" />
          </button>
        </div>

        <div className="p-10 lg:p-12 max-h-[75vh] overflow-y-auto">
          
          {/* Risk Management Section */}
          <div className="mb-12">
            <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
              <ShieldAlert size={16} className="text-slate-400" /> Risk Management Matrix 風控矩陣
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-rose-50/50 border border-rose-100/50 rounded-2xl transition-all hover:shadow-sm">
                <span className="text-[10px] font-black text-rose-400 uppercase block mb-2 tracking-widest">Hard Stop 紀律停損</span>
                <span className="text-4xl font-black text-rose-600 mono-text">${stock.trade_stop || '--'}</span>
                <p className="text-[10px] text-rose-400/60 mt-3 italic font-bold">2.0x ATR 波動過濾位</p>
              </div>
              <div className="p-8 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl transition-all hover:shadow-sm">
                <span className="text-[10px] font-black text-emerald-400 uppercase block mb-2 tracking-widest">Audit Target 目標獲利</span>
                <span className="text-4xl font-black text-emerald-600 mono-text">${stock.trade_tp1 || '--'}</span>
                <p className="text-[10px] text-emerald-400/60 mt-3 italic font-bold">2.5x ATR 趨勢動能位</p>
              </div>
            </div>
          </div>

          {/* Fundamentals Data */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 py-10 border-y border-slate-50">
             <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">ROE Matrix</span>
                <span className="text-2xl font-black text-slate-900">{stock.roe || '0'}%</span>
             </div>
             <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">PE Val</span>
                <span className="text-2xl font-black text-slate-900">{stock.pe_ratio || '--'}</span>
             </div>
             <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Rev Growth</span>
                <span className={`text-2xl font-black ${stock.revenue_yoy >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {stock.revenue_yoy}%
                </span>
             </div>
             <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">AI Audit</span>
                <span className="text-2xl font-black text-emerald-500 italic">{stock.ai_score || '--'}</span>
             </div>
          </div>

          {/* AI Auditor Insight */}
          <div className="mb-14 p-8 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
                <Microscope size={80} />
             </div>
             <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6">Strategic Auditor Insight 審計點評</h4>
             <div className="serif-text text-xl italic font-medium text-slate-800 leading-relaxed relative z-10">
                {stock.ai_comment ? `「${stock.ai_comment}」` : "「市場量化分析中，建議優先參考風控價位執行，紀律大於一切。」"}
             </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={() => onRunAi(stock)}
            className="w-full bg-slate-950 hover:bg-emerald-600 text-white py-6 rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-5 active:scale-[0.98]"
          >
            <Zap size={18} className="fill-current text-amber-400" />
            <span className="text-xs font-black uppercase tracking-[0.4em]">啟動實時 AI 審計 RE-AUDIT ANALYSIS</span>
            <ChevronRight size={18} />
          </button>

        </div>
      </div>
    </div>
  );
};
