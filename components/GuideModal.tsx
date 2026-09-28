import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

// 📖 使用說明：兩種模式
//   onboarding — 新用戶首次登入的分頁教學（可略過）
//   manual     — 完整使用手冊（右上角 ? 隨時打開）
// 內容原則：白話、告訴用戶「看什麼、做什麼」，最後一定有謹慎理財聲明。

interface GuideModalProps {
  mode: 'onboarding' | 'manual';
  onClose: () => void;
}

const Section: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="mb-6">
    <h3 className="text-[15px] font-black text-[#1A1A1A] mb-2 flex items-center gap-2">
      <span>{icon}</span>{title}
    </h3>
    <div className="text-[13px] text-[#4A4438] leading-relaxed space-y-2">{children}</div>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = '#F5EFE3' }) => (
  <span className="inline-block px-2 py-0.5 rounded-md text-[13px] font-bold mr-1 mb-1" style={{ backgroundColor: color }}>{children}</span>
);

// ── 內容區塊（onboarding 分頁用同一份內容） ──────────────────────
const PAGE_WELCOME = (
  <>
    <Section icon="🐕" title="歡迎來到 Alpha Ledger！">
      <p>這是一套<b>台股掃描＋決策輔助系統</b>：每天自動分析全市場，把「值得看的股票」整理好給你，並用白話告訴你<b>該買、該等、還是別碰</b>。</p>
      <p>你不需要懂技術分析——看得懂「紅綠燈」就會用。</p>
    </Section>
    <Section icon="⚠️" title="先講最重要的一件事（謹慎理財）">
      <p><b>沒有任何系統能保證賺錢，這套也一樣。</b>近期回測有不少買進訊號先碰停損，歷史表現也會變動。請把它當候選清單，先看現價和買點，再決定是否交易。</p>
      <p>所以三條鐵律請刻在心上：</p>
      <p>1️⃣ <b>跌破停損價就賣</b>，不凹單、不攤平<br/>2️⃣ <b>單一檔股票不重壓</b>（卡片有建議上限）<br/>3️⃣ <b>只用閒錢投資</b>，借錢梭哈的請立刻關掉這個 App</p>
    </Section>
  </>
);

const PAGE_PICK = (
  <>
    <Section icon="🏆" title="怎麼挑股：看「今日嚴選」就好">
      <p>打開「精選雷達」，最上面的 <b>🏆 今日嚴選</b>（最多 5 檔）列出符合目前篩選條件的股票。這是待確認的候選清單。</p>
      <p>沒有嚴選的日子代表條件不夠好——<b>「今天不出手」也是系統給你的建議</b>，空手沒有錯。</p>
    </Section>
    <Section icon="💡" title="「亮燈」是什麼？">
      <p>系統原本用 5 個條件整理候選股；火焰近期表現不佳，暫停計入排序，目前有 4 個條件會亮燈：</p>
      <p>
        <Chip>🤖 AI題材</Chip><Chip>📈 52週高</Chip><Chip>💪 RS強勢</Chip><Chip>🌱 營收穩健</Chip><Chip>🔥 暫停驗證</Chip>
      </p>
      <p>卡片上的「亮燈 3/5」只表示符合 3 個條件，<b>不代表有 3 成或更高的獲利機率</b>。最近的回測沒有證明燈越多就越準，尤其「🔥 高機會」仍在重新驗證。</p>
    </Section>
  </>
);

const PAGE_TRADE = (
  <>
    <Section icon="🚦" title="怎麼看買賣：結論徽章 ＋ 三個價格">
      <p>每張卡片上方有一句<b>白話結論</b>，直接照著做：</p>
      <p>
        <Chip color="#FBF1EF">✅ 可考慮買進</Chip>＝股好、價位也可以進<br/>
        <Chip color="#FBF4E9">⏸ 等回檔再買</Chip>＝股好但漲多了，追進去容易套<br/>
        <Chip color="#F2EFE7">👀 觀望</Chip>＝先別動　<Chip color="#F2EFE7">🚫 避開</Chip>＝別碰<br/>
        <Chip color="#FBF1EF">🔴 建議出場</Chip>＝已跌破停損，該走了
      </p>
      <p>卡片底部三個價格：<b>ENTRY</b>＝建議買進價（掛限價單用）、<b>STOP</b>＝停損價（<b>跌破一定要賣</b>）、<b>TARGET</b>＝目標價（到了可以獲利了結）。</p>
      <p>💚 價格旁邊有綠色小點＝盤中參考價；頁面開啟時約每分鐘抓取一次。若報價失敗或市場休市，請以券商最新報價為準。</p>
    </Section>
    <Section icon="🛡️" title="停損為什麼是鐵律？">
      <p>買進前先決定能承受的虧損與停損方式。訊號會錯，停損價也可能因跳空而無法成交在預期價位；請在券商設定提醒並自行確認委託。</p>
    </Section>
  </>
);

const PAGE_TOOLS = (
  <>
    <Section icon="💼" title="帳冊：記錄你的持股">
      <p>買了股票後到「資產帳冊」登錄（<b>輸入代碼</b>如 2330、買價、股數）。之後系統每天會：</p>
      <p>・顯示即時損益＋損益平衡價（含手續費稅）<br/>・🐕 GBrain 每天給你持股建議（續抱／注意／出場）<br/>・跌破停損時發出警報</p>
    </Section>
    <Section icon="🐶" title="汪汪管家＆LINE">
      <p>右下角的<b>柴犬按鈕</b>＝汪汪管家，可以直接問它：「1455」「今天買什麼」「我的持股怎麼辦」「台積電跟聯發科哪個好」。</p>
      <p>加 LINE 官方帳號並綁定 email 後：每天早上收<b>開盤早報</b>、傍晚收<b>收盤柴報</b>、大盤重挫即時警報；LINE 裡也能傳代碼或名字查股、跟汪汪聊天。</p>
    </Section>
    <Section icon="📜" title="免責聲明">
      <p className="text-[13px] text-[#8B7E68]">本系統所有內容均為公開數據之彙整與統計分析，僅供參考，<b>不構成投資建議</b>。歷史勝率不代表未來表現，投資有風險，任何買賣決定與盈虧皆由使用者自行負責。請量力而為、謹慎理財。</p>
    </Section>
  </>
);

const PAGES = [
  { title: '歡迎', body: PAGE_WELCOME },
  { title: '怎麼挑股', body: PAGE_PICK },
  { title: '怎麼買賣', body: PAGE_TRADE },
  { title: '帳冊與汪汪', body: PAGE_TOOLS },
];

export const GuideModal: React.FC<GuideModalProps> = ({ mode, onClose }) => {
  const [step, setStep] = useState(0);
  const isOnboarding = mode === 'onboarding';
  const last = step === PAGES.length - 1;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-0 lg:p-8" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full h-full lg:h-auto lg:max-h-[85vh] lg:max-w-[560px] bg-[#FDFBF7] lg:rounded-[2rem] lg:border lg:border-[#E8D9C0] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* 標頭 */}
        <div className="flex items-center gap-3 px-6 py-4 bg-[#F8F4EE] border-b border-[#E8D9C0]" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <img src="/logo.png" alt="" className="w-9 h-9 rounded-full ring-1 ring-[#E8973A]/40" />
          <div className="flex-1">
            <p className="text-[14px] font-black text-[#1A1A1A]">{isOnboarding ? `新手教學（${step + 1}/${PAGES.length}）` : '使用手冊'}</p>
            <p className="text-[12px] font-bold text-[#B8A882]">{isOnboarding ? PAGES[step].title : '看不懂的時候隨時回來翻'}</p>
          </div>
          {isOnboarding && (
            <button onClick={onClose} className="text-[13px] font-bold text-slate-400 hover:text-[#1A1A1A] px-2 py-1">略過</button>
          )}
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-[#1A1A1A]"><X size={18} /></button>
        </div>

        {/* 內容 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isOnboarding ? PAGES[step].body : PAGES.map((p, i) => <div key={i}>{p.body}</div>)}
        </div>

        {/* 導覽（onboarding 才有） */}
        {isOnboarding && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#E8D9C0] bg-white" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1 text-[12px] font-bold text-slate-400 disabled:opacity-30 hover:text-[#1A1A1A]"
            >
              <ChevronLeft size={14} /> 上一頁
            </button>
            <div className="flex gap-1.5">
              {PAGES.map((_, i) => (
                <span key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-[#E8973A]' : 'bg-slate-200'}`} />
              ))}
            </div>
            <button
              onClick={() => (last ? onClose() : setStep(s => s + 1))}
              className="flex items-center gap-1 text-[12px] font-black text-white bg-[#E8973A] hover:bg-[#d8862c] px-4 py-2 rounded-xl transition-colors"
            >
              {last ? '開始使用 🐕' : '下一頁'} {!last && <ChevronRight size={14} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
