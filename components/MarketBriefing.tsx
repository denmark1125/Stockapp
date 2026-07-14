import React from 'react';
import { Activity, Info, TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react';

interface MarketBriefingProps {
  loading: boolean;
  marketRegime?: string;  // 問題5：新增大盤狀態
  changePct?: number | null;  // 大盤今日漲跌%（MARKET_STATE.volatility，真實資料）
  volRatio?: number | null;   // 全市場個股 vol_ratio 平均（前端即時算，真實資料）
  date?: string | null;       // 最新資料日期
}

export const MarketBriefing: React.FC<MarketBriefingProps> = ({ loading, marketRegime, changePct, volRatio, date }) => {
  if (loading) return (
    <div className="w-full bg-slate-50 rounded-3xl p-10 animate-pulse border border-slate-100 mb-10 h-32"></div>
  );

  // 問題5：大盤空頭時整個元件變成醒目紅底
  if (marketRegime === 'BEAR') {
    return (
      <div className="w-full bg-[#C83232] text-white rounded-3xl p-8 lg:p-10 mb-10 border border-red-700 shadow-xl shadow-red-900/20 flex flex-col lg:flex-row gap-6 items-start lg:items-center">
        <div className="shrink-0">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center border-2 border-white/30 bg-white/10">
            <AlertTriangle size={30} className="animate-pulse" />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[13px] font-black tracking-widest text-red-200">大盤空頭警戒</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-black leading-tight mb-3">
            大盤跌破季線，市場進入空頭模式
          </h2>
          <p className="text-[14px] text-red-100 font-medium">
            系統已自動封鎖所有新買進訊號。建議：空手觀望、管理庫存停損、等待大盤站回 MA60 再考慮進場。
          </p>
        </div>
        <div className="bg-white/10 p-5 rounded-2xl w-full lg:w-64 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <Info size={16} className="text-red-200" />
            <span className="text-[13px] font-bold tracking-wide text-red-200">現在該做什麼</span>
          </div>
          <p className="text-[13px] font-medium text-white leading-relaxed">
            🔴 空手保命，不要逢低攤平<br />
            📋 檢查庫存，跌破停損立即出場<br />
            ⏳ 耐心等待大盤回穩訊號
          </p>
        </div>
      </div>
    );
  }

  if (marketRegime !== 'BULL' && marketRegime !== 'SIDEWAYS') return null;

  const isBull = marketRegime === 'BULL';
  const isSideways = marketRegime === 'SIDEWAYS';

  return (
    <div className="w-full bg-white rounded-3xl p-6 lg:p-8 mb-10 border border-[#EDE7DA] shadow-[0_1px_4px_rgba(45,45,45,0.04)]">

      {/* 標頭：色條 + 粗黑體(參考案例的區塊標頭語言) */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-[5px] h-6 rounded-full ${isBull ? 'bg-[#C83232]' : isSideways ? 'bg-[#E8973A]' : 'bg-slate-300'}`} />
        <h2 className="text-[19px] font-black text-[#1A1A1A]">今日市場</h2>
        {date && <span className="num text-[12px] text-slate-400 ml-auto">{date}</span>}
      </div>

      {/* 大數字統計卡排(參考「產業關鍵指標」格式：icon籤 + 標籤 + 大粗字) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="flex items-center gap-3 bg-[#FBF9F4] rounded-2xl p-4 border border-[#F0EAE0]">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0
            ${isBull ? 'bg-[#FBF1EF] text-[#C83232]' : isSideways ? 'bg-[#FBF4E9] text-[#E8973A]' : 'bg-slate-100 text-slate-500'}`}>
            {isBull ? <TrendingUp size={22} /> : isSideways ? <Activity size={22} /> : <TrendingDown size={22} />}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#A89878]">大盤趨勢</p>
            <p className={`text-[19px] font-black leading-tight
              ${isBull ? 'text-[#C83232]' : isSideways ? 'text-[#C87832]' : 'text-slate-500'}`}>
              {isBull ? '多頭 ↗' : isSideways ? '盤整 →' : '中性'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#FBF9F4] rounded-2xl p-4 border border-[#F0EAE0]">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#A89878]">今日漲跌</p>
            <p className="num text-[19px] font-black leading-tight"
              style={{ color: changePct == null ? '#1A1A1A' : changePct >= 0 ? '#C83232' : '#10b981' }}>
              {changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#FBF9F4] rounded-2xl p-4 border border-[#F0EAE0]">
          <div className="w-11 h-11 rounded-xl bg-[#EEF3FB] text-[#3B6FC8] flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#A89878]">全市場量能</p>
            <p className="num text-[19px] font-black text-[#1A1A1A] leading-tight">{volRatio != null ? volRatio.toFixed(2) : '—'}x</p>
          </div>
        </div>
      </div>

      {/* 白話一句 + 操作方略 */}
      <p className="text-[16px] font-bold text-[#2D2D2D] leading-relaxed mb-3">
        {isBull ? '多頭氣勢強勁，聚焦動能領頭標的' :
         isSideways ? '大盤盤整，選股需更嚴格，優先波段布局' :
         '目前市場環境相對穩定，適合觀測趨勢標的。'}
      </p>
      <div className={`rounded-xl overflow-hidden flex items-stretch ${isBull ? 'bg-[#FBF1EF]' : isSideways ? 'bg-[#FBF4E9]' : 'bg-slate-50'}`}>
        <div className={`w-[4px] shrink-0 ${isBull ? 'bg-[#C83232]' : isSideways ? 'bg-[#E8973A]' : 'bg-slate-300'}`} />
        <div className="px-4 py-3 flex items-start gap-2">
          <Info size={15} className="text-slate-400 mt-0.5 shrink-0" />
          <p className="text-[13px] font-medium text-slate-600">
            {isBull ? '多頭確立，聚焦強勢題材股，可積極布局。' :
             isSideways ? '盤整格局，評分需更高門檻，等待突破方向。' :
             '等待市場量能沉澱，觀察支撐區。'}
          </p>
        </div>
      </div>
    </div>
  );
};
