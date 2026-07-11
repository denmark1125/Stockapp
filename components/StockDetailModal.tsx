import React, { useState, useEffect } from 'react';
import {
  X, History, Loader2,
  TrendingUp, TrendingDown, PlusCircle, MinusCircle,
  Newspaper, HelpCircle, Tag, Pencil, Bookmark, BookmarkCheck, PlusSquare,
  ChevronDown, Trash2
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
  onUpdatePortfolio?: (stock: DailyAnalysis, buyPrice: number, quantity: number) => Promise<void>;
  onAddLot?: (stock: DailyAnalysis, newPrice: number, newQty: number) => Promise<void>;
  onToggleWatchlist?: (stock: DailyAnalysis) => Promise<void>;
  isWatchlisted?: boolean;
  aiReport?: { text: string; links: { title: string; uri: string }[] } | null;
  isAiLoading?: boolean;
}

// 問題3：把數字翻譯成白話
const DataExplainer: React.FC<{ label: string; value: string | number | null | undefined; hint: string; status?: 'good' | 'bad' | 'neutral' }> = ({ label, value, hint, status = 'neutral' }) => (
  <div>
    <span className="text-[12px] font-bold text-slate-400 block mb-0.5">{label}</span>
    <div className={`text-xl font-bold mono-text italic ${status === 'good' ? 'text-emerald-600' : status === 'bad' ? 'text-rose-500' : 'text-[#1A1A1A]'}`}>
      {value ?? '--'}
    </div>
    <span className={`text-[12px] font-bold uppercase tracking-widest block mt-0.5 ${status === 'good' ? 'text-emerald-500' : status === 'bad' ? 'text-rose-400' : 'text-slate-300'}`}>
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
    POSITIVE:        { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     label: '📈 正面利多' },
    SLIGHT_POSITIVE: { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    label: '🔴 略偏利多' },
    SLIGHT_NEGATIVE: { bg: 'bg-lime-50',    text: 'text-lime-700',    border: 'border-lime-200',    label: '🟢 略偏利空' },
    NEGATIVE:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: '📉 負面利空' },
  };
  const s = map[sentiment] || map['SLIGHT_POSITIVE'];

  return (
    <div className={`${s.bg} border ${s.border} rounded-2xl p-4 flex items-start gap-3`}>
      <Newspaper size={16} className={`${s.text} shrink-0 mt-0.5`} />
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[12px] font-bold ${s.text}`}>{s.label}</span>
          {score !== undefined && score !== 0 && (
            <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${score > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {score > 0 ? `+${score}` : score} 分
            </span>
          )}
        </div>
        <p className={`text-[13px] font-medium ${s.text}`}>{summary || '新聞情緒分析中'}</p>
      </div>
    </div>
  );
};

type HoldingTab = 'lot' | 'edit' | 'remove' | null;

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  stock, onClose, onRunAi, onTogglePortfolio, onUpdatePortfolio, onAddLot, onToggleWatchlist, isWatchlisted, aiReport, isAiLoading
}) => {
  const [history, setHistory] = useState<DailyAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [holdingTab, setHoldingTab] = useState<HoldingTab>(null); // 持股三功能 tab
  const [inputPrice, setInputPrice] = useState(stock.close_price > 0 ? stock.close_price.toFixed(1) : '');
  const [inputQuantity, setInputQuantity] = useState('');
  const [editPrice, setEditPrice] = useState(stock.buy_price != null ? String(stock.buy_price) : '');
  const [editQty, setEditQty] = useState(stock.quantity != null ? String(stock.quantity) : '');
  const [lotPrice, setLotPrice] = useState(stock.close_price > 0 ? stock.close_price.toFixed(1) : '');
  const [lotQty, setLotQty] = useState('');

  const handleEdit = async () => {
    if (!onUpdatePortfolio) return;
    setIsProcessing(true);
    try {
      await onUpdatePortfolio(stock, parseFloat(editPrice), parseFloat(editQty));
    } catch (e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

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
      <div className="w-full max-w-5xl bg-white rounded-t-[2.5rem] lg:rounded-[3rem] shadow-2xl overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row h-[92vh] lg:h-auto lg:max-h-[90vh] animate-in slide-in-from-bottom duration-500 relative">

        <button onClick={onClose} className="fixed lg:absolute top-4 right-4 lg:top-6 lg:right-8 z-50 bg-slate-100 p-2 rounded-full text-slate-800 shadow-md hover:bg-slate-200 transition-all"><X size={20} /></button>

        {/* 左側：戰術控制（加 overflow-y-auto 讓表單在手機不被截斷） */}
        <div className="w-full lg:w-[340px] bg-[#1A1A1A] text-white p-8 lg:p-10 flex flex-col shrink-0 overflow-y-auto">

          {/* 停損警報 */}
          {isStopped && (
            <div className="bg-red-600 rounded-2xl px-4 py-3 mb-6 flex items-center gap-2">
              <span className="text-sm font-bold animate-pulse">🔴 已跌破停損 — 請立即出場</span>
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <span className="bg-[#E8973A] text-white text-[12px] font-bold px-2 py-0.5 rounded-md tracking-widest">審計終端</span>
            <span className="mono-text text-[13px] text-slate-500 font-bold">{stock.stock_code}</span>
          </div>

          <h2 className="serif-text text-4xl lg:text-5xl font-bold tracking-tight mb-1 leading-none">{stock.stock_name}</h2>
          <p className="text-slate-500 text-[12px] font-bold uppercase tracking-[0.3em] mb-6 italic">Alpha Strategy Audit</p>

          {/* 訊號標籤 */}
          {stock.trade_label && (
            <div className="mb-4 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 inline-flex">
              <span className="text-sm font-bold text-white">{stock.trade_label}</span>
            </div>
          )}

          <div className="space-y-3 flex-1">

            {/* 系統評估標籤 - 取代 AI 評語 */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[12px] text-slate-500 font-bold block mb-2 uppercase tracking-widest">系統評估</span>
              <div className="flex flex-wrap gap-1.5">
                {!!stock.trend_bull && <span className="text-[12px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-bold">✓ 均線多頭</span>}
                {!!stock.macd_cross && <span className="text-[12px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-bold">✓ MACD金叉</span>}
                {(stock.roe ?? 0) > 15 && <span className="text-[12px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-bold">✓ ROE {stock.roe}%</span>}
                {(stock.revenue_yoy ?? 0) > 10 && <span className="text-[12px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-bold">✓ 營收+{Math.round(stock.revenue_yoy ?? 0)}%</span>}
                {(stock.vol_ratio ?? 0) > 1.5 && <span className="text-[12px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg font-bold">⚡ 量比{stock.vol_ratio?.toFixed(1)}x</span>}
                {(stock.trust_net ?? 0) > 0 && <span className="text-[12px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg font-bold">🏦 投信買超</span>}
                {(stock.foreign_net ?? 0) > 500000 && <span className="text-[12px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg font-bold">🌍 外資大買</span>}
                {(stock.revenue_yoy ?? 0) < -15 && <span className="text-[12px] bg-red-500/10 text-red-400 px-2 py-1 rounded-lg font-bold">⚠️ 營收衰退</span>}
                {Number(stock.ai_score) >= 85 && <span className="text-[12px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg font-bold">⚠️ 過熱分數帶：近月 85+ 分勝率反低於 75-79 分帶，高分≠更穩</span>}
              </div>
            </div>

            {/* 新聞情緒 - 只顯示 news_summary（最新資料，不用 ai_comment） */}
            {stock.news_sentiment && stock.news_sentiment !== 'NEUTRAL' && stock.news_summary && (
              <div className={`p-4 rounded-2xl border ${stock.news_sentiment.includes('POSITIVE') ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-slate-500 font-bold uppercase tracking-widest">新聞情緒</span>
                  {stock.news_date && (
                    <span className="text-[12px] text-slate-500 mono-text bg-white/10 px-2 py-0.5 rounded-full">
                      {stock.news_date}
                    </span>
                  )}
                </div>
                <p className={`text-[13px] font-medium leading-relaxed ${stock.news_sentiment.includes('POSITIVE') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {stock.news_summary}
                </p>
              </div>
            )}

            {/* 掛單 / 目標 / 停損 */}
            <div className="grid grid-cols-1 gap-2">
              {(stock as any).trade_entry && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex justify-between items-center">
                  <span className="text-[12px] text-amber-400 font-bold">📌 建議掛單</span>
                  <div className="text-xl font-bold text-amber-400 mono-text italic">{(stock as any).trade_entry}</div>
                </div>
              )}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex justify-between items-center">
                <span className="text-[12px] text-emerald-500 font-bold">🎯 目標價</span>
                <div className="text-xl font-bold text-emerald-500 mono-text italic">{stock.trade_tp1 || '--'}</div>
              </div>
              <div className={`p-4 rounded-2xl flex justify-between items-center ${isStopped ? 'bg-red-500/20 border border-red-500/40' : 'bg-rose-500/5 border border-rose-500/20'}`}>
                <span className={`text-[12px] font-bold ${isStopped ? 'text-red-400' : 'text-rose-500'}`}>
                  🛡️ 停損價 {isStopped ? '⚠️ 已觸發' : ''}
                </span>
                <div className={`text-xl font-bold mono-text italic ${isStopped ? 'text-red-400' : 'text-rose-500'}`}>
                  {stock.trade_stop || '--'}
                </div>
              </div>
            </div>
          </div>

          {/* ── 底部操作區 ── */}
          <div className="mt-6">

            {/* ── 持股模式：持倉摘要卡 + 手風琴操作列 ── */}
            {stock.is_holding_item ? (
              <div className="space-y-2.5">

                {/* 持倉摘要卡 */}
                <div className="bg-gradient-to-br from-[#E8973A]/25 to-[#E8973A]/5 border border-[#E8973A]/40 rounded-2xl p-4">
                  <p className="text-[12px] font-black text-[#E8973A] uppercase tracking-[0.2em] mb-3">📒 我的持倉</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[12px] text-slate-500 font-bold mb-0.5">平均成本</p>
                      <p className="text-lg font-bold mono-text text-white leading-none">{stock.buy_price ?? '--'}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-slate-500 font-bold mb-0.5">持有股數</p>
                      <p className="text-lg font-bold mono-text text-white leading-none">{(stock.quantity ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-slate-500 font-bold mb-0.5">投入成本</p>
                      <p className="text-lg font-bold mono-text text-white leading-none">{Math.round((stock.buy_price ?? 0) * (stock.quantity ?? 0)).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* 操作列：手風琴（點列展開表單） */}
                {([
                  { key: 'lot' as HoldingTab, icon: <PlusSquare size={16} />, title: '加碼買進', desc: '又買了一批？自動幫你算新均價', color: 'text-emerald-400 bg-emerald-500/15' },
                  { key: 'edit' as HoldingTab, icon: <Pencil size={16} />, title: '修改記錄', desc: '買價或股數打錯了，在這裡改', color: 'text-sky-400 bg-sky-500/15' },
                  { key: 'remove' as HoldingTab, icon: <Trash2 size={16} />, title: '移除持股', desc: '已賣出或不想追蹤了', color: 'text-rose-400 bg-rose-500/15' },
                ]).map(row => (
                  <div key={row.key} className={`rounded-2xl border transition-all ${holdingTab === row.key ? 'border-[#E8973A]/50 bg-white/[0.06]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'}`}>
                    <button
                      onClick={() => setHoldingTab(holdingTab === row.key ? null : row.key)}
                      className="w-full flex items-center gap-3 p-3.5 text-left"
                    >
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${row.color}`}>{row.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12px] font-bold text-white">{row.title}</span>
                        <span className="block text-[12px] text-slate-500 truncate">{row.desc}</span>
                      </span>
                      <ChevronDown size={16} className={`text-slate-500 shrink-0 transition-transform ${holdingTab === row.key ? 'rotate-180' : ''}`} />
                    </button>

                    {/* 加碼表單 */}
                    {holdingTab === row.key && row.key === 'lot' && onAddLot && (() => {
                      const lp = parseFloat(lotPrice), lq = parseFloat(lotQty);
                      const oldQty = stock.quantity ?? 0, oldPrice = stock.buy_price ?? 0;
                      const newAvg = (!isNaN(lp) && !isNaN(lq) && lq > 0 && oldQty > 0)
                        ? ((oldPrice * oldQty + lp * lq) / (oldQty + lq)).toFixed(2) : null;
                      return (
                        <div className="px-3.5 pb-3.5 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[12px] text-slate-500 font-bold block mb-1.5">這批買入價（元）</label>
                              <input
                                type="text" inputMode="decimal" placeholder={stock.close_price > 0 ? String(stock.close_price) : '例：53'}
                                value={lotPrice} onChange={e => setLotPrice(e.target.value)}
                                className="w-full bg-black/40 border border-white/25 rounded-xl px-3 py-3 text-base font-bold text-white placeholder-slate-600 outline-none focus:border-[#E8973A] transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-[12px] text-slate-500 font-bold block mb-1.5">這批股數</label>
                              <input
                                type="text" inputMode="numeric" placeholder="例：2000"
                                value={lotQty} onChange={e => setLotQty(e.target.value)}
                                className="w-full bg-black/40 border border-white/25 rounded-xl px-3 py-3 text-base font-bold text-white placeholder-slate-600 outline-none focus:border-[#E8973A] transition-colors"
                              />
                            </div>
                          </div>
                          {newAvg && (
                            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2.5 text-[13px] text-emerald-400 font-bold">
                              ✨ 加碼後：均價 {newAvg} 元 × {(oldQty + lq).toLocaleString()} 股
                            </div>
                          )}
                          <button
                            onClick={async () => {
                              if (!lotPrice || !lotQty) return;
                              setIsProcessing(true);
                              try { await onAddLot(stock, parseFloat(lotPrice), parseFloat(lotQty)); setHoldingTab(null); }
                              catch (e) { console.error(e); }
                              finally { setIsProcessing(false); }
                            }}
                            disabled={isProcessing || !lotPrice || !lotQty}
                            className="w-full py-3.5 rounded-xl bg-emerald-500 text-white text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-40 transition-all"
                          >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <PlusSquare size={14} />} 確認加碼
                          </button>
                        </div>
                      );
                    })()}

                    {/* 修改表單 */}
                    {holdingTab === row.key && row.key === 'edit' && onUpdatePortfolio && (
                      <div className="px-3.5 pb-3.5 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[12px] text-slate-500 font-bold block mb-1.5">成交價（元）</label>
                            <input
                              type="text" inputMode="decimal"
                              value={editPrice} onChange={e => setEditPrice(e.target.value)}
                              className="w-full bg-black/40 border border-white/25 rounded-xl px-3 py-3 text-base font-bold text-white outline-none focus:border-[#E8973A] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-[12px] text-slate-500 font-bold block mb-1.5">股數</label>
                            <input
                              type="text" inputMode="numeric"
                              value={editQty} onChange={e => setEditQty(e.target.value)}
                              className="w-full bg-black/40 border border-white/25 rounded-xl px-3 py-3 text-base font-bold text-white outline-none focus:border-[#E8973A] transition-colors"
                            />
                          </div>
                        </div>
                        <button
                          onClick={handleEdit} disabled={isProcessing}
                          className="w-full py-3.5 rounded-xl bg-sky-500 text-white text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-sky-600 disabled:opacity-40 transition-all"
                        >
                          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} 儲存修改
                        </button>
                      </div>
                    )}

                    {/* 移除確認 */}
                    {holdingTab === row.key && row.key === 'remove' && (
                      <div className="px-3.5 pb-3.5 space-y-3">
                        <p className="text-[13px] text-rose-300 leading-relaxed">確定要從帳冊移除 <span className="font-bold text-white">{stock.stock_name}</span> 嗎？此操作無法復原。</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setHoldingTab(null)} className="py-3 rounded-xl bg-white/5 text-slate-400 text-[13px] font-bold hover:bg-white/10 transition-all">先不要</button>
                          <button
                            onClick={async () => { setIsProcessing(true); try { await onTogglePortfolio(stock); } catch(e){console.error(e);} finally { setIsProcessing(false); } }}
                            disabled={isProcessing}
                            className="py-3 rounded-xl bg-rose-500 text-white text-[13px] font-bold flex items-center justify-center gap-1 hover:bg-rose-600 disabled:opacity-40 transition-all"
                          >
                            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} 確認移除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* ── 非持股模式：登錄 + 願望清單 ── */
              <div className="space-y-2">
                {/* 買入表單 */}
                {showAddForm && (
                  <div className="bg-white/5 rounded-2xl p-4 space-y-3 mb-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[12px] text-slate-500 font-bold block mb-1.5">成交價（元）</label>
                        <input
                          type="text" inputMode="decimal" placeholder={stock.close_price > 0 ? String(stock.close_price) : '買入價格'}
                          value={inputPrice} onChange={e => setInputPrice(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-[#E8973A] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[12px] text-slate-500 font-bold block mb-1.5">股數</label>
                        <input
                          type="text" inputMode="numeric" placeholder="例：1000"
                          value={inputQuantity} onChange={e => setInputQuantity(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-[#E8973A] transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!showAddForm) { setShowAddForm(true); return; }
                    if (!inputPrice || !inputQuantity) return;
                    setIsProcessing(true);
                    try { await onTogglePortfolio(stock, parseFloat(inputPrice), parseFloat(inputQuantity)); setShowAddForm(false); }
                    catch (e) { console.error(e); }
                    finally { setIsProcessing(false); }
                  }}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-2xl bg-[#E8973A] text-white text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-[#cf8429] disabled:opacity-40 transition-all"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                  {showAddForm ? '確認登錄帳冊' : '＋ 登錄持股'}
                </button>
                {onToggleWatchlist && (
                  <button
                    onClick={async () => { setIsProcessing(true); try { await onToggleWatchlist(stock); } finally { setIsProcessing(false); } }}
                    disabled={isProcessing}
                    className={`w-full py-3 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all border ${
                      isWatchlisted ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-transparent border-white/15 text-slate-400 hover:border-amber-500/40 hover:text-amber-400'
                    }`}
                  >
                    {isWatchlisted ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    {isWatchlisted ? '從願望清單移除' : '加入願望清單'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右側：資訊視覺 */}
        <div className="w-full lg:flex-1 shrink-0 lg:shrink p-6 lg:p-10 lg:overflow-y-auto scrollbar-hide bg-white">

          {/* 歷史走勢圖 */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold text-slate-400 flex items-center gap-2">
                <History size={16} className="text-[#E8973A]" /> 歷史趨勢
              </h3>
              <div className="flex items-center gap-4 text-[13px] font-bold mono-text">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1A1A1A]"></span> 價格</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E8973A]"></span> 評分</span>
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
                    <Area type="monotone" dataKey="ai_score" stroke="#E8973A" fill="#E8973A" fillOpacity={0.04} strokeWidth={2} />
                    <Line type="monotone" dataKey="close_price" stroke="#1A1A1A" strokeWidth={2} dot={{ r: 3, fill: '#1A1A1A', strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 問題3：數據矩陣 + 白話說明 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={14} className="text-[#E8973A]" />
              <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">數據解析</h3>
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
                  <p className="text-[12px] font-bold text-slate-600">均線排列</p>
                  <p className={`text-[12px] font-bold ${stock.trend_bull ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {stock.trend_bull ? '多頭排列，趨勢向上' : '非多頭，謹慎操作'}
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-2xl border ${stock.macd_cross ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <span className="text-lg">{stock.macd_cross ? '✅' : '⬜'}</span>
                <div>
                  <p className="text-[12px] font-bold text-slate-600">MACD 金叉</p>
                  <p className={`text-[12px] font-bold ${stock.macd_cross ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {stock.macd_cross ? '今日出現金叉訊號' : '尚未出現金叉'}
                  </p>
                </div>
              </div>
            </div>
          </div>



          {/* 🧭 五面向體檢：既有數據的視覺化整理（非新演算法），一眼看出這檔強在哪弱在哪 */}
          {(() => {
            const clamp = (v: number, lo = 5, hi = 95) => Math.max(lo, Math.min(hi, v));
            const theme = stock.opportunity_score != null ? clamp(Number(stock.opportunity_score), 0, 100)
              : (stock.ai_theme ? 60 : 40);
            const tech = clamp(Math.max(Number(stock.score_short) || 0, Number(stock.score_long) || 0), 0, 100);
            const chips = clamp(50
              + ((stock.foreign_net ?? 0) > 0 ? 20 : (stock.foreign_net ?? 0) < 0 ? -15 : 0)
              + ((stock.trust_net ?? 0) > 0 ? 20 : (stock.trust_net ?? 0) < 0 ? -15 : 0));
            const news = clamp(50 + (Number(stock.news_score) || 0) * 2.5);
            const roe = stock.roe != null ? Number(stock.roe) : null;
            const funda = clamp(50
              + (stock.revenue_yoy != null ? Math.max(-15, Math.min(15, Number(stock.revenue_yoy) / 2)) : 0)
              + (roe == null ? 0 : roe >= 15 ? 15 : roe >= 5 ? 5 : roe <= 0 ? -10 : 0));
            const dims: [string, number, string][] = [
              ['題材面', theme, '🔥'], ['技術面', tech, '📈'], ['籌碼面', chips, '🏦'],
              ['新聞面', news, '📰'], ['基本面', funda, '🏗️'],
            ];
            const total = Math.round(dims.reduce((a, [, v]) => a + v, 0) / dims.length);
            const barCol = (v: number) => v >= 70 ? '#C83232' : v >= 40 ? '#E8973A' : '#7BA893';
            return (
              <div className="mb-6">
                <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-3">五面向體檢</h3>
                <div className="bg-[#FBF9F4] border border-[#F0EAE0] rounded-2xl p-4 flex gap-4 items-center">
                  <div className="flex-1 space-y-2.5 min-w-0">
                    {dims.map(([label, v, emoji]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-500 w-[4.5rem] shrink-0">{emoji} {label}</span>
                        <div className="flex-1 h-2.5 bg-[#EFE9DC] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(v)}%`, background: barCol(v) }} />
                        </div>
                        <span className="num text-[13px] font-black w-8 text-right shrink-0" style={{ color: barCol(v) }}>{Math.round(v)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="shrink-0 text-center w-20">
                    <p className="num text-[34px] font-black leading-none" style={{ color: barCol(total) }}>{total}</p>
                    <p className="text-[11px] font-bold text-[#A89878] mt-1">綜合分</p>
                  </div>
                </div>
                <p className="text-[11px] font-bold text-[#B8A882] mt-2">既有數據的視覺化整理（非新演算法）· 分數 0-100，越高越強</p>
              </div>
            );
          })()}

          {/* 籌碼面 */}
          {(stock.trust_net !== 0 || stock.foreign_net !== 0) && (
            <div className="mb-6">
              <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-3">籌碼面</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '投信', value: stock.trust_net, emoji: '🏦' },
                  { label: '外資', value: stock.foreign_net, emoji: '🌍' },
                  { label: '自營', value: stock.dealer_net, emoji: '💼' },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-2xl border text-center ${(item.value || 0) > 0 ? 'bg-red-50 border-red-100' : (item.value || 0) < 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="text-lg mb-1">{item.emoji}</div>
                    <p className="text-[12px] font-bold text-slate-400 mb-1">{item.label}</p>
                    <p className={`text-xs font-bold mono-text ${(item.value || 0) > 0 ? 'text-red-500' : (item.value || 0) < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
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
