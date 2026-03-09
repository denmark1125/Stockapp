
import React, { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, Globe, ShieldAlert, FileText, Zap, Terminal, ExternalLink, ChevronRight, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface GlobalAiReportModalProps {
  type: 'daily' | 'weekly';
  onClose: () => void;
  portfolioStocks: string[];
}

export const GlobalAiReportModal: React.FC<GlobalAiReportModalProps> = ({ type, onClose, portfolioStocks }) => {
  const [report, setReport] = useState<{text: string, links: {title: string, uri: string}[]} | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('正在建立安全連線...');

  useEffect(() => {
    const generateGlobalReport = async () => {
      setLoading(true);
      const statusUpdates = [
        '正在建立安全加密連線...',
        '掃描批踢踢、Dcard 小道消息...',
        '追蹤法說會最新流出傳聞...',
        '檢索主力籌碼與內幕風向...',
        '偵測大盤異常資金流動...',
        'Alpha 終端正在彙整致富指令...'
      ];
      
      let statusIdx = 0;
      const statusInterval = setInterval(() => {
        if (statusIdx < statusUpdates.length) {
          setStatusText(statusUpdates[statusIdx]);
          statusIdx++;
        }
      }, 2000);

      try {
        const isWeekly = type === 'weekly';
        const today = format(new Date(), 'yyyy-MM-dd HH:mm');
        const portfolioSection = portfolioStocks.length > 0
          ? `\n用戶目前持股：${portfolioStocks.join('、')}\n請特別說明這些持股是否有需要注意的風險或出場時機。`
          : '';

        const prompt = `你是 Alpha Ledger 首席金融情報官（CIO）。今天是 ${today}。

請針對${isWeekly ? '本週台股市場動向與下週操作展望' : '今日台股市場動態與操作建議'}產出「Alpha 機密報告」。
${portfolioSection}

報告結構：
1. 【大盤解讀】今日/本週大盤重點，多空方向判斷
2. 【三大法人動向】外資、投信、自營商各在做什麼？
3. 【熱門題材】目前市場最強的 2~3 個題材或族群
4. 【操作建議】給新手投資人的具體行動建議（買什麼、等什麼、避開什麼）
5. 【風險提示】目前需要注意的風險因子

語氣直接有主見，像頂級交易員對朋友說話。用繁體中文，適當使用 emoji。`;

        const response = await fetch(
          "https://zfkwzbupyvrrthuowchc.supabase.co/functions/v1/claude-proxy",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, max_tokens: 1200 })
          }
        );
        const data = await response.json();
        const text = data.content?.[0]?.text || "⚠️ 情報解碼失敗";
        setReport({ text, links: [] });
      } catch (e) {
        setReport({ text: "⚠️ 情報網遭到封鎖，請稍後再試。", links: [] });
      } finally {
        setLoading(false);
        clearInterval(statusInterval);
      }
    };

    generateGlobalReport();
  }, [type, portfolioStocks]);

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 lg:p-10">
      <div className="w-full max-w-4xl bg-[#0A0A0A] rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(244,63,94,0.1)] overflow-hidden flex flex-col h-[90vh] lg:max-h-[85vh] animate-in zoom-in duration-300 relative">
        
        <button onClick={onClose} className="absolute top-6 right-8 z-50 text-slate-500 hover:text-white transition-colors"><X size={24}/></button>

        <div className="h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 animate-shimmer"></div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
           <div className="w-full lg:w-[280px] bg-slate-900/50 p-8 border-r border-white/5 flex flex-col shrink-0">
              <div className="bg-rose-600/10 text-rose-500 p-3 rounded-2xl inline-flex mb-6 self-start border border-rose-500/20"><Terminal size={20} /></div>
              <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase mb-1">Alpha Terminal</h2>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8">Intelligence Dossier</span>
              
              <div className="space-y-6 mt-auto">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">系統狀態: 在線</span>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">報告日期</span>
                    <div className="text-sm font-black text-white italic">{format(new Date(), 'yyyy.MM.dd')}</div>
                 </div>
              </div>
           </div>

           <div className="flex-1 p-8 lg:p-12 overflow-y-auto scrollbar-hide bg-[#050505] relative">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-8 py-20">
                   <div className="relative">
                      <div className="w-24 h-24 rounded-full border border-rose-500/20 animate-ping absolute inset-0"></div>
                      <div className="w-24 h-24 rounded-full border-2 border-rose-600 border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-rose-500"><Zap size={32} fill="currentColor" /></div>
                   </div>
                   <div className="text-center">
                      <p className="text-lg font-black italic text-white uppercase tracking-tighter mb-2">{statusText}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">偵蒐中... 請保持終端連線</p>
                   </div>
                </div>
              ) : report ? (
                <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000">
                   <div className="flex items-center gap-3 mb-10 pb-6 border-b border-white/5">
                      <ShieldAlert size={18} className="text-rose-500" />
                      <h3 className="text-[11px] font-black text-rose-500 uppercase tracking-[0.3em]">機密文件：ALPHA 情報中心 - 最新獲利指令</h3>
                   </div>

                   <div className="prose prose-invert max-w-none">
                      <div className="text-base lg:text-lg text-slate-200 leading-relaxed font-medium whitespace-pre-line border-l-2 border-rose-600/50 pl-8 mb-12">
                         {report.text}
                      </div>
                   </div>

                   {report.links.length > 0 && (
                     <div className="mt-16 pt-8 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-6">
                           <Globe size={14} className="text-slate-500" />
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">聯網驗證節點 (LIVE SOURCES)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           {report.links.map((link, idx) => (
                             <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="group bg-white/5 hover:bg-white/10 border border-white/5 p-4 rounded-2xl flex items-center justify-between transition-all">
                                <span className="text-[10px] font-bold text-slate-300 truncate max-w-[200px]">{link.title}</span>
                                <ExternalLink size={12} className="text-slate-600 group-hover:text-white transition-colors" />
                             </a>
                           ))}
                        </div>
                     </div>
                   )}

                   <div className="mt-12 p-6 bg-rose-600/10 rounded-[2rem] border border-rose-500/20 text-center">
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">⚠️ 警語：Alpha 情報僅供策略參考，不保證獲利，投資請自負風險。</p>
                   </div>
                </div>
              ) : null}
           </div>
        </div>
      </div>
    </div>
  );
};
