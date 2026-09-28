import React from 'react';
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle } from 'lucide-react';
import { DailyAnalysis } from '../types';

interface ActionCardProps {
  stock: DailyAnalysis;
  onSelect: () => void;
  strategyMode: 'short' | 'long';
  signalStats?: Record<string, { wr: number; n: number; wr_recent?: number | null; wr_prev?: number | null }>; // 訊號歷史命中率
  pickInfo?: { rank: number; conds: string[] };  // 🏆 今日嚴選：名次＋亮的燈
  orderNo?: number;                               // 清單推薦順位（#1 #2 …讓排序看得懂）
  lit?: string[];                                 // 亮燈清單（五個篩選條件）
  fireEnabled?: boolean;
  picksEnabled?: boolean;
  marketOpen?: boolean;
}

const resolveSignal = (signal: string, _score: number, isHolding: boolean): string => {
  if (isHolding) return signal || 'HOLD';
  // UI 不得用分數自行升級買訊；實際訊號及交易計畫只能由同一次掃描產生。
  return signal || 'AVOID';
};

// 2026-07 改版：訊號標籤改中文膠囊(朋友回饋英文小字看不懂)。判斷邏輯(resolveSignal/分支)完全不動,只改顯示文字與加膠囊底色
const getSignalStyle = (rawSignal: string, score: number, isHolding: boolean, isStopped: boolean) => {
  const signal = resolveSignal(rawSignal, score, isHolding);
  if (isStopped) return { signal, accentColor: '#C83232', accentWidth: '100%', labelText: '🔴 跌破停損', labelColor: 'text-[#C83232]', pillBg: '#FBF1EF', action: '已跌破停損價，請立即出場保護資金', isActive: true };
  switch (signal) {
    case 'STRONG_BUY': return { signal, accentColor: '#C83232', accentWidth: '100%', labelText: '強力買進', labelColor: 'text-[#C83232]', pillBg: '#FBF1EF', action: '技術面＋基本面雙軌高分，優先考慮進場', isActive: true };
    case 'SWING_BUY':  return { signal, accentColor: '#C83232', accentWidth: '70%',  labelText: '波段買進',  labelColor: 'text-[#C83232]', pillBg: '#FBF1EF', action: '趨勢向上＋基本面支撐，適合波段持有', isActive: true };
    case 'DAYTRADE_BUY': return { signal, accentColor: '#C87832', accentWidth: '60%', labelText: '短線操作', labelColor: 'text-[#C87832]', pillBg: '#FBF4E9', action: '爆量高波動，適合短線操作，嚴守停損', isActive: true };
    case 'WATCH': return { signal, accentColor: '#B8A882', accentWidth: '40%', labelText: '觀望', labelColor: 'text-[#9A8B6E]', pillBg: '#F2EFE7', action: '有潛力但尚未完全確認，等量能放大再考慮', isActive: false };
    case 'HOLD':  return { signal, accentColor: '#2A2A2A', accentWidth: '50%', labelText: '持有中', labelColor: 'text-[#2A2A2A]', pillBg: '#EFEDE8', action: '趨勢未破，繼續持有，注意停損位置', isActive: false };
    default: return { signal, accentColor: '#D4C9B4', accentWidth: '15%', labelText: '暫不推薦', labelColor: 'text-[#B8A882]', pillBg: '#F2EFE7', action: '系統評估條件不足，此股不在推薦範圍', isActive: false };
  }
};

export const ActionCard: React.FC<ActionCardProps> = ({ stock, onSelect, strategyMode, signalStats, pickInfo, orderNo, lit, fireEnabled = false, picksEnabled = false, marketOpen = false }) => {
  const score = strategyMode === 'short' ? (Number(stock.score_short) || 0) : (Number(stock.score_long) || 0);
  const modeLabel = strategyMode === 'short' ? '當沖' : '波段'; // 結論依據要標清楚是哪一種策略的分數
  const isProfit = (stock.profit_loss_ratio || 0) >= 0;
  const isStopped = !!(stock.is_holding_item && stock.trade_stop && stock.close_price < stock.trade_stop);
  const rawStyle = getSignalStyle(stock.trade_signal, score, !!stock.is_holding_item, isStopped);
  const style = !picksEnabled && ['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY'].includes(rawStyle.signal) && !stock.is_holding_item
    ? { ...rawStyle, labelText: '買訊待驗證', labelColor: 'text-slate-600', pillBg: '#F1F5F9',
        accentColor: '#94A3B8', action: '整體推薦驗證未過關，先不要照訊號下單', isActive: false }
    : rawStyle;
  const isBuySignal = ['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY'].includes(style.signal);
  const hasTradePlan = Number(stock.trade_stop) > 0 && Number(stock.trade_stop) < Number(stock.trade_entry)
    && Number(stock.trade_entry) < Number(stock.trade_tp1);
  const hasAlert = stock.trade_label && ['🚫 今日跌停','🔴 大跌警告','📤 爆量出貨','⚡ 超買反轉','❌ 掛單失效'].includes(stock.trade_label);

  const entryFeasibility = (() => {
    if (!isBuySignal || !stock.trade_entry || stock.is_holding_item) return null;
    if (marketOpen && !stock.rt_live) return 'pending';
    const ratio = stock.close_price / stock.trade_entry;
    if (ratio < 0.97) return 'broken';
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

    // 收集「這檔此刻的客觀事實」當作結論依據（分數要標明是當沖還是波段，避免切換後看似矛盾）
    const reasons: string[] = [];
    if (score > 0) reasons.push(`${modeLabel}技術${Math.round(score)}分`);
    if (typeof stock.vol_ratio === 'number' && stock.vol_ratio > 0) {
      reasons.push(stock.vol_ratio >= 1.5 ? `量增${stock.vol_ratio.toFixed(1)}倍` : `量能${stock.vol_ratio.toFixed(1)}倍`);
    }
    if (isBuySignal && stock.trade_entry && entryFeasibility !== 'pending') {
      const prem = (stock.close_price / stock.trade_entry - 1) * 100;
      reasons.push(prem > 3 ? `已比買點高${prem.toFixed(0)}%` : `現價貼近買點(${prem >= 0 ? '+' : ''}${prem.toFixed(1)}%)`);
    }
    // 🏆 亮燈數是排序條件，近期資料不支持「燈越多勝率越高」的說法。
    if (isBuySignal && lit && lit.length > 0) {
      reasons.push(`亮燈${lit.length}/5`);
    }
    // 🧪 同類訊號的歷史命中率（回測算的真實統計，n≥30 才講）→ 證明結論是統計不是生成。
    //    只掛在「買進類」結論上：命中定義＝之後漲贏門檻，對觀望/避開講命中率不通，反而自打嘴巴。
    const histKey = (stock.trade_signal || '').toUpperCase();
    const hist = signalStats?.[histKey];
    if (isBuySignal && hist && hist.n >= 30) {
      // 命中＝照訊號做、先碰目標(TP1)而非先碰停損的比例。附近月趨勢箭頭
      let arrow = '';
      if (typeof hist.wr_recent === 'number' && typeof hist.wr_prev === 'number') {
        arrow = hist.wr_recent > hist.wr_prev ? '↗' : hist.wr_recent < hist.wr_prev ? '↘' : '→';
      }
      reasons.push(`照訊號做命中${(hist.wr / 10).toFixed(1)}成${arrow}(${hist.n}次)`);
    }

    if (sig === 'SELL_STOP') return { tag: '結論', txt: '已破停損 · 建議出場', accent: '#C83232', bg: '#FBF1EF', fg: '#C83232', reasons: [`現價${stock.close_price}`, stock.trade_stop ? `跌破停損${stock.trade_stop}` : ''].filter(Boolean) };
    if (sig === 'AVOID') return { tag: '結論', txt: '避開 · 現在別碰', accent: '#B5AE9E', bg: '#F2EFE7', fg: '#8B8270', reasons: reasons.length ? reasons : ['系統評估條件不足'] };
    if (isBuySignal) {
      if (!picksEnabled) return { tag: '結論', txt: '買訊驗證未過關，先不要跟單', accent: '#C87832', bg: '#FBF4E9', fg: '#A8702A', reasons };
      if (!hasTradePlan) return { tag: '結論', txt: '價位計畫不完整，先別買', accent: '#C87832', bg: '#FBF4E9', fg: '#A8702A', reasons };
      if (entryFeasibility === 'broken') return { tag: '結論', txt: '跌破原買點，先等重新評估', accent: '#C87832', bg: '#FBF4E9', fg: '#A8702A', reasons };
      if (entryFeasibility === 'pending') return { tag: '結論', txt: '盤中報價尚未更新，先不要下單', accent: '#C87832', bg: '#FBF4E9', fg: '#A8702A', reasons };
      if (entryFeasibility === 'chasing') return { tag: '結論', txt: '今天已經漲過頭，別追', accent: '#C87832', bg: '#FBF4E9', fg: '#A8702A', reasons };
      return { tag: '可買', txt: '可考慮買進', accent: '#C83232', bg: '#FBF1EF', fg: '#C83232', reasons };
    }
    return { tag: '結論', txt: '觀望 · 先別動', accent: '#B5AE9E', bg: '#F2EFE7', fg: '#8B8270', reasons: reasons.length ? reasons : ['量能未放大'] };
  })();

  return (
    <div
      onClick={onSelect}
      className="group relative bg-white rounded-2xl border border-[#EDE7DA] cursor-pointer transition-all duration-200 shadow-[0_1px_4px_rgba(45,45,45,0.04)] hover:shadow-[0_6px_24px_rgba(45,45,45,0.10)] hover:-translate-y-0.5 overflow-hidden flex flex-col"
    >
      {/* 頂部訊號強度色條 */}
      <div className="h-[4px] w-full bg-[#F2EDE3]">
        <div className="h-full transition-all duration-500" style={{ width: style.accentWidth, backgroundColor: style.accentColor }} />
      </div>

      {/* 🏆 今日嚴選橫幅：名次＋亮了哪幾盞驗證燈 */}
      {pickInfo && (
        <div className="flex items-stretch" style={{ backgroundColor: '#FBF5E4' }}>
          <div className="w-[4px] shrink-0" style={{ backgroundColor: '#C8A032' }} />
          <div className="px-4 py-2 flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-[13px] font-black" style={{ color: '#A8842A' }}>🏆 嚴選 #{pickInfo.rank}</span>
            <span className="text-[12px] font-medium" style={{ color: '#8B7E68' }}>亮燈 {pickInfo.conds.length}/5：{pickInfo.conds.join('·')}</span>
          </div>
        </div>
      )}

      {/* 停損警報 */}
      {isStopped && (
        <div className="bg-[#C83232] text-white px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} className="animate-bounce" />
          <span className="text-[13px] font-black">跌破停損 {stock.trade_stop} — 請認真考慮出場</span>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">

        {/* ── 代碼 + 名稱 + 現價 ── */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {typeof orderNo === 'number' && (
                <span className="num text-[12px] font-black text-[#C8A032]">#{orderNo}</span>
              )}
              <span className="mono-text text-[12px] text-[#A89878] font-bold tracking-wider">{stock.stock_code}</span>
              {score >= 85 && <Sparkles size={12} className="text-[#C83232]" />}
            </div>
            <h3 className="text-[24px] font-black text-[#1A1A1A] leading-none tracking-tight">
              {stock.stock_name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {stock.ai_theme && (
                <span className="inline-flex items-center gap-1 bg-[#1A1A1A] text-white text-[12px] font-bold px-2.5 py-1 rounded-full">
                  🤖 {stock.ai_theme.split(',').slice(0, 2).join('·')}
                </span>
              )}
              {stock.opportunity_label === '🔥 高機會' && (
                <span className={`inline-flex items-center text-[12px] font-bold px-2.5 py-1 rounded-full ${fireEnabled ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                  🔥 {fireEnabled ? '火焰驗證通過' : '火焰暫停驗證中'}
                </span>
              )}
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="num text-[30px] font-bold leading-none" style={{ color: isBuySignal ? '#C83232' : '#1A1A1A' }}>
              {stock.close_price}
            </div>
            {stock.rt_live && (
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="num text-[13px] font-bold text-emerald-600 tracking-wider">報價參考</span>
              </div>
            )}
            {stock.is_holding_item && (
              <div className={`text-[13px] font-bold mt-1 flex items-center justify-end gap-1 ${isProfit ? 'text-[#C83232]' : 'text-emerald-700'}`}>
                {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span className="num">{stock.profit_loss_ratio?.toFixed(1)}%</span>
                {typeof stock.profit_loss_amount === 'number' && Number.isFinite(stock.profit_loss_amount) && (
                  <span className="num">
                    （{stock.profit_loss_amount >= 0 ? '+' : '−'}{Math.abs(Math.round(stock.profit_loss_amount)).toLocaleString()}元）
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#F0EAE0] mb-3" />

        {/* ── 持股資訊：買價／損益平衡／股數／損益金額 ── */}
        {stock.is_holding_item && (
          <>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            <div className="bg-[#F8F5EE] rounded-xl py-2.5 text-center">
              <p className="text-[13px] font-bold text-[#A89878] mb-0.5">買入價</p>
              <p className="num text-[15px] font-bold text-[#1A1A1A]">{stock.buy_price ? Number(stock.buy_price).toFixed(2) : '—'}</p>
            </div>
            <div className="bg-[#F8F5EE] rounded-xl py-2.5 text-center">
              <p className="text-[13px] font-bold text-[#A89878] mb-0.5">損益平衡</p>
              <p className="num text-[15px] font-bold text-[#5A4E3C]">{stock.breakeven_price ? Number(stock.breakeven_price).toFixed(2) : '—'}</p>
            </div>
            <div className="bg-[#F8F5EE] rounded-xl py-2.5 text-center">
              <p className="text-[13px] font-bold text-[#A89878] mb-0.5">股數</p>
              <p className="num text-[15px] font-bold text-[#1A1A1A]">{stock.quantity ? Number(stock.quantity).toLocaleString() : '—'}</p>
            </div>
            <div className="bg-[#F8F5EE] rounded-xl py-2.5 text-center">
              <p className="text-[13px] font-bold text-[#A89878] mb-0.5">損益額</p>
              <p className={`num text-[15px] font-bold ${isProfit ? 'text-[#C83232]' : 'text-emerald-700'}`}>
                {typeof stock.profit_loss_amount === 'number' && Number.isFinite(stock.profit_loss_amount)
                  ? `${stock.profit_loss_amount >= 0 ? '+' : '−'}${Math.abs(Math.round(stock.profit_loss_amount)).toLocaleString()}`
                  : '—'}
              </p>
            </div>
          </div>
          {/* 🛡️ 防雷警告（持股若是處置/注意/全額交割股）*/}
          {stock.risk_flag && (
            <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[12px] font-bold text-red-600">
              {stock.risk_flag}｜跌停鎖死時停損也賣不掉，單檔別重壓
            </div>
          )}
          {/* 🐕 GBrain 持股建議（每日更新，讓你買完不是沒人理）*/}
          {stock.gbrain_action && (
            <div className="mb-3 px-3.5 py-3 bg-[#FBF6EC] border border-[#E8973A]/40 rounded-2xl">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[13px] font-black text-[#C87832] tracking-wide">🐕 GBrain 今日建議</span>
              </div>
              <p className="text-[14px] font-bold text-[#1A1A1A] leading-snug">{stock.gbrain_action}</p>
              {stock.gbrain_reason && <p className="text-[12px] text-[#8B7E68] mt-1 leading-relaxed">{stock.gbrain_reason}</p>}
            </div>
          )}
          </>
        )}

        {/* ── 🟢 白話結論 + 它的數字依據（看得出是算的，不是亂生成）── */}
        {verdict && (
          <div className="mb-3 rounded-xl overflow-hidden flex items-stretch" style={{ backgroundColor: verdict.bg }}>
            <div className="w-[4px] shrink-0" style={{ backgroundColor: verdict.accent }} />
            <div className="px-4 py-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-black px-2 py-0.5 rounded-full bg-white/70" style={{ color: verdict.accent }}>{verdict.tag}</span>
                <span className="text-[16px] font-black leading-tight" style={{ color: verdict.fg }}>{verdict.txt}</span>
              </div>
              {verdict.reasons.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {verdict.reasons.map((r, i) => (
                    <span key={i} className="text-[12px] font-bold px-2.5 py-1 rounded-full bg-white/80" style={{ color: verdict.fg }}>
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 訊號標籤 + 警告列（細節，給想懂的人）── */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[13px] font-black px-3 py-1 rounded-full ${style.labelColor}`} style={{ backgroundColor: style.pillBg }}>
            {style.labelText}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-[#A89878]">
              {strategyMode === 'short' ? '當沖' : '波段'}
            </span>
            {hasAlert && (
              <span className="text-[12px] font-bold text-[#C83232] bg-[#FBF1EF] rounded-full px-2.5 py-1 animate-pulse">
                {stock.trade_label}
              </span>
            )}
            {!hasAlert && picksEnabled && entryFeasibility === 'ok' && (
              <span className="text-[12px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
                ✓ 可進場
              </span>
            )}
            {entryFeasibility === 'chasing' && (
              <span className="text-[12px] font-bold text-[#C87832] bg-[#FBF4E9] rounded-full px-2.5 py-1">
                今天已經漲過頭，別追
              </span>
            )}
            {entryFeasibility === 'broken' && (
              <span className="text-[12px] font-bold text-[#C87832] bg-[#FBF4E9] rounded-full px-2.5 py-1">
                跌破買點，先等重新評估
              </span>
            )}
            {entryFeasibility === 'pending' && (
              <span className="text-[12px] font-bold text-[#C87832] bg-[#FBF4E9] rounded-full px-2.5 py-1">
                等盤中報價
              </span>
            )}
            {isBuySignal && !hasTradePlan && !stock.is_holding_item && (
              <span className="text-[12px] font-bold text-[#C87832] bg-[#FBF4E9] rounded-full px-2.5 py-1">
                價位不完整，先別買
              </span>
            )}
            {Number(stock.ai_score) >= 85 && (
              <span className="text-[12px] font-bold text-[#C87832] bg-[#FBF4E9] rounded-full px-2.5 py-1"
                title="回測：近月 85 分以上勝率反而低於 75-79 分帶，高分≠更穩">
                ⚠ 過熱分數帶
              </span>
            )}
          </div>
        </div>

        {/* ── 操作指令 ── */}
        <p className={`text-[13px] leading-relaxed mb-4 font-medium ${style.labelColor}`}>
          「{isBuySignal && !picksEnabled && !stock.is_holding_item ? '目前整體推薦驗證未過關，先不要照訊號下單' : isBuySignal && !hasTradePlan && !stock.is_holding_item ? '缺少完整進場、停損或目標價，今天先不要下單' : entryFeasibility === 'pending' ? '盤中報價尚未更新，先不要下單' : entryFeasibility === 'broken' ? '現價已低於原買點 3%，舊訊號失效，先等重新掃描' : entryFeasibility === 'chasing' ? '現價高於建議買點 3%，今天先不要追價' : style.action}」
        </p>

        {/* ── 三格價格 ── */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-emerald-50/70 rounded-xl py-2.5 text-center">
            <div className="text-[13px] font-bold text-emerald-700/70 mb-0.5">目標價</div>
            <div className="num text-[17px] font-bold text-emerald-700">{stock.trade_tp1 ?? '—'}</div>
          </div>
          <div className={`rounded-xl py-2.5 text-center ${isStopped ? 'bg-[#FBF1EF]' : 'bg-[#F8F5EE]'}`}>
            <div className={`text-[13px] font-bold mb-0.5 ${isStopped ? 'text-[#C83232]/70' : 'text-[#A89878]'}`}>停損價</div>
            <div className={`num text-[17px] font-bold ${isStopped ? 'text-[#C83232]' : 'text-[#5A4E3C]'}`}>{stock.trade_stop ?? '—'}</div>
          </div>
          <div className="bg-[#FBF4E9] rounded-xl py-2.5 text-center">
            <div className="text-[13px] font-bold text-[#C87832]/70 mb-0.5">建議進場</div>
            <div className={`num text-[17px] font-bold ${stock.trade_entry ? 'text-[#C87832]' : 'text-[#C8BA9A]'}`}>{stock.trade_entry ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* ── 版腳數據列 ── */}
      <div className="border-t border-[#F0EAE0] px-6 py-3 flex items-center justify-between bg-[#FBF9F4]">
        <div className="flex items-center gap-5">
          <div>
            <div className="text-[13px] font-bold text-[#A89878]">量能</div>
            <div className={`num text-[14px] font-bold ${(stock.vol_ratio ?? 0) > 1.5 ? 'text-emerald-700' : 'text-[#5A4E3C]'}`}>{stock.vol_ratio?.toFixed(1)}×</div>
          </div>
          <div className="w-px h-7 bg-[#EDE7DA]" />
          <div>
            <div className="text-[13px] font-bold text-[#A89878]">技術分</div>
            <div className="num text-[14px] font-bold text-[#C83232]">{score}</div>
          </div>
          {stock.news_sentiment && stock.news_sentiment !== 'NEUTRAL' && (
            <>
              <div className="w-px h-7 bg-[#EDE7DA]" />
              <div>
                <div className="text-[13px] font-bold text-[#A89878]">新聞</div>
                <div className={`text-[14px] font-bold ${stock.news_sentiment === 'NEGATIVE' ? 'text-emerald-700' : stock.news_sentiment?.includes('POSITIVE') ? 'text-[#C83232]' : 'text-[#C87832]'}`}>
                  {stock.news_sentiment === 'POSITIVE' ? '▲' : stock.news_sentiment === 'SLIGHT_POSITIVE' ? '△' : stock.news_sentiment === 'NEGATIVE' ? '▼' : '▽'}
                </div>
              </div>
            </>
          )}
        </div>
        <button className="text-[13px] font-bold text-[#A89878] hover:text-[#C83232] transition-colors group-hover:text-[#C83232]">
          詳情 →
        </button>
      </div>
    </div>
  );
};
