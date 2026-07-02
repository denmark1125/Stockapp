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
  <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold mr-1 mb-1" style={{ backgroundColor: color }}>{children}</span>
);

// ── 內容區塊（onboarding 分頁用同一份內容） ──────────────────────
const PAGE_WELCOME = (
  <>
    <Section icon="🐕" title="歡迎來到 Alpha Ledger！">
      <p>這是一套<b>台股掃描＋決策輔助系統</b>：每天自動分析全市場，把「值得看的股票」整理好給你，並用白話告訴你<b>該買、該等、還是別碰</b>。</p>
      <p>你不需要懂技術分析——看得懂「紅綠燈」就會用。</p>
    </Section>
    <Section icon="⚠️" title="先講最重要的一件事（謹慎理財）">
      <p><b>沒有任何系統能保證賺錢，這套也一樣。</b>它的歷史勝率約五成多一點——意思是<b>將近一半的推薦會錯</b>。它能幫你的是：錯的時候賠小錢、對的時候賺大錢。</p>
      <p>所以三條鐵律請刻在心上：</p>
      <p>1️⃣ <b>跌破停損價就賣</b>，不凹單、不攤平<br/>2️⃣ <b>單一檔股票不重壓</b>（卡片有建議上限）<br/>3️⃣ <b>只用閒錢投資</b>，借錢梭哈的請立刻關掉這個 App</p>
    </Section>
  </>
);

const PAGE_PICK = (
  <>
    <Section icon="🏆" title="怎麼挑股：看「今日嚴選」就好">
      <p>打開「精選雷達」，最上面的 <b>🏆 今日嚴選</b>（最多 5 檔）就是系統當天最有把握的股票。<b>新手只看這區就夠了。</b></p>
      <p>沒有嚴選的日子代表條件不夠好——<b>「今天不出手」也是系統給你的建議</b>，空手沒有錯。</p>
    </Section>
    <Section icon="💡" title="「亮燈」是什麼？">
      <p>系統用過去一年 7,000 多筆真實紀錄，驗證出 <b>5 個「歷史上真的有用」的贏家條件</b>，每滿足一個就亮一盞燈：</p>
      <p>
        <Chip>🤖 AI題材</Chip><Chip>🔥 高機會</Chip><Chip>📈 52週高</Chip><Chip>💪 RS強勢</Chip><Chip>🌱 營收穩健</Chip>
      </p>
      <p><b>燈亮越多＝歷史上越會漲</b>：0 燈只有 38% 會漲、3 燈 55%、<b>4 燈高達 75%</b>。卡片上的「亮燈 3/5」就是這個意思，不用背每盞燈的細節。</p>
      <p className="text-[11px] text-[#8B7E68]">（其他常見指標如均線、MACD、法人買超也測過——單獨沒有優勢，為了不稀釋訊號已移除。這裡的每一盞燈都是實證留下來的。）</p>
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
      <p>💚 價格旁邊有綠色 <b>LIVE</b> 小點＝盤中即時價（每分鐘更新）。</p>
    </Section>
    <Section icon="🛡️" title="停損為什麼是鐵律？">
      <p>系統近一半的推薦會錯——<b>它賴以生存的就是「錯了馬上小賠出場」</b>。只要你凹單一次大賠 30%，要再賺 43% 才回得了本。設好券商到價提醒，跌破停損價無腦賣。</p>
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
      <p className="text-[11px] text-[#8B7E68]">本系統所有內容均為公開數據之彙整與統計分析，僅供參考，<b>不構成投資建議</b>。歷史勝率不代表未來表現，投資有風險，任何買賣決定與盈虧皆由使用者自行負責。請量力而為、謹慎理財。</p>
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
            <p className="text-[9px] font-bold text-[#B8A882]">{isOnboarding ? PAGES[step].title : '看不懂的時候隨時回來翻'}</p>
          </div>
          {isOnboarding && (
            <button onClick={onClose} className="text-[11px] font-bold text-slate-400 hover:text-[#1A1A1A] px-2 py-1">略過</button>
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
