import React, { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { DailyAnalysis } from '../types';
import { supabase, searchStockAcrossHistory } from '../services/supabase';

// 🐕 汪汪柴犬管家：右下角浮動聊天。丟代碼（1455）、問「今天買什麼」「我的持股怎麼辦」都行。
// 鐵律：只根據 App 已有的真實資料回答（大盤/嚴選/持股/個股列），沒資料就老實說——不編數字。

interface ShibaChatProps {
  stocks: DailyAnalysis[];    // 今日全部分析
  holdings: DailyAnalysis[];  // 帳冊持股（含損益/GBrain建議）
  topPicks: DailyAnalysis[];  // 今日嚴選
  litMap: Record<string, string[]>;
  market: { regime: string; changePct: number | null; msg: string };
}

type Msg = { role: 'user' | 'dog'; text: string };

const norm = (c?: string) => (c || '').replace(/\.(TW|TWO)$/i, '').trim().toUpperCase();

const QUICK = ['今天買什麼？', '我的持股怎麼辦？', '大盤現在能進場嗎？'];

export const ShibaChat: React.FC<ShibaChatProps> = ({ stocks, holdings, topPicks, litMap, market }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'dog', text: '汪！我是汪汪管家 🐕\n想查哪檔直接丟代碼給我（例如 1455），或問我「今天買什麼」「我的持股怎麼辦」！' }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open, busy]);

  const brief = (s: DailyAnalysis) => {
    const lit = litMap[norm(s.stock_code)] || [];
    return `${s.stock_name}(${norm(s.stock_code)}) 收盤${s.close_price} 訊號${s.trade_signal} 綜合${s.ai_score}分` +
      ` 亮燈${lit.length}/7${lit.length ? `(${lit.join('·')})` : ''}` +
      ` 進場${s.trade_entry ?? '—'} 停損${s.trade_stop ?? '—'} 目標${s.trade_tp1 ?? '—'}` +
      (s.ai_theme ? ` AI題材:${s.ai_theme}` : '') +
      (s.risk_flag ? ` ⚠️${s.risk_flag}` : '') +
      (s.news_summary ? ` 新聞:${String(s.news_summary).slice(0, 50)}` : '');
  };

  // 從提問裡找出相關個股資料（今日清單 → 持股 → 歷史庫），最多 4 檔
  const findRelated = async (text: string): Promise<string[]> => {
    const found: string[] = [];
    const codes = [...new Set(text.match(/\d{4,6}/g) || [])];
    for (const c of codes.slice(0, 3)) {
      const hit = stocks.find(s => norm(s.stock_code) === c) || holdings.find(s => norm(s.stock_code) === c);
      if (hit) { found.push(brief(hit)); continue; }
      try {
        const rows = await searchStockAcrossHistory(c);
        const r = rows.find(x => norm(x.stock_code) === c);
        found.push(r
          ? `${r.stock_name}(${c}) 今天沒被掃到，最近一次分析 ${r.analysis_date}：收盤${r.close_price} 訊號${r.trade_signal} ${r.ai_score}分`
          : `${c}：系統資料庫完全沒有這檔的分析紀錄`);
      } catch { found.push(`${c}：查詢失敗`); }
    }
    for (const s of stocks) {
      if (found.length >= 4) break;
      if (s.stock_name && s.stock_name.length >= 2 && text.includes(s.stock_name)
        && !found.some(f => f.includes(`(${norm(s.stock_code)})`))) found.push(brief(s));
    }
    return found;
  };

  const ask = async (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const history: Msg[] = [...msgs, { role: 'user', text: q }];
    setMsgs(history);
    setBusy(true);
    try {
      const related = await findRelated(q);
      const holdLines = holdings.map(h =>
        `${h.stock_name}(${norm(h.stock_code)}) 買${h.buy_price} 現${h.close_price} 損益${typeof h.profit_loss_ratio === 'number' ? h.profit_loss_ratio.toFixed(1) : '—'}%` +
        (h.gbrain_action ? ` GBrain建議:${h.gbrain_action}` : '') + ` 停損${h.trade_stop ?? '—'}`
      );
      const prompt = `你是「汪汪」，Alpha Ledger 股票 App 裡的柴犬管家。個性可愛但專業、白話直接，偶爾句尾加「汪」。使用者是投資新手。

鐵律（違反就是失職）：
1. 只能根據下面提供的真實資料回答，資料裡沒有的數字絕對不能編。沒資料就老實說「今天雷達沒掃到這檔」，教他等明天掃描或用 LINE 傳代碼查。
2. 不保證獲利、不說穩賺。給任何買進意見一定同時講「停損價，跌破就走不凹單」。
3. 200 字以內、分段、新手看得懂。台灣習慣：漲用紅、跌用綠的說法。
4. 問持股→用【我的持股】；問今天買什麼→用【今日嚴選】（沒有就說寧缺勿濫先別出手）；問大盤→用【大盤】。

【大盤】趨勢 ${market.regime === 'BULL' ? '多頭' : market.regime === 'BEAR' ? '空頭' : '盤整'}，今日 ${market.changePct != null ? `${market.changePct > 0 ? '+' : ''}${Number(market.changePct).toFixed(2)}%` : '—'}。${market.msg || ''}
【今日嚴選】${topPicks.length ? '\n' + topPicks.map(brief).join('\n') : '今天沒有達標的嚴選（可進場＋亮燈≥3），寧缺勿濫'}
【我的持股】${holdLines.length ? '\n' + holdLines.join('\n') : '目前無持股'}
${related.length ? `【提問相關個股】\n${related.join('\n')}` : ''}

【對話紀錄】
${history.slice(-6).map(m => `${m.role === 'user' ? '用戶' : '汪汪'}：${m.text}`).join('\n')}

請以汪汪的身分回覆用戶最後一句（純文字，不用 markdown 符號）。`;

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://zfkwzbupyvrrthuowchc.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ prompt, max_tokens: 700 })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || data.error || '汪…腦袋打結了，再問我一次！';
      setMsgs(m => [...m, { role: 'dog', text }]);
    } catch {
      setMsgs(m => [...m, { role: 'dog', text: '汪…連線失敗了，等等再問我一次！' }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      {/* 浮動按鈕（柴犬頭） */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="汪汪管家"
          className="fixed bottom-6 right-5 z-40 rounded-full shadow-xl ring-2 ring-[#E8973A]/60 hover:scale-105 transition-transform bg-white"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <img src="/logo.png" alt="汪汪管家" className="w-14 h-14 rounded-full" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E8973A] rounded-full text-[9px] text-white font-black flex items-center justify-center">汪</span>
        </button>
      )}

      {/* 聊天面板：手機全螢幕、桌機右下卡片 */}
      {open && (
        <div className="fixed inset-0 z-50 lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[400px] lg:h-[620px] flex flex-col bg-[#FDFBF7] lg:rounded-[2rem] lg:border lg:border-[#E8D9C0] lg:shadow-2xl overflow-hidden">
          {/* 標頭 */}
          <div className="flex items-center gap-3 px-5 py-4 bg-[#F8F4EE] border-b border-[#E8D9C0]" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <img src="/logo.png" alt="汪汪" className="w-10 h-10 rounded-full ring-1 ring-[#E8973A]/40" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-[#1A1A1A]">汪汪管家</p>
              <p className="text-[9px] font-bold text-[#B8A882]">數據彙整・非投資建議・下單你決定</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-[#1A1A1A]"><X size={20} /></button>
          </div>

          {/* 訊息區 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'dog' && <img src="/logo.png" alt="" className="w-7 h-7 rounded-full mr-2 mt-0.5 shrink-0" />}
                <div className={`max-w-[80%] px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#1A1A1A] text-white rounded-2xl rounded-br-md'
                    : 'bg-white text-[#1A1A1A] border border-[#E8D9C0] rounded-2xl rounded-bl-md'
                }`}>{m.text}</div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[11px] text-[#B8A882] font-bold pl-9">
                <span className="animate-bounce">🐾</span> 汪汪翻資料中…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* 快捷問題 */}
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {QUICK.map(qk => (
              <button key={qk} onClick={() => ask(qk)} disabled={busy}
                className="text-[11px] font-bold px-3 py-1.5 bg-[#F5EFE3] text-[#8B7E68] rounded-full border border-[#E8D9C0] hover:bg-[#E8973A] hover:text-white transition-colors disabled:opacity-50">
                {qk}
              </button>
            ))}
          </div>

          {/* 輸入列（16px 防 iOS 自動放大） */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-[#E8D9C0] bg-white" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) ask(); }}
              placeholder="丟代碼或問問題（如 1455）"
              className="flex-1 bg-[#F8F4EE] border border-[#E8D9C0] rounded-2xl px-4 py-2.5 outline-none focus:border-[#E8973A]"
              style={{ fontSize: '16px' }}
            />
            <button onClick={() => ask()} disabled={busy || !input.trim()}
              className="p-3 bg-[#E8973A] text-white rounded-2xl disabled:opacity-40 hover:bg-[#d8862c] transition-colors">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
