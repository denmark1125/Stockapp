import React from 'react';
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  onSelect: () => void;
  strategyMode: 'short' | 'long';
}

const resolveSignal = (signal: string, score: number, isHolding: boolean): string => {
  if (isHolding) return signal || 'HOLD';
  if (['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY', 'SELL_STOP'].includes(signal)) return signal;
  if (signal === 'WATCH') {
    if (score >= 90) return 'SWING_BUY';
    return 'WATCH';
  }
  if (score >= 85) return 'STRONG_BUY';
  if (score >= 75) return 'SWING_BUY';
  if (score >= 65) return 'WATCH';
  return signal || 'AVOID';
};

const getSignalStyle = (rawSignal: string, score: number, isHolding: boolean, isStopped: boolean) => {
  const signal = resolveSignal(rawSignal, score, isHolding);
  if (isStopped) return { signal, accentColor: '#C83232', accentWidth: '100%', labelText: 'STOP LOSS', labelColor: 'text-[#C83232]', action: '已跌破停損價，請立即出場保護資金', isActive: true };
  switch (signal) {
    case 'STRONG_BUY': return { signal, accentColor: '#C83232', accentWidth: '100%', labelText: 'STRONG BUY', labelColor: 'text-[#C83232]', action: '技術面＋基本面雙軌高分，優先考慮進場', isActive: true };
    case 'SWING_BUY':  return { signal, accentColor: '#C83232', accentWidth: '70%',  labelText: 'SWING BUY',  labelColor: 'text-[#C83232]', action: '趨勢向上＋基本面支撐，適合波段持有', isActive: true };
    case 'DAYTRADE_BUY': return { signal, accentColor: '#C87832', accentWidth: '60%', labelText: 'DAYTRADE', labelColor: 'text-[#C87832]', action: '爆量高波動，適合短線操作，嚴守停損', isActive: true };
    case 'WATCH': return { signal, accentColor: '#B8A882', accentWidth: '40%', labelText: 'WATCH', labelColor: 'text-[#9A8B6E]', action: '有潛力但尚未完全確認，等量能放大再考慮', isActive: false };
    case 'HOLD':  return { signal, accentColor: '#2A2A2A', accentWidth: '50%', labelText: 'HOLDING', labelColor: 'text-[#2A2A2A]', action: '趨勢未破，繼續持有，注意停損位置', isActive: false };
    default: return { signal, accentColor: '#D4C9B4', accentWidth: '15%', labelText: 'STANDBY', labelColor: 'text-[#B8A882]', action: '系統評估條件不足，此股不在推薦範圍', isActive: false };
  }
};

export const ActionCard: React.FC<ActionCardProps> = ({ stock, onSelect, strategyMode }) => {
  const score = strategyMode === 'short' ? (Number(stock.score_short) || 0) : (Number(stock.score_long) || 0);
  const isProfit = (stock.profit_loss_ratio || 0) >= 0;
  const isStopped = !!(stock.is_holding_item && stock.trade_stop && stock.close_price < stock.trade_stop);
  const style = getSignalStyle(stock.trade_signal, score, !!stock.is_holding_item, isStopped);
  const isBuySignal = ['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY'].includes(style.signal);
  const hasAlert = stock.trade_label && ['🚫 今日跌停','🔴 大跌警告','📤 爆量出貨','⚡ 超買反轉','❌ 掛單失效'].includes(stock.trade_label);

  const entryFeasibility = (() => {
    if (!isBuySignal || !stock.trade_entry || stock.is_holding_item) return null;
    const ratio = stock.close_price / stock.trade_entry;
    if (ratio <= 1.03) return 'ok';
    return 'chasing';
  })();

  // 🟢 白話結論：一眼看懂「該買 / 等回檔 / 觀望 / 避開」（給看不懂英文訊號的人）
  // 風格跟卡片一致：直角 · 左側細色條 · 平塗淡底 · 無外框（雜誌編輯結論感）
  // ⚠️ 重點：每個結論後面一定要接「它憑什麼這樣講」的真實數字（技術分/量能/離買點多遠），
  //         讓人看得出是算出來的、不是亂生成。沒有依據就不下結論。
  const verdict = (() => {
    if (stock.is_holding_item) return null; // 持股看 GBrain 建議，不重複
    const sig = (stock.trade_signal || '').toUpperCase();

    // 收集「這檔此刻的客觀事實」當作結論依據
    const reasons: string[] = [];
    if (score > 0) reasons.push(`技術${Math.round(score)}分`);
    if (typeof stock.vol_ratio === 'number' && stock.vol_ratio > 0) {
      reasons.push(stock.vol_ratio >= 1.5 ? `量增${stock.vol_ratio.toFixed(1)}倍` : `量能${stock.vol_ratio.toFixed(1)}倍`);
    }
    if (isBuySignal && stock.trade_entry) {
      const prem = (stock.close_price / stock.trade_entry - 1) * 100;
      reasons.push(prem > 3 ? `已比買點高${prem.toFixed(0)}%` : `現價貼近買點(${prem >= 0 ? '+' : ''}${prem.toFixed(1)}%)`);
    }

    if (sig === 'SELL_STOP') return { tag: '結論', txt: '已破停損 · 建議出場', accent: '#C83232', bg: '#FBF1EF', fg: '#C83232', reasons: [`現價${stock.close_price}`, stock.trade_stop ? `跌破停損${stock.trade_stop}` : ''].filter(Boolean) };
    if (sig === 'AVOID') return { tag: '結論', txt: '避開 · 現在別碰', accent: '#B5AE9E', bg: '#F2EFE7', fg: '#8B8270', reasons: reasons.length ? reasons : ['系統評估條件不足'] };
    if (isBuySignal) {
      if (entryFeasibility === 'chasing') return { tag: '結論', txt: '好股但漲多了 · 等回檔再買', accent: '#C87832', bg: '#FBF4E9', fg: '#A8702A', reasons };
      return { tag: '可買', txt: '可考慮買進', accent: '#C83232', bg: '#FBF1EF', fg: '#C83232', reasons };
    }
    return { tag: '結論', txt: '觀望 · 先別動', accent: '#B5AE9E', bg: '#F2EFE7', fg: '#8B8270', reasons: reasons.length ? reasons : ['量能未放大'] };
  })();

  return (
    <div
      onClick={onSelect}
      className="group relative bg-[#F8F4EE] border border-[#DDD5C4] cursor-pointer transition-all duration-200 hover:shadow-[0_4px_24px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 overflow-hidden flex flex-col"
      style={{ fontFamily: "'Georgia', 'Noto Serif TC', serif" }}
    >
      {/* 頂部訊號強度色條 */}
      <div className="h-[3px] w-full bg-[#EDE7DA]">
        <div className="h-full transition-all duration-500" style={{ width: style.accentWidth, backgroundColor: style.accentColor }} />
      </div>

      {/* 停損警報 */}
      {isStopped && (
        <div className="bg-[#C83232] text-white px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={12} className="animate-bounce" />
          <span style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }} className="text-[10px] font-bold uppercase">STOP LOSS — {stock.trade_stop}</span>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">

        {/* ── 代碼 + 名稱 + 現價 ── */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontFamily: 'monospace', letterSpacing: '0.12em' }} className="text-[9px] text-[#B8A882] font-bold uppercase">{stock.stock_code}</span>
              {score >= 85 && <Sparkles size={10} className="text-[#C83232]" />}
            </div>
            <h3 className="text-[26px] font-bold text-[#1A1A1A] leading-none tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
              {stock.stock_name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {stock.ai_theme && (
                <span className="inline-flex items-center gap-1 bg-[#1A1A1A] text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                  🤖 AI股 · {stock.ai_theme.split(',').slice(0, 2).join('·')}
                </span>
              )}
              {stock.opportunity_label === '🔥 高機會' && (
                <span className="inline-flex items-center bg-[#C83232] text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                  🔥 高機會
                </span>
              )}
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-[28px] font-bold leading-none" style={{ fontFamily: 'monospace', color: isBuySignal ? '#C83232' : '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
              {stock.close_price}
            </div>
            {stock.is_holding_item && (
              <div className={`text-[11px] font-bold mt-1 flex items-center justify-end gap-1 ${isProfit ? 'text-[#C83232]' : 'text-emerald-700'}`}>
                {isProfit ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                <span style={{ fontFamily: 'monospace' }}>{stock.profit_loss_ratio?.toFixed(1)}%</span>
                {typeof stock.profit_loss_amount === 'number' && Number.isFinite(stock.profit_loss_amount) && (
                  <span style={{ fontFamily: 'monospace' }}>
                    （{stock.profit_loss_amount >= 0 ? '+' : '−'}{Math.abs(Math.round(stock.profit_loss_amount)).toLocaleString()}元）
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#DDD5C4] mb-3" />

        {/* ── 持股資訊：買價／損益平衡／股數／損益金額 ── */}
        {stock.is_holding_item && (
          <>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            <div className="bg-[#F5F1E8] rounded-xl py-2 text-center">
              <p className="text-[8px] font-bold text-[#B8A882] uppercase tracking-wider mb-0.5">買入價</p>
              <p className="text-[13px] font-bold text-[#1A1A1A]" style={{ fontFamily: 'monospace' }}>{stock.buy_price ? Number(stock.buy_price).toFixed(2) : '—'}</p>
            </div>
            <div className="bg-[#F5F1E8] rounded-xl py-2 text-center">
              <p className="text-[8px] font-bold text-[#B8A882] uppercase tracking-wider mb-0.5">損益平衡</p>
              <p className="text-[13px] font-bold text-[#5A4E3C]" style={{ fontFamily: 'monospace' }}>{stock.breakeven_price ? Number(stock.breakeven_price).toFixed(2) : '—'}</p>
            </div>
            <div className="bg-[#F5F1E8] rounded-xl py-2 text-center">
              <p className="text-[8px] font-bold text-[#B8A882] uppercase tracking-wider mb-0.5">股數</p>
              <p className="text-[13px] font-bold text-[#1A1A1A]" style={{ fontFamily: 'monospace' }}>{stock.quantity ? Number(stock.quantity).toLocaleString() : '—'}</p>
            </div>
            <div className="bg-[#F5F1E8] rounded-xl py-2 text-center">
              <p className="text-[8px] font-bold text-[#B8A882] uppercase tracking-wider mb-0.5">損益額</p>
              <p className={`text-[13px] font-bold ${isProfit ? 'text-[#C83232]' : 'text-emerald-700'}`} style={{ fontFamily: 'monospace' }}>
                {typeof stock.profit_loss_amount === 'number' && Number.isFinite(stock.profit_loss_amount)
                  ? `${stock.profit_loss_amount >= 0 ? '+' : '−'}${Math.abs(Math.round(stock.profit_loss_amount)).toLocaleString()}`
                  : '—'}
              </p>
            </div>
          </div>
          {/* 🛡️ 防雷警告（持股若是處置/注意/全額交割股）*/}
          {stock.risk_flag && (
            <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[10px] font-bold text-red-600">
              {stock.risk_flag}｜跌停鎖死時停損也賣不掉，單檔別重壓
            </div>
          )}
          {/* 🐕 GBrain 持股建議（每日更新，讓你買完不是沒人理）*/}
          {stock.gbrain_action && (
            <div className="mb-3 px-3 py-2.5 bg-[#FBF6EC] border border-[#E8973A]/40 rounded-2xl">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[8px] font-black text-[#C87832] uppercase tracking-widest">🐕 GBrain 今日建議</span>
              </div>
              <p className="text-[12px] font-bold text-[#1A1A1A] leading-snug">{stock.gbrain_action}</p>
              {stock.gbrain_reason && <p className="text-[10px] text-[#8B7E68] mt-1 leading-relaxed">{stock.gbrain_reason}</p>}
            </div>
          )}
          </>
        )}

        {/* ── 🟢 白話結論 + 它的數字依據（看得出是算的，不是亂生成）── */}
        {verdict && (
          <div className="mb-3 flex items-stretch" style={{ backgroundColor: verdict.bg }}>
            <div className="w-[3px] shrink-0" style={{ backgroundColor: verdict.accent }} />
            <div className="px-3.5 py-2.5 min-w-0">
              <div className="flex items-baseline gap-2">
                <span style={{ fontFamily: 'monospace', letterSpacing: '0.18em', color: verdict.accent }} className="text-[8px] font-bold uppercase">{verdict.tag}</span>
                <span style={{ fontFamily: "'Georgia', 'Noto Serif TC', serif", color: verdict.fg }} className="text-[14px] font-bold leading-tight">{verdict.txt}</span>
              </div>
              {verdict.reasons.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                  <span style={{ fontFamily: 'monospace', color: verdict.accent }} className="text-[8px] opacity-70">依據</span>
                  {verdict.reasons.map((r, i) => (
                    <span key={i} style={{ fontFamily: 'monospace', color: verdict.fg }} className="text-[9px] opacity-80">
                      {i > 0 && <span className="opacity-40 mr-1.5">·</span>}{r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 訊號標籤 + 警告列（細節，給想懂的人）── */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[11px] font-bold tracking-[0.2em] uppercase ${style.labelColor}`} style={{ fontFamily: 'monospace' }}>
            {style.labelText}
          </span>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} className="text-[9px] text-[#B8A882] uppercase">
              {strategyMode === 'short' ? 'DAYTRADE' : 'SWING'}
            </span>
            {hasAlert && (
              <span style={{ fontFamily: 'monospace' }} className="text-[9px] font-bold text-[#C83232] border border-[#C83232]/40 px-2 py-0.5 uppercase tracking-widest animate-pulse">
                {stock.trade_label}
              </span>
            )}
            {!hasAlert && entryFeasibility === 'ok' && (
              <span style={{ fontFamily: 'monospace' }} className="text-[9px] font-bold text-emerald-700 border border-emerald-400 px-2 py-0.5 uppercase tracking-widest">
                ✓ 可進場
              </span>
            )}
            {entryFeasibility === 'chasing' && (
              <span style={{ fontFamily: 'monospace' }} className="text-[9px] font-bold text-[#C87832] border border-[#C87832]/40 px-2 py-0.5 uppercase tracking-widest">
                △ 追高
              </span>
            )}
          </div>
        </div>

        {/* ── 操作指令（斜體引文）── */}
        <p className={`text-[12px] italic leading-relaxed mb-4 ${style.labelColor}`} style={{ fontFamily: "'Georgia', serif" }}>
          「{style.action}」
        </p>

        <div className="border-t border-[#DDD5C4] mb-4" />

        {/* ── 三格價格（雜誌欄位）── */}
        <div className="grid grid-cols-3 gap-0">
          <div className="pr-4 border-r border-[#DDD5C4]">
            <div style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} className="text-[8px] text-[#B8A882] uppercase mb-1">TARGET</div>
            <div style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }} className="text-[15px] font-bold text-emerald-700">{stock.trade_tp1 ?? '—'}</div>
          </div>
          <div className="px-4 border-r border-[#DDD5C4]">
            <div style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} className="text-[8px] text-[#B8A882] uppercase mb-1">STOP</div>
            <div style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }} className={`text-[15px] font-bold ${isStopped ? 'text-[#C83232]' : 'text-[#5A4E3C]'}`}>{stock.trade_stop ?? '—'}</div>
          </div>
          <div className="pl-4">
            <div style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} className="text-[8px] text-[#B8A882] uppercase mb-1">ENTRY</div>
            <div style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }} className={`text-[15px] font-bold ${stock.trade_entry ? 'text-[#C87832]' : 'text-[#C8BA9A]'}`}>{stock.trade_entry ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* ── 版腳數據列 ── */}
      <div className="border-t border-[#DDD5C4] px-6 py-3 flex items-center justify-between bg-[#F2EBE0]">
        <div className="flex items-center gap-5">
          <div>
            <div style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }} className="text-[8px] text-[#B8A882] uppercase">VOL</div>
            <div style={{ fontFamily: 'monospace' }} className={`text-[12px] font-bold ${(stock.vol_ratio ?? 0) > 1.5 ? 'text-emerald-700' : 'text-[#5A4E3C]'}`}>{stock.vol_ratio?.toFixed(1)}×</div>
          </div>
          <div className="w-px h-6 bg-[#DDD5C4]" />
          <div>
            <div style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }} className="text-[8px] text-[#B8A882] uppercase">SCORE</div>
            <div style={{ fontFamily: 'monospace' }} className="text-[12px] font-bold text-[#C83232]">{score}</div>
          </div>
          {stock.news_sentiment && stock.news_sentiment !== 'NEUTRAL' && (
            <>
              <div className="w-px h-6 bg-[#DDD5C4]" />
              <div>
                <div style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }} className="text-[8px] text-[#B8A882] uppercase">NEWS</div>
                <div style={{ fontFamily: 'monospace' }} className={`text-[13px] font-bold ${stock.news_sentiment === 'NEGATIVE' ? 'text-emerald-700' : stock.news_sentiment?.includes('POSITIVE') ? 'text-[#C83232]' : 'text-[#C87832]'}`}>
                  {stock.news_sentiment === 'POSITIVE' ? '▲' : stock.news_sentiment === 'SLIGHT_POSITIVE' ? '△' : stock.news_sentiment === 'NEGATIVE' ? '▼' : '▽'}
                </div>
              </div>
            </>
          )}
        </div>
        <button className="text-[9px] font-bold tracking-[0.15em] uppercase text-[#B8A882] hover:text-[#C83232] transition-colors group-hover:text-[#C83232]" style={{ fontFamily: 'monospace' }}>
          Detail →
        </button>
      </div>
    </div>
  );
};
