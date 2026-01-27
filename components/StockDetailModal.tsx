
import React from 'react';
import { 
  X, TrendingUp, Zap, Activity, BarChart2, 
  Target, Microscope, FileText, ChevronRight 
} from 'lucide-react';
import { DailyAnalysis } from '../types';

interface StockDetailModalProps {
  stock: DailyAnalysis;
  onClose: () => void;
  onRunAi: (stock: DailyAnalysis) => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ stock, onClose, onRunAi }) => {
  // 解析技術指標字串 (例如 "K:75(多頭)")
  const techSignal = stock.technical_signal || "N/A";
  const isBullish = techSignal.includes("多頭");

  // 計算基本面強弱
  const isHighGrowth = stock.revenue_growth > 20;
  const isHighProfit = stock.roe !== null && stock.roe > 10;
  const isUndervalued = stock.pe_ratio !== null && stock.pe_ratio > 0 && stock.pe_ratio < 15;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-sm shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        
        {/* 1. 頂部導航列 */}
        <div className="bg-slate-950 text-white p-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm tracking-widest">
                {stock.sector || "核心優選"}
              </span>
              <span className="mono-text text-xs text-slate-400 tracking-widest uppercase">
                {stock.stock_code}
              </span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
              {stock.stock_name}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <div className="p-8 lg:p-10 max-h-[75vh] overflow-y-auto">
          
          {/* 2. 核心總分展示 */}
          <div className="flex items-center gap-8 mb-10 pb-10 border-b border-slate-100">
            <div className="flex flex-col items-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">AI Power Score</div>
              <div className={`text-7xl font-black italic ${stock.ai_score >= 80 ? 'text-emerald-500' : 'text-slate-950'}`}>
                {stock.ai_score}
              </div>
            </div>
            <div className="flex-1">
              <p className="serif-text text-lg text-slate-600 font-medium italic leading-relaxed">
                "這檔標的在我們的多因子量化模型中脫穎而出。在獲利效率與動能轉向之間，它展現了極佳的防禦性與進攻潛力。"
              </p>
            </div>
          </div>

          {/* 3. 三大面向解析 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            
            {/* A. 基本面 (Fundamental) */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-sm">
              <div className="flex items-center gap-2 mb-5 text-emerald-700">
                <BarChart2 size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">基本面分析</span>
              </div>
              <ul className="space-y-4">
                <li className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">ROE 獲利</span>
                  <span className={`font-black ${isHighProfit ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {stock.roe === null || stock.roe <= 0 ? '虧損' : `${stock.roe}%`}
                  </span>
                </li>
                <li className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">營收成長 (YoY)</span>
                  <span className={`font-black ${isHighGrowth ? 'text-amber-500' : 'text-slate-700'}`}>{stock.revenue_growth}%</span>
                </li>
                <li className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">本益比 (P/E)</span>
                  <span className={`font-black ${isUndervalued ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {stock.pe_ratio === null || stock.pe_ratio === 0 ? '-' : stock.pe_ratio}
                  </span>
                </li>
              </ul>
              <div className="mt-5 pt-4 border-t border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">審計結論 Verdict:</span>
                <div className="text-[11px] font-black text-slate-950 mt-1 uppercase">
                  {isHighGrowth ? "🔥 營收爆發動能" : (isHighProfit ? "💎 獲利效率資優" : "➖ 數據表現持平")}
                </div>
              </div>
            </div>

            {/* B. 技術面 (Technical) */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-sm">
              <div className="flex items-center gap-2 mb-5 text-blue-700">
                <Activity size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">技術面訊號</span>
              </div>
              <ul className="space-y-4">
                <li className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">KD 指標狀態</span>
                  <span className="font-black text-slate-700 truncate max-w-[80px] text-right">{techSignal}</span>
                </li>
                <li className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">最新收盤價</span>
                  <span className="font-black text-slate-950">${stock.close_price}</span>
                </li>
                <li className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">當日成交量</span>
                  <span className="font-black text-slate-700">{stock.volume}</span>
                </li>
              </ul>
              <div className="mt-5 pt-4 border-t border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">趨勢判斷 Trend:</span>
                <div className={`text-[11px] font-black mt-1 uppercase ${isBullish ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {isBullish ? "📈 多頭排列強勢" : "➖ 盤整或訊號模糊"}
                </div>
              </div>
            </div>

            {/* C. 題材/籌碼面 (Sentiment) */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-sm">
              <div className="flex items-center gap-2 mb-5 text-amber-600">
                <Zap size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">商業題材面</span>
              </div>
              <div className="space-y-4">
                 <div className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
                   {stock.revenue_growth > 25 ? (
                     "⚠️ 偵測到營收異常噴發！這通常預示著關鍵訂單或新產品效應，法人關注度正快速攀升。"
                   ) : stock.ai_score > 85 ? (
                     "🏆 綜合指標極佳的「護城河」標的，這類資產通常是長線大戶建立底倉的首選。"
                   ) : (
                     "📊 數據表現中規中矩，目前處於價值重估的潛伏期，需觀察量能是否連貫。"
                   )}
                 </div>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-200">
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI 指引 Suggestion:</span>
                 <div className="text-[11px] font-black text-slate-950 mt-1 uppercase">
                   建議啟動深度審計
                 </div>
              </div>
            </div>

          </div>

          {/* 4. 行動區：AI 審計按鈕 */}
          <button 
            onClick={() => onRunAi(stock)}
            className="w-full group relative bg-slate-950 hover:bg-emerald-600 text-white py-6 rounded-sm shadow-2xl transition-all duration-500 overflow-hidden active:scale-[0.98]"
          >
            <div className="relative z-10 flex items-center justify-center gap-4">
              <Microscope size={22} />
              <span className="text-xs font-black uppercase tracking-[0.5em]">啟動 AI 深度價值審計 INITIALIZE DEEP AUDIT</span>
              <ChevronRight size={18} className="group-hover:translate-x-2 transition-transform" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out"></div>
          </button>

        </div>
      </div>
    </div>
  );
};
