
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  X, ArrowRight, Loader2, BookOpen, Globe, Trophy, Star, Plus
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, addToPortfolio, deleteFromPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { StockDetailModal } from './components/StockDetailModal';
import { GoogleGenAI } from "@google/genai";
import { format, isAfter, isValid } from 'date-fns';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [state, setState] = useState<DashboardState>({
    data: [], portfolio: [], loading: true, error: null, lastUpdated: null
  });

  const [activeView, setActiveView] = useState<'daily' | 'portfolio'>('daily');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!session) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const [marketData, portfolioData] = await Promise.all([fetchDailyAnalysis(), fetchPortfolio()]);
      
      let latestDate = new Date(0);
      marketData.forEach(item => {
        const d = new Date(item.updated_at);
        if (isValid(d) && isAfter(d, latestDate)) {
          latestDate = d;
        }
      });
      
      setState({ 
        data: marketData, 
        portfolio: portfolioData, 
        loading: false, 
        error: null, 
        lastUpdated: latestDate.getTime() > 0 ? latestDate : new Date()
      });
    } catch (err: any) { 
      setState(prev => ({ ...prev, loading: false, error: err.message })); 
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const viewData = useMemo(() => {
    if (activeView === 'daily') {
      return state.data
        .filter(s => s.stock_code !== 'MARKET_BRIEF')
        .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));
    } else {
      return state.portfolio.map(p => {
        const analysis = state.data.find(d => d.stock_code === p.stock_code);
        return analysis ? { ...analysis, is_holding_item: true, portfolio_id: p.id, buy_price: p.buy_price } : {
          id: p.id,
          stock_code: p.stock_code,
          stock_name: p.stock_name,
          close_price: p.buy_price,
          buy_price: p.buy_price,
          ai_score: 0,
          trade_signal: 'INVEST_HOLD',
          updated_at: p.created_at,
          roe: 0, revenue_yoy: 0, pe_ratio: 0,
          analysis_date: '', volume: 0
        } as unknown as DailyAnalysis;
      });
    }
  }, [state.data, state.portfolio, activeView]);

  const handleAiInsight = async (stock: DailyAnalysis) => {
    setIsAiLoading(true);
    setAiReport(null);
    setIsReportModalOpen(true);
    try {
      // 依照 @google/genai 指南，必須直接使用 process.env.API_KEY 且不透過 ImportMeta
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API });
      const prompt = `分析對象：${stock.stock_name} (${stock.stock_code})。
      當前 AI 評分：${stock.ai_score}。ROE：${stock.roe}%，營收增長：${stock.revenue_yoy}%。
      請根據這些數據提供 150 字內的深度審計評論，語氣需專業且精確，並指出風控關鍵點。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { systemInstruction: "你是一位頂尖的量化對沖基金審計師，專精於台股價值與動能分析。" }
      });
      setAiReport(response.text || "生成失敗。");
    } catch (err: any) {
      setAiReport(`審計失敗: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] p-4">
      <div className="w-full max-w-[360px] bg-white p-10 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl border border-slate-100">
        <h1 className="text-3xl font-black text-center mb-10 text-slate-950 uppercase tracking-tighter italic">Alpha Ledger.</h1>
        <form onSubmit={handleAuth} className="space-y-6">
          <input type="email" placeholder="Email" required className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-1 focus:ring-slate-950 transition-all outline-none" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-1 focus:ring-slate-950 transition-all outline-none" value={password} onChange={e => setPassword(e.target.value)} />
          {authError && <p className="text-rose-500 text-[10px] font-bold text-center uppercase tracking-wider">{authError}</p>}
          <button type="submit" disabled={authLoading} className="w-full py-4.5 bg-slate-950 text-white font-black text-xs uppercase tracking-[0.3em] rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50">Authenticate</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-950 selection:bg-emerald-100">
      <nav className="sticky top-0 z-50 bg-white/80 border-b border-slate-100 px-8 py-5 flex justify-between items-center backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-slate-900" />
          <h1 className="text-lg font-black italic tracking-tighter uppercase">Taiwan Alpha Ledger.</h1>
        </div>
        <button onClick={() => signOut().then(() => setSession(null))} className="text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors">Terminate</button>
      </nav>

      <main className="max-w-[1000px] mx-auto px-6 py-12">
        <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <div className="lg:col-span-2 bg-white p-10 border border-slate-100 shadow-sm relative overflow-hidden rounded-2xl group transition-all hover:shadow-md">
            <div className="absolute -top-10 -right-10 opacity-[0.02] group-hover:scale-110 transition-transform duration-700"><Trophy size={200} /></div>
            {state.data[0] ? (
              <div className="relative z-10">
                <span className="bg-slate-950 text-white text-[9px] font-black uppercase px-3 py-1 tracking-[0.2em] rounded-full">Top Strategic Selection</span>
                <h2 className="text-6xl font-black italic tracking-tighter uppercase my-8 text-slate-950 leading-none">{state.data[0].stock_name}</h2>
                <div className="flex gap-12 mb-10">
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">AI Predator Score</p><p className="text-4xl font-black text-emerald-500">{state.data[0].ai_score}</p></div>
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">ROE Matrix</p><p className="text-4xl font-black text-slate-900">{state.data[0].roe}%</p></div>
                </div>
                <button onClick={() => setSelectedStock(state.data[0])} className="bg-slate-950 text-white px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-emerald-600 transition-all rounded-xl flex items-center gap-3 shadow-xl active:scale-95">深度資產審計 <ArrowRight size={16} /></button>
              </div>
            ) : <div className="py-20 text-center text-slate-300">Syncing Alpha Data...</div>}
          </div>
          <div className="bg-slate-900 p-8 rounded-2xl flex flex-col justify-between text-white shadow-xl">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-2"><Globe size={14}/> Market Intel</h3>
              <p className="text-sm font-medium leading-relaxed italic text-slate-200 opacity-90 border-l-2 border-emerald-500 pl-4 py-1">
                "{state.data.find(d => d.stock_code === 'MARKET_BRIEF')?.ai_comment?.substring(0, 180) || '市場量化分析中，建議優先關注 2.0x ATR 風控價位執行紀律。'}"
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-white/5 text-[9px] font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Premium AI Audit Active
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-10 border-b border-slate-100">
          <div className="flex gap-10">
            <button onClick={() => setActiveView('daily')} className={`text-[11px] font-black uppercase tracking-[0.2em] pb-5 relative transition-colors ${activeView === 'daily' ? 'text-slate-950' : 'text-slate-300'}`}>
              Market Scan
              {activeView === 'daily' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-slate-950 rounded-full"></div>}
            </button>
            <button onClick={() => setActiveView('portfolio')} className={`text-[11px] font-black uppercase tracking-[0.2em] pb-5 relative transition-colors ${activeView === 'portfolio' ? 'text-slate-950' : 'text-slate-300'}`}>
              Vault 庫藏 ({state.portfolio.length})
              {activeView === 'portfolio' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-slate-950 rounded-full"></div>}
            </button>
          </div>
          {activeView === 'portfolio' && (
            <button className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
              <Plus size={14} /> Log Asset
            </button>
          )}
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {viewData.length > 0 ? (
            viewData.map((stock) => (
              <ActionCard 
                key={stock.id || stock.stock_code} 
                stock={stock} 
                isPortfolio={activeView === 'portfolio'}
                returnPercent={activeView === 'portfolio' ? ((stock.close_price - (stock.buy_price || 0)) / (stock.buy_price || 1)) * 100 : 0}
                onSelect={() => setSelectedStock(stock)} 
              />
            ))
          ) : (
            <div className="py-32 text-center border border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No Strategic Data Available</p>
            </div>
          )}
        </div>
      </main>

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/20 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-white p-10 relative shadow-2xl rounded-3xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-8 right-8 p-2.5 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            <div className="mb-10 text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Proprietary Audit Report</span>
              <h3 className="text-3xl font-black italic tracking-tighter uppercase mt-2">Audit Insight.</h3>
            </div>
            {isAiLoading ? (
              <div className="flex flex-col items-center py-20 gap-4">
                <Loader2 size={32} className="animate-spin text-slate-200" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Generating Audit...</p>
              </div>
            ) : (
              <div className="serif-text text-lg italic leading-relaxed text-slate-700 bg-slate-50 p-8 rounded-2xl border border-slate-100">
                {aiReport}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedStock && <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} onRunAi={handleAiInsight} />}
    </div>
  );
};

export default App;
