import React, { useState, useEffect } from 'react';
import { X, Globe, ShieldAlert, Zap, Terminal, ExternalLink, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../services/supabase';

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
        '載入今日情報資料庫...',
        '解密 Alpha 終端報告...',
        '彙整最新市場訊號...',
        'Alpha 終端報告載入中...'
      ];

      let statusIdx = 0;
      const statusInterval = setInterval(() => {
        if (statusIdx < statusUpdates.length) {
          setStatusText(statusUpdates[statusIdx]);
          statusIdx++;
        }
      }, 800);

      try {
        const reportType = type === 'weekly' ? 'weekly' : 'daily';

        const { data, error } = await supabase
          .from('ai_reports')
          .select('content, report_date')
          .eq('report_type', reportType)
          .order('report_date', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          setReport({ text: "⚠️ 今日報告尚未產生。\n\n報告由每日掃描程式自動產生，通常在晚上 9 點後更新。請稍後再試。", links: [] });
        } else {
          setReport({ text: `📅 報告日期：${data.report_date}\n\n${data.content}`, links: [] });
        }
      } catch (e) {
        setReport({ text: "⚠️ 載入報告失敗，請稍後再試。", links: [] });
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

        <div className="h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600"></div>

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
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">載入中... 請稍候</p>
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
