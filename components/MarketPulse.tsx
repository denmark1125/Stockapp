import React, { useState } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import { Map, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

// SECTOR_FLOW 特殊列的 JSON 結構（後端 scan_stocks.upsert_sector_flow 寫入）
export interface SectorFlowItem {
  name: string;       // 產業名
  avg_chg: number;    // 簡單平均漲跌 %
  turnover: number;   // 成交額（億）
  flow: number;       // 資金流估算（億，Σ成交額×漲跌%）
  n: number;          // 檔數
  top: { code: string; name: string; chg: number }[];  // |漲跌|前3檔
}
export interface SectorFlowData {
  date: string;       // 實際交易日（假日時會是最近一個交易日）
  updated?: string;
  sectors: SectorFlowItem[];
}

// 台灣慣例紅漲綠跌，依幅度 5 級深淺
const chgColor = (chg: number): string =>
  chg >= 2 ? '#B02A26' :
  chg >= 0.15 ? '#D05B4B' :
  chg > -0.15 ? '#A8A29E' :
  chg > -2 ? '#3C9B72' : '#1D7A55';

// Treemap 自訂格子：產業名 + 漲跌%（格子太小就只畫色塊）
const TreemapCell: React.FC<any> = (props) => {
  const { x, y, width, height, name, avg_chg, onPick } = props;
  if (width <= 0 || height <= 0 || name == null) return null;
  const chg = Number(avg_chg) || 0;
  const showName = width > 52 && height > 34;
  const showChg = width > 52 && height > 52;
  return (
    <g onClick={() => onPick?.(name)} style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width={width} height={height} rx={4}
        fill={chgColor(chg)} stroke="#FDFBF7" strokeWidth={2} />
      {showName && (
        <text x={x + width / 2} y={y + height / 2 + (showChg ? -6 : 5)} textAnchor="middle"
          fill="#fff" fontSize={Math.min(15, Math.max(11, width / 8))} fontWeight={900}>
          {name}
        </text>
      )}
      {showChg && (
        <text x={x + width / 2} y={y + height / 2 + 14} textAnchor="middle"
          fill="rgba(255,255,255,0.92)" fontSize={12} fontWeight={700} className="num">
          {chg > 0 ? '+' : ''}{chg.toFixed(2)}%
        </text>
      )}
    </g>
  );
};

// 資金流排行列：水平 bar 寬度＝|flow| 正規化
const FlowRow: React.FC<{ s: SectorFlowItem; maxAbs: number; inflow: boolean }> = ({ s, maxAbs, inflow }) => {
  const w = maxAbs > 0 ? Math.max(4, Math.abs(s.flow) / maxAbs * 100) : 4;
  const col = inflow ? '#C83232' : '#10b981';
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-[13px] font-black text-[#1A1A1A] w-24 shrink-0 truncate">{s.name}</span>
      <div className="flex-1 h-4 bg-[#F3EEE4] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: col, opacity: 0.85 }} />
      </div>
      <span className="num text-[13px] font-black w-16 text-right shrink-0" style={{ color: col }}>
        {s.flow > 0 ? '+' : ''}{s.flow.toFixed(0)}億
      </span>
      <span className="num text-[12px] font-bold w-14 text-right shrink-0"
        style={{ color: s.avg_chg >= 0 ? '#C83232' : '#10b981' }}>
        {s.avg_chg > 0 ? '+' : ''}{s.avg_chg}%
      </span>
    </div>
  );
};

export const MarketPulse: React.FC<{ flow: SectorFlowData | null }> = ({ flow }) => {
  const [view, setView] = useState<'map' | 'rank'>('map');
  const [picked, setPicked] = useState<string | null>(null);

  // 資料還沒進來（今日尚未收盤、或後端還沒跑）→ 溫和提示，不噴錯
  if (!flow || !flow.sectors?.length) {
    return (
      <div className="mb-8 bg-white rounded-3xl p-6 border border-[#EDE7DA] shadow-[0_1px_4px_rgba(45,45,45,0.04)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-[5px] h-6 rounded-full bg-[#E8973A]" />
          <h2 className="text-[19px] font-black text-[#1A1A1A]">台股產業脈動</h2>
        </div>
        <p className="text-[13px] font-bold text-slate-400 flex items-center gap-2">
          <Clock size={15} /> 產業脈動資料將於今日收盤（16:05）後更新
        </p>
      </div>
    );
  }

  const sectors = flow.sectors;
  const inflows = sectors.filter(s => s.flow > 0).sort((a, b) => b.flow - a.flow).slice(0, 8);
  const outflows = sectors.filter(s => s.flow < 0).sort((a, b) => a.flow - b.flow).slice(0, 8);
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.flow)), 0.01);
  const pickedSector = picked ? sectors.find(s => s.name === picked) : null;

  return (
    <div className="mb-8 bg-white rounded-3xl p-6 lg:p-7 border border-[#EDE7DA] shadow-[0_1px_4px_rgba(45,45,45,0.04)]">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="w-[5px] h-6 rounded-full bg-[#E8973A]" />
        <h2 className="text-[19px] font-black text-[#1A1A1A] flex items-center gap-2">
          <Map size={19} className="text-[#E8973A]" /> 台股產業脈動
        </h2>
        <span className="num text-[12px] text-slate-400">{flow.date} 收盤</span>
        <div className="flex gap-1 ml-auto bg-[#F8F4EC] p-1 rounded-full border border-[#F0EAE0]">
          <button onClick={() => setView('map')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${view === 'map' ? 'bg-[#1A1A1A] text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}>
            熱力圖
          </button>
          <button onClick={() => setView('rank')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${view === 'rank' ? 'bg-[#1A1A1A] text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}>
            資金流
          </button>
        </div>
      </div>

      {view === 'map' ? (
        <>
          <div className="w-full h-[300px] lg:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={sectors as any[]} dataKey="turnover" nameKey="name"
                isAnimationActive={false} aspectRatio={4 / 3}
                content={<TreemapCell onPick={(n: string) => setPicked(p => p === n ? null : n)} />} />
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400">面積＝成交金額 · 顏色＝平均漲跌</span>
            {[['≥+2%', '#B02A26'], ['+0~2%', '#D05B4B'], ['持平', '#A8A29E'], ['0~-2%', '#3C9B72'], ['≤-2%', '#1D7A55']].map(([t, c]) => (
              <span key={t} className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />{t}
              </span>
            ))}
          </div>
          {pickedSector && (
            <div className="mt-4 bg-[#FBF9F4] border border-[#F0EAE0] rounded-2xl p-4">
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <span className="text-[15px] font-black text-[#1A1A1A]">{pickedSector.name}</span>
                <span className="num text-[13px] font-black" style={{ color: pickedSector.avg_chg >= 0 ? '#C83232' : '#10b981' }}>
                  平均 {pickedSector.avg_chg > 0 ? '+' : ''}{pickedSector.avg_chg}%
                </span>
                <span className="num text-[12px] text-slate-400">成交 {pickedSector.turnover.toFixed(0)}億 · {pickedSector.n} 檔</span>
                <button onClick={() => setPicked(null)} className="ml-auto text-[12px] font-bold text-slate-400 hover:text-[#1A1A1A]">✕ 收合</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {pickedSector.top.map(t => (
                  <span key={t.code} className="px-3 py-1.5 bg-white border border-[#EDE7DA] rounded-full text-[12px] font-bold text-[#2D2D2D]">
                    {t.name} <span className="num text-slate-400">{t.code}</span>{' '}
                    <span className="num" style={{ color: t.chg >= 0 ? '#C83232' : '#10b981' }}>
                      {t.chg > 0 ? '+' : ''}{t.chg}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-[13px] font-black text-[#C83232] mb-2 flex items-center gap-1">
              <ArrowUpRight size={15} /> 資金流入（估算）
            </p>
            {inflows.length ? inflows.map(s => <FlowRow key={s.name} s={s} maxAbs={maxAbs} inflow />) :
              <p className="text-[12px] font-bold text-slate-400 py-3">今日無明顯流入產業</p>}
          </div>
          <div>
            <p className="text-[13px] font-black text-emerald-600 mb-2 flex items-center gap-1">
              <ArrowDownRight size={15} /> 資金流出（估算）
            </p>
            {outflows.length ? outflows.map(s => <FlowRow key={s.name} s={s} maxAbs={maxAbs} inflow={false} />) :
              <p className="text-[12px] font-bold text-slate-400 py-3">今日無明顯流出產業</p>}
          </div>
        </div>
      )}
      <p className="text-[11px] font-bold text-[#B8A882] mt-4">
        資金流＝漲跌幅×成交額的估算值，非法人實際買賣超 · 週/月檢視待資料累積後推出
      </p>
    </div>
  );
};
