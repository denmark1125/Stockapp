import React from 'react';
import { Target, TrendingUp, TrendingDown, Zap, Sparkles, AlertTriangle, Newspaper } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  onSelect: () => void;
  strategyMode: 'short' | 'long';
}

// 訊號決定邏輯：
// 優先讀 trade_signal（Python 腳本寫入的）
// 如果是 AVOID/空值 但分數很高，用分數推算（防止舊資料問題）
const resolveSignal = (signal: string, score: number, isHolding: boolean): string => {
  // 庫存股直接看 signal
  if (isHolding) return signal || 'HOLD';

  // 如果 signal 已經是明確買進訊號，直接用
  // WATCH 但分數極高時升級顯示（避免分數100卻顯示灰色的視覺矛盾）
  if (['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY', 'SELL_STOP'].includes(signal)) {
    return signal;
  }
  if (signal === 'WATCH') {
    if (score >= 90) return 'SWING_BUY';
    return 'WATCH';
  }

  // signal 是 AVOID 或空值但分數高 → 用分數推算
  // 這處理舊資料或資料不一致的情況
  if (score >= 85) return 'STRONG_BUY';
  if (score >= 75) return 'SWING_BUY';
  if (score >= 65) return 'WATCH';

  return signal || 'AVOID';
};

const getSignalStyle = (rawSignal: string, score: number, isHolding: boolean, isStopped: boolean) => {
  const signal = resolveSignal(rawSignal, score, isHolding);

  if (isStopped) return {
    signal,
    borderClass: 'ring-2 ring-red-500 border-red-200',
    barColor: '#ef4444',
    barWidth: '100%',
    labelBg: 'bg-red-600 text-white',
    labelText: '🔴 立即停損',
    action: '已跌破停損價，請立即出場保護資金',
    actionColor: 'text-red-600',
  };
  switch (signal) {
    case 'STRONG_BUY': return {
      signal,
      borderClass: 'ring-2 ring-[#C83232] ring-offset-2',
      barColor: '#C83232',
      barWidth: '100%',
      labelBg: 'bg-[#C83232] text-white',
      labelText: '🚀 強力買進',
      action: '技術面＋基本面雙軌高分，優先考慮進場',
      actionColor: 'text-[#C83232]',
    };
    case 'SWING_BUY': return {
      signal,
      borderClass: 'border-[#C83232]/40',
      barColor: '#C83232',
      barWidth: '75%',
      labelBg: 'bg-[#C83232] text-white',
      labelText: '🌊 波段買進',
      action: '趨勢向上＋基本面支撐，適合波段持有',
      actionColor: 'text-[#C83232]',
    };
    case 'DAYTRADE_BUY': return {
      signal,
      borderClass: 'border-orange-300',
      barColor: '#f97316',
      barWidth: '65%',
      labelBg: 'bg-orange-500 text-white',
      labelText: '⚡ 短線進擊',
      action: '爆量高波動，適合短線操作，嚴守停損',
      actionColor: 'text-orange-600',
    };
    case 'WATCH': return {
      signal,
      borderClass: 'border-slate-200',
      barColor: '#94a3b8',
      barWidth: '45%',
      labelBg: 'bg-amber-50 text-amber-700 border border-amber-200',
      labelText: '👀 觀察候選',
      action: '有潛力但尚未完全確認，可列入觀察，等量能放大再考慮',
      actionColor: 'text-amber-700',
    };
    case 'HOLD': return {
      signal,
      borderClass: 'border-[#1A1A1A]',
      barColor: '#1A1A1A',
      barWidth: '50%',
      labelBg: 'bg-[#1A1A1A] text-white',
      labelText: '💼 持有中',
      action: '趨勢未破，繼續持有，注意停損位置',
      actionColor: 'text-[#1A1A1A]',
    };
    default: return {
      signal,
      borderClass: 'border-slate-100',
      barColor: '#e2e8f0',
      barWidth: '20%',
      labelBg: 'bg-slate-50 text-slate-400',
      labelText: '❌ 暫不考慮',
      action: '系統評估條件不足，此股不在推薦範圍',
      actionColor: 'text-slate-400',
    };
  }
};

// 問題4：新聞情緒小標籤
const NewsSentimentBadge: React.FC<{ sentiment?: string }> = ({ sentiment }) => {
  if (!sentiment || sentiment === 'NEUTRAL') return null;
  const map: Record<string, { label: string; cls: string }> = {
    POSITIVE:        { label: '📈 利多', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    SLIGHT_POSITIVE: { label: '🟢 偏多', cls: 'bg-green-50 text-green-600 border-green-200' },
    SLIGHT_NEGATIVE: { label: '🟡 偏空', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    NEGATIVE:        { label: '📉 利空', cls: 'bg-red-50 text-red-600 border-red-200 animate-pulse' },
  };
  const s = map[sentiment];
  if (!s) return null;
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
  );
};

export const ActionCard: React.FC<ActionCardProps> = ({ stock, onSelect, strategyMode }) => {
  const score = strategyMode === 'short' ? (Number(stock.score_short) || 0) : (Number(stock.score_long) || 0);
  const isProfit = (stock.profit_loss_ratio || 0) >= 0;
  const isStopped = !!(stock.is_holding_item && stock.trade_stop && stock.close_price < stock.trade_stop);
  const style = getSignalStyle(stock.trade_signal, score, !!stock.is_holding_item, isStopped);
  const isBuySignal = ['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY'].includes(style.signal);

  // 今日進場可行性判斷（只對有掛單價的買進訊號有效）
  const entryFeasibility = (() => {
    if (!isBuySignal || !stock.trade_entry || stock.is_holding_item) return null;
    const ratio = stock.close_price / stock.trade_entry;
    if (ratio <= 1.03) return 'ok';      // 在掛單價 3% 內 → 可進場
    return 'chasing';                     // 已超過 3% → 追高警告
  })();

  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-[2.5rem] border japanese-border bg-white transition-all duration-300 cursor-pointer hover:shadow-2xl active:scale-[0.98] overflow-hidden flex flex-col h-full ${style.borderClass}`}
    >
      {/* 問題1：信心色條，寬度反映訊號強度 */}
      <div className="absolute top-0 left-0 h-1.5 rounded-t-full transition-all duration-500"
        style={{ width: style.barWidth, backgroundColor: style.barColor }} />

      {/* 問題2：停損警報橫幅 */}
      {isStopped && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={14} className="animate-bounce" />
          <span className="text-[10px] font-bold">已跌破停損價 {stock.trade_stop} — 請立即出場</span>
        </div>
      )}

      <div className="p-7 pb-4 flex-1">
        {/* 標頭 */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold mono-text text-slate-300 tracking-widest">{stock.stock_code}</span>
              {score >= 85 && <Sparkles size={12} className="text-[#C83232]" />}
            </div>
            <h3 className="serif-text text-3xl font-bold text-[#1A1A1A] leading-tight">{stock.stock_name}</h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold mono-text leading-none italic text-[#1A1A1A]">
              {stock.close_price}
            </div>
            {stock.is_holding_item && (
              <div className={`text-[11px] font-bold mt-1.5 flex items-center justify-end gap-1 ${isProfit ? 'text-emerald-600' : 'text-[#C83232]'}`}>
                {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stock.profit_loss_ratio?.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        {/* 問題1：訊號標籤 */}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${style.labelBg}`}>
            {style.labelText}
          </span>
          <span className="bg-slate-50 text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-100">
            {strategyMode === 'short' ? '當沖' : '波段'}
          </span>
          {/* 今日進場可行性 */}
          {entryFeasibility === 'ok' && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-3 py-1 rounded-full animate-pulse">
              ✅ 今日可進場
            </span>
          )}
          {entryFeasibility === 'chasing' && (
            <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold px-3 py-1 rounded-full">
              ⚠️ 已追高勿買
            </span>
          )}
          {/* 問題4：新聞情緒標籤 */}
          <NewsSentimentBadge sentiment={stock.news_sentiment} />
        </div>

        {/* 問題1：白話操作指令 */}
        <div className="mb-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-widest">系統指令</span>
          <p className={`text-sm font-bold leading-relaxed italic ${style.actionColor}`}>
            「{style.action}」
          </p>
        </div>

        {/* 停損 / 目標價 / 建議掛單 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 block mb-1">🎯 目標價</span>
            <div className="text-[13px] font-bold mono-text text-emerald-600 italic">
              {stock.trade_tp1 || '--'}
            </div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 block mb-1">🛡️ 停損價</span>
            <div className={`text-[13px] font-bold mono-text italic ${isStopped ? 'text-red-600' : 'text-slate-600'}`}>
              {stock.trade_stop || '--'}
            </div>
          </div>
          <div className={`p-3 rounded-2xl border shadow-sm ${stock.trade_entry ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
            <span className="text-[9px] font-bold text-slate-400 block mb-1">📌 掛單價</span>
            <div className={`text-[13px] font-bold mono-text italic ${stock.trade_entry ? 'text-amber-700' : 'text-slate-300'}`}>
              {stock.trade_entry || '--'}
            </div>
          </div>
        </div>
      </div>

      {/* 底部數據列 */}
      <div className="border-t border-slate-50 p-5 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-400 uppercase">量比</span>
            <span className={`text-xs font-bold mono-text ${(stock.vol_ratio || 0) > 1.5 ? 'text-emerald-600' : 'text-[#1A1A1A]'}`}>
              {stock.vol_ratio?.toFixed(1)}x
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-400 uppercase">綜合分</span>
            <span className="text-xs font-bold text-[#C83232] mono-text">{score}</span>
          </div>
          {stock.news_sentiment && stock.news_sentiment !== 'NEUTRAL' && (
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase">新聞</span>
              <Newspaper size={12} className={stock.news_sentiment === 'NEGATIVE' ? 'text-red-500' : stock.news_sentiment?.includes('POSITIVE') ? 'text-emerald-500' : 'text-yellow-500'} />
            </div>
          )}
        </div>
        <button className="bg-[#1A1A1A] text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 hover:bg-[#C83232] transition-colors">
          詳情 <TrendingUp size={12} />
        </button>
      </div>
    </div>
  );
};
