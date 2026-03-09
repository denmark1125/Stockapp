import React, { useState, useEffect } from 'react';
import {
  X, History, Loader2,
  TrendingUp, TrendingDown, PlusCircle, MinusCircle,
  Newspaper, HelpCircle, Tag
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
  onRunAi?: () => void;
  onTogglePortfolio: (stock: DailyAnalysis, buyPrice?: number, quantity?: number) => Promise<void>;
  aiReport?: { text: string; links: { title: string; uri: string }[] } | null;
  isAiLoading?: boolean;
}

// 問題3：把數字翻譯成白話
const DataExplainer: React.FC<{ label: string; value: string | number | null | undefined; hint: string; status?: 'good' | 'bad' | 'neutral' }> = ({ label, value, hint, status = 'neutral' }) => (
  <div>
    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{label}</span>
    <div className={`text-xl font-bold mono-text italic ${status === 'good' ? 'text-emerald-600' : status === 'bad' ? 'text-rose-500' : 'text-[#1A1A1A]'}`}>
      {value ?? '--'}
    </div>
    <span className={`text-[9px] font-bold uppercase tracking-widest block mt-0.5 ${status === 'good' ? 'text-emerald-500' : status === 'bad' ? 'text-rose-400' : 'text-slate-300'}`}>
      {hint}
    </span>
  </div>
);

// 問題3：指標白話解說輔助
const getVolRatioHint = (v?: number) => {
  if (!v) return { hint: '無資料', status: 'neutral' as const };
  if (v > 2.0) return { hint: '爆量攻擊 ✓✓', status: 'good' as const };
  if (v > 1.5) return { hint: '成交熱絡 ✓', status: 'good' as const };
  if (v < 0.8) return { hint: '量縮冷清', status: 'neutral' as const };
  return { hint: '量能正常', status: 'neutral' as const };
};
const getKdHint = (k?: number) => {
  if (!k) return { hint: '無資料', status: 'neutral' as const };
  if (k < 20) return { hint: '超賣低檔 可留意', status: 'good' as const };
  if (k > 80) return { hint: '超買高檔 注意反轉', status: 'bad' as const };
  return { hint: 'KD 中性區間', status: 'neutral' as const };
};
const getRoeHint = (v?: number | null) => {
  if (!v) return { hint: '無資料', status: 'neutral' as const };
  if (v > 20) return { hint: '獲利能力優良 ✓✓', status: 'good' as const };
  if (v > 10) return { hint: '獲利表現不錯 ✓', status: 'good' as const };
  if (v < 5) return { hint: '獲利能力偏弱', status: 'bad' as const };
  return { hint: '獲利普通', status: 'neutral' as const };
};
const getRevHint = (v?: number | null) => {
  if (!v) return { hint: '無資料', status: 'neutral' as const };
  if (v > 30) return { hint: '營收高速成長 🔥', status: 'good' as const };
  if (v > 10) return { hint: '營收穩定成長 ✓', status: 'good' as const };
  if (v < -15) return { hint: '營收明顯衰退 ⚠️', status: 'bad' as const };
  if (v < 0) return { hint: '營收略微衰退', status: 'bad' as const };
  return { hint: '營收持平', status: 'neutral' as const };
};
const getPeHint = (v?: number | null) => {
  if (!v) return { hint: '無資料', status: 'neutral' as const };
  if (v < 15) return { hint: '本益比低 仍有空間', status: 'good' as const };
  if (v > 40) return { hint: '本益比偏高 需謹慎', status: 'bad' as const };
  return { hint: '本益比合理', status: 'neutral' as const };
};

// 問題4：新聞情緒區塊
const NewsSentimentBlock: React.FC<{ sentiment?: string; summary?: string; score?: number }> = ({ sentiment, summary, score }) => {
  if (!sentiment || sentiment === 'NEUTRAL') return null;

  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    POSITIVE:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: '📈 正面利多' },
    SLIGHT_POSITIVE: { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   label: '🟢 略偏利多' },
    SLIGHT_NEGATIVE: { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200',  label: '🟡 略偏利空' },
    NEGATIVE:        { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     label: '📉 負面利空' },
  };
  const s = map[sentiment] || map['SLIGHT_POSITIVE'];

  return (
    <div className={`${s.bg} border ${s.border} rounded-2xl p-4 flex items-start gap-3`}>
      <Newspaper size={16} className={`${s.text} shrink-0 mt-0.5`} />
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold ${s.text}`}>{s.label}</span>
          {score !== undefined && score !== 0 && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${score > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {score > 0 ? `+${score}` : score} 分
            </span>
          )}
        </div>
        <p className={`text-[11px] font-medium ${s.text}`}>{summary || '新聞情緒分析中'}</p>
      </div>
    </div>
  );
};

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  stock, onClose, onRunAi, onTogglePortfolio, aiReport, isAiLoading
}) => {
  const [history, setHistory] = useState<DailyAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [inputPrice, setInputPrice] = useState(stock.close_price.toString());
  const [inputQuantity, setInputQuantity] = useState('1');

  const isStopped = !!(stock.is_holding_item && stock.trade_stop && stock.close_price < stock.trade_stop);

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
        if (!showAddForm) { setShowAddForm(true); setIsProcessing(false); return; }
        await onTogglePortfolio(stock, parseFloat(inputPrice), parseFloat(inputQuantity));
        setShowAddForm(false);
      }
    } catch (e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

  const volInfo = getVolRatioHint(stock.vol_ratio);
  const kdInfo = getKdHint(stock.k_val);
  const roeInfo = getRoeHint(stock.roe);
  const revInfo = getRevHint(stock.revenue_yoy);
  const peInfo = getPeHint(stock.pe_ratio);

  return (
    <div className="fixed inset-0 z-[300] flex items-end lg:items-center justify-center p-0 lg:p-6 bg-[#0A0A0A]/60 backdrop-blur-md">
      <div className="w-full max-w-5xl bg-white rounded-t-[2.5rem] lg:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[92vh] lg:h-auto lg:max-h-[90vh] animate-in slide-in-from-bottom duration-500 relative">

        <button onClick={onClose} className="absolute top-6 right-8 z-50 bg-slate-100 p-2 rounded-full text-slate-800 hover:bg-slate-200 transition-all"><X size={20} /></button>

        {/* 左側：戰術控制 */}
        <div className="w-full lg:w-[340px] bg-[#1A1A1A] text-white p-8 lg:p-10 flex flex-col shrink-0">

          {/* 停損警報 */}
          {isStopped && (
            <div className="bg-red-600 rounded-2xl px-4 py-3 mb-6 flex items-center gap-2">
              <span className="text-sm font-bold animate-pulse">🔴 已跌破停損 — 請立即出場</span>
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <span className="bg-[#C83232] text-white text-[9px] font-bold px-2 py-0.5 rounded-md tracking-widest">審計終端</span>
            <span className="mono-text text-[11px] text-slate-500 font-bold">{stock.stock_code}</span>
          </div>

          <h2 className="serif-text text-4xl lg:text-5xl font-bold tracking-tight mb-1 leading-none">{stock.stock_name}</h2>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em] mb-6 italic">Alpha Strategy Audit</p>

          {/* 訊號標籤 */}
          {stock.trade_label && (
            <div className="mb-4 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 inline-flex">
              <span className="text-sm font-bold text-white">{stock.trade_label}</span>
            </div>
          )}

          <div className="space-y-3 flex-1">

            {/* 系統評估標籤 - 取代 AI 評語 */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-500 font-bold block mb-2 uppercase tracking-widest">系統評估</span>
              <div className="flex flex-wrap gap-1.5">
                {!!stock.trend_bull && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-bold">✓ 均線多頭</span>}
                {!!stock.macd_cross && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-bold">✓ MACD金叉</span>}
                {(stock.roe ?? 0) > 15 && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-bold">✓ ROE {stock.roe}%</span>}
                {(stock.revenue_yoy ?? 0) > 10 && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-bold">✓ 營收+{Math.round(stock.revenue_yoy ?? 0)}%</span>}
                {(stock.vol_ratio ?? 0) > 1.5 && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg font-bold">⚡ 量比{stock.vol_ratio?.toFixed(1)}x</span>}
                {(stock.trust_net ?? 0) > 0 && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg font-bold">🏦 投信買超</span>}
                {(stock.foreign_net ?? 0) > 500000 && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg font-bold">🌍 外資大買</span>}
                {(stock.revenue_yoy ?? 0) < -15 && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-lg font-bold">⚠️ 營收衰退</span>}
              </div>
            </div>

            {/* 新聞情緒 - 只顯示 news_summary（最新資料，不用 ai_comment） */}
            {stock.news_sentiment && stock.news_sentiment !== 'NEUTRAL' && stock.news_summary && (
              <div className={`p-4 rounded-2xl border ${stock.news_sentiment.includes('POSITIVE') ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <span className="text-[10px] text-slate-500 font-bold block mb-1 uppercase tracking-widest">新聞情緒</span>
                <p className={`text-[11px] font-medium leading-relaxed ${stock.news_sentiment.includes('POSITIVE') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stock.news_summary}
                </p>
              </div>
            )}

            {/* 掛單 / 目標 / 停損 */}
            <div className="grid grid-cols-1 gap-2">
              {(stock as any).trade_entry && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex justify-between items-center">
                  <span className="text-[10px] text-amber-400 font-bold">📌 建議掛單</span>
                  <div className="text-xl font-bold text-amber-400 mono-text italic">{(stock as any).trade_entry}</div>
                </div>
              )}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] text-emerald-500 font-bold">🎯 目標價</span>
                <div className="text-xl font-bold text-emerald-500 mono-text italic">{stock.trade_tp1 || '--'}</div>
              </div>
              <div className={`p-4 rounded-2xl flex justify-between items-center ${isStopped ? 'bg-red-500/20 border border-red-500/40' : 'bg-rose-500/5 border border-rose-500/20'}`}>
                <span className={`text-[10px] font-bold ${isStopped ? 'text-red-400' : 'text-rose-500'}`}>
                  🛡️ 停損價 {isStopped ? '⚠️ 已觸發' : ''}
                </span>
                <div className={`text-xl font-bold mono-text italic ${isStopped ? 'text-red-400' : 'text-rose-500'}`}>
                  {stock.trade_stop || '--'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
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
              onClick={handleAction} disabled={isProcessing}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-bold transition-all
                ${stock.is_holding_item
                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20'
                  : showAddForm ? 'bg-[#C83232] text-white' : 'bg-white text-black hover:bg-slate-200'}`}
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : stock.is_holding_item ? <MinusCircle size={16} /> : <PlusCircle size={16} />}
              {stock.is_holding_item ? '移除此項持股' : showAddForm ? '確認登錄帳冊' : '登錄今日持股'}
            </button>
          </div>
        </div>

        {/* 右側：資訊視覺 */}
        <div className="flex-1 p-6 lg:p-10 overflow-y-auto scrollbar-hide bg-white">

          {/* 歷史走勢圖 */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                <History size={16} className="text-[#C83232]" /> 歷史趨勢
              </h3>
              <div className="flex items-center gap-4 text-[11px] font-bold mono-text">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1A1A1A]"></span> 價格</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C83232]"></span> 評分</span>
              </div>
            </div>
            <div className="h-[200px] w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100 relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-slate-200" size={24} /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={history}>
                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="analysis_date" hide />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="ai_score" stroke="#C83232" fill="#C83232" fillOpacity={0.04} strokeWidth={2} />
                    <Line type="monotone" dataKey="close_price" stroke="#1A1A1A" strokeWidth={2} dot={{ r: 3, fill: '#1A1A1A', strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 問題3：數據矩陣 + 白話說明 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={14} className="text-[#C83232]" />
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">數據解析</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-5 bg-slate-50/50 rounded-3xl border border-slate-100">
              <DataExplainer label="量比 (成交量)" value={`${stock.vol_ratio?.toFixed(1)}x`} hint={volInfo.hint} status={volInfo.status} />
              <DataExplainer label="KD 指標 K值" value={stock.k_val?.toFixed(1)} hint={kdInfo.hint} status={kdInfo.status} />
              <DataExplainer label="股東權益 ROE" value={stock.roe !== null ? `${stock.roe}%` : null} hint={roeInfo.hint} status={roeInfo.status} />
              <DataExplainer label="營收年增率" value={stock.revenue_yoy !== null ? `${stock.revenue_yoy}%` : null} hint={revInfo.hint} status={revInfo.status} />
              <DataExplainer label="本益比 PE" value={stock.pe_ratio !== null ? `${stock.pe_ratio}x` : null} hint={peInfo.hint} status={peInfo.status} />
              <DataExplainer label="振幅" value={`${stock.volatility?.toFixed(1)}%`} hint={stock.volatility && stock.volatility > 5 ? '波動較大 注意風險' : '波動正常'} status={stock.volatility && stock.volatility > 8 ? 'bad' : 'neutral'} />
            </div>

            {/* 技術指標 boolean */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className={`flex items-center gap-3 p-3 rounded-2xl border ${stock.trend_bull ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <span className="text-lg">{stock.trend_bull ? '✅' : '❌'}</span>
                <div>
                  <p className="text-[10px] font-bold text-slate-600">均線排列</p>
                  <p className={`text-[9px] font-bold ${stock.trend_bull ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {stock.trend_bull ? '多頭排列，趨勢向上' : '非多頭，謹慎操作'}
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-2xl border ${stock.macd_cross ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <span className="text-lg">{stock.macd_cross ? '✅' : '⬜'}</span>
                <div>
                  <p className="text-[10px] font-bold text-slate-600">MACD 金叉</p>
                  <p className={`text-[9px] font-bold ${stock.macd_cross ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {stock.macd_cross ? '今日出現金叉訊號' : '尚未出現金叉'}
                  </p>
                </div>
              </div>
            </div>
          </div>



          {/* 籌碼面 */}
          {(stock.trust_net !== 0 || stock.foreign_net !== 0) && (
            <div className="mb-6">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">籌碼面</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '投信', value: stock.trust_net, emoji: '🏦' },
                  { label: '外資', value: stock.foreign_net, emoji: '🌍' },
                  { label: '自營', value: stock.dealer_net, emoji: '💼' },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-2xl border text-center ${(item.value || 0) > 0 ? 'bg-emerald-50 border-emerald-100' : (item.value || 0) < 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="text-lg mb-1">{item.emoji}</div>
                    <p className="text-[9px] font-bold text-slate-400 mb-1">{item.label}</p>
                    <p className={`text-xs font-bold mono-text ${(item.value || 0) > 0 ? 'text-emerald-600' : (item.value || 0) < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {(item.value || 0) > 0 ? '+' : ''}{item.value?.toLocaleString() || '0'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};
