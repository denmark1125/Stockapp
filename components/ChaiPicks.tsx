import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

// 🐕 柴柴今日可進 v3（2026-11-22）：後端 Stock-Auto-Scanner/chai_picks.py 每天收盤後寫入 CHAI_PICKS 特殊列。
// 用戶要求極簡：幾檔可以進、買在多少以下、跌破多少要賣。分析細節不在這裡展開。
type Pick = { code: string; name: string; close: number; buy_below: number; stop: number; why: string };
type Payload = {
  date: string; status: 'go' | 'wait' | 'caution' | 'none'; action: string;
  picks: Pick[]; reliability: string;
};

const STATUS_STYLE: Record<Payload['status'], { bg: string; border: string; text: string; label: string }> = {
  go:      { bg: 'bg-[#FFF6EC]', border: 'border-[#E8973A]', text: 'text-[#B5651D]', label: '可以進' },
  caution: { bg: 'bg-amber-50',  border: 'border-amber-300', text: 'text-amber-800', label: '先別急' },
  wait:    { bg: 'bg-slate-50',  border: 'border-slate-300', text: 'text-slate-700', label: '先不要買' },
  none:    { bg: 'bg-slate-50',  border: 'border-slate-300', text: 'text-slate-700', label: '今天沒有' },
};

export const ChaiPicks: React.FC = () => {
  const [data, setData] = useState<Payload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: rows } = await supabase.from('daily_analysis').select('ai_comment')
          .eq('stock_code', 'CHAI_PICKS').order('analysis_date', { ascending: false }).limit(1);
        if (rows && rows[0]?.ai_comment) setData(JSON.parse(rows[0].ai_comment as string));
      } catch { /* 沒資料就顯示空狀態 */ }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;
  if (!data) {
    return (
      <div className="mb-8 px-5 py-4 bg-white border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-500">
        🐕 柴柴今日可進：今天收盤後才會算出第一份名單
      </div>
    );
  }
  const st = STATUS_STYLE[data.status] || STATUS_STYLE.none;
  const [, m, d] = data.date.split('-').map(Number);
  const canBuy = data.status === 'go';

  return (
    <div className={`mb-10 rounded-[2rem] border-2 ${st.border} ${st.bg} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-[17px] font-black text-[#1A1A1A]">🐕 柴柴今日可進</h3>
        <span className={`text-[12px] font-black px-2.5 py-1 rounded-full bg-white border ${st.border} ${st.text}`}>{st.label}</span>
        <span className="text-[12px] font-bold text-slate-400">{m}/{d} 收盤算</span>
      </div>
      <p className={`text-[14px] font-bold ${st.text} mb-4 leading-relaxed`}>{data.action}</p>

      {data.picks.length > 0 && (
        <div className="space-y-2.5">
          {data.picks.map((p, i) => (
            <div key={p.code} className={`bg-white rounded-2xl px-4 py-3 border border-slate-100 ${canBuy ? '' : 'opacity-80'}`}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-black text-slate-400">{i + 1}.</span>
                <span className="text-[16px] font-black text-[#1A1A1A]">{p.name}</span>
                <span className="text-[13px] font-bold text-slate-400">{p.code}</span>
              </div>
              <div className="mt-1 text-[14px] font-bold text-[#1A1A1A]">
                買在 <span className="text-[#C83232]">{p.buy_below}</span> 以下　｜　跌破 <span className="text-[#2E8B57]">{p.stop}</span> 要賣
              </div>
              <div className="mt-0.5 text-[12px] font-bold text-slate-400">{p.why}</div>
            </div>
          ))}
          <p className="text-[12px] font-bold text-slate-500 pt-1">每檔先買三分之一，單檔最多放總資金的 1/5。{data.reliability}。</p>
        </div>
      )}
    </div>
  );
};
