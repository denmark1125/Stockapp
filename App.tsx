
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Zap, LayoutGrid, Briefcase, Loader2, Target, Crown, LogOut, Flame, Rocket, Gem, Sparkles, Clock, Plus, Search, Terminal, FileText, BarChart3, ShieldAlert, ChevronRight
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, supabase, signOut, addToPortfolio, removeFromPortfolio } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { MarketBriefing } from './components/MarketBriefing';
import { StockDetailModal } from './components/StockDetailModal';
import { GlobalAiReportModal } from './components/GlobalAiReportModal';
import { GoogleGenAI } from "@google/genai";
import { format } from 'date-fns';

type StrategyMode = 'short' | 'long';
type ViewMode = 'elite' | 'portfolio' | 'full';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [state, setState] = useState<DashboardState>({
    data: [], portfolio: [], loading: true, error: null, lastUpdated: null
  });

  const [activeView, setActiveView] = useState<ViewMode>('elite');
  const [strategy, setStrategy] = useState<StrategyMode>('short'); 
  const [filterTag, setFilterTag] = useState<string>('ALL');
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);
  const [stockAiReport, setStockAiReport] = useState<{text: string, links: {title: string, uri: string}[]} | null>(null);
  const [isStockAiLoading, setIsStockAiLoading] = useState(false);
  
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 全局情報報告狀態
  const [isGlobalReportOpen, setIsGlobalReportOpen] = useState(false);
  const [globalReportType, setGlobalReportType] = useState<'daily' | 'weekly'>('daily');

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
      setState({ 
        data: marketData, portfolio: portfolioData, loading: false, error: null, 
        lastUpdated: new Date()
      });
    } catch (err: any) { 
      setState(prev => ({ ...prev, loading: false, error: err.message })); 
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const processedData = useMemo(() => {
    const allDates = state.data.map(s => s.analysis_date);
    const latestDate = allDates.length > 0 ? [...new Set(allDates)].sort().reverse()[0] : null;
    const latestData = latestDate ? state.data.filter(s => s.analysis_date === latestDate) : [];
    const marketBrief = latestData.find(s => s.stock_code === 'MARKET_BRIEF') || null;
    const latestStocks = latestData.filter(s => s.stock_code !== 'MARKET_BRIEF');

    const getScore = (s: DailyAnalysis) => strategy === 'short' ? (Number(s.score_short) || 0) : (Number(s.score_long) || 0);

    let filteredByStrategy = latestStocks.filter(s => {
      const volRatio = Number(s.vol_ratio) || 0;
      const volatility = Number(s.volatility) || 0;
      const sScore = Number(s.score_short) || 0;
      const lScore = Number(s.score_long) || 0;
      const momentumBias = (volatility > 3.5 ? 10 : 0) + (volRatio > 1.5 ? 10 : 0);
      const shortWeight = sScore + (volRatio * 5) + (volatility * 2) + momentumBias;
      const longWeight = lScore + (Number(s.roe || 0) / 2);
      return strategy === 'short' ? shortWeight >= longWeight : longWeight > shortWeight;
    });

    let baseList = [...filteredByStrategy].sort((a, b) => getScore(b) - getScore(a));
    
    const filteredByTag = (list: DailyAnalysis[]) => {
      if (filterTag === 'ALL') return list;
      return list.filter(s => {
        if (filterTag === 'VOL_BURST') return (s.vol_ratio || 0) > 2.5;
        if (filterTag === 'ROE_STAR') return (s.roe || 0) > 18;
        if (filterTag === 'MOMENTUM') return (s.volatility || 0) > 4.5;
        if (filterTag === 'VALUE_GEM') return (s.score_long || 0) > 85 && (s.pe_ratio || 0) < 16;
        return true;
      });
    };

    const portfolioList = state.portfolio.map(p => {
      const mkt = latestStocks.find(q => q.stock_code === p.stock_code);
      const currentPrice = mkt ? Number(mkt.close_price) : Number(p.buy_price);
      const profitLossRatio = ((currentPrice - p.buy_price) / p.buy_price) * 100;
      return {
        ...(mkt || { 
          id: p.id, stock_code: p.stock_code, stock_name: p.stock_name, 
          close_price: p.buy_price, analysis_date: 'N/A', trade_signal: 'HOLD',
          ai_score: 0, score_short: 0, score_long: 0, roe: null, revenue_yoy: null, pe_ratio: null
        }),
        buy_price: Number(p.buy_price),
        close_price: currentPrice,
        quantity: p.quantity,
        profit_loss_ratio: profitLossRatio,
        is_holding_item: true
      } as DailyAnalysis;
    });

    const searchResults = searchQuery.length > 0 
      ? latestStocks.filter(s => 
          (s.stock_name.includes(searchQuery) || s.stock_code.includes(searchQuery)) &&
          !state.portfolio.some(p => p.stock_code === s.stock_code)
        ).slice(0, 5)
      : [];

    return { 
      marketBrief,
      eliteList: filteredByTag(baseList.slice(0, 15)),
      fullList: filteredByTag(baseList),
      portfolioList,
      latestDate,
      isCurrent: latestDate === format(new Date(), 'yyyy-MM-dd'),
      searchResults
    };
  }, [state.data, state.portfolio, strategy, filterTag, searchQuery]);

  const handleTogglePortfolio = async (stock: DailyAnalysis, buyPrice?: number, quantity?: number) => {
    try {
      if (stock.is_holding_item) {
        await removeFromPortfolio(stock.stock_code);
      } else {
        if (buyPrice === undefined || quantity === undefined) return;
        await addToPortfolio(stock, buyPrice, quantity);
      }
      await loadData();
    } catch (e) { console.error(e); }
  };

  const handleRunStockAi = async (stock: DailyAnalysis) => {
    setIsStockAiLoading(true);
    setStockAiReport(null);
    try {
      /* Create a new GoogleGenAI instance with the API key from environment variables */
     const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (window as any).process?.env?.API_KEY;

     if (!apiKey) {
      console.error("❌ 缺少 Gemini API Key，請檢查環境變數設定");
      setStockAiReport({ text: "⚠️ 系統錯誤：缺少 AI 金鑰 (API Key missing)。", links: [] });
      setIsStockAiLoading(false);
      return;
     }

     const ai = new GoogleGenAI({ apiKey });
      const prompt = `你是 Alpha Ledger 首席金融情報員。請針對股票：${stock.stock_name}(${stock.stock_code}) 進行深度聯網偵查。包含今日小道消息與操作建議。現價 ${stock.close_price}。`;
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: prompt,
        config: { tools: [{googleSearch: {}}] }
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = chunks.map((c: any) => c.web).filter(Boolean).map((w: any) => ({ title: w.title, uri: w.uri }));
      setStockAiReport({ text: response.text || "...", links });
    } catch (e) { setStockAiReport({ text: "⚠️ 聯網失敗。", links: [] }); }
    finally { setIsStockAiLoading(false); }
  };

  const openGlobalReport = (type: 'daily' | 'weekly') => {
    setGlobalReportType(type);
    setIsGlobalReportOpen(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("驗證失敗");
    setAuthLoading(false);
  };

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <div className="w-full max-w-[340px] bg-[#0F0F0F] p-8 rounded-[2rem] border border-white/5 text-center shadow-2xl relative overflow-hidden">
        <div className="bg-rose-600 w-10 h-10 rounded-xl flex items-center justify-center text-white mx-auto mb-6"><Zap size={20} fill="currentColor" /></div>
        <h1 className="text-white text-xl font-black italic tracking-tighter uppercase mb-8">Alpha Ledger.</h1>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="分析員 ID" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-rose-500 text-sm" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="安全金鑰" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-rose-500 text-sm" />
          <button type="submit" disabled={authLoading} className="w-full bg-white text-black font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-rose-600 hover:text-white transition-all">
            {authLoading ? '驗證中...' : '進入終端'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F7F6] pb-24 lg:pb-8">
      <nav className="hidden lg:flex sticky top-0 z-[100] bg-white border-b border-slate-200 px-6 py-3 justify-between items-center backdrop-blur-md bg-opacity-95 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-1.5 rounded-lg text-white"><Zap size={14} fill="currentColor" /></div>
          <h1 className="text-lg font-black italic tracking-tighter uppercase">Alpha Ledger.</h1>
        </div>
        <div className="flex items-center gap-6">
           {[
             { id: 'elite', label: '精英雷達', icon: Target },
             { id: 'full', label: '全市場清單', icon: LayoutGrid },
             { id: 'portfolio', label: '資產金庫', icon: Briefcase }
           ].map((v) => (
             <button key={v.id} onClick={() => setActiveView(v.id as ViewMode)} className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${activeView === v.id ? 'text-slate-950 border-b-2 border-slate-950 pb-0.5' : 'text-slate-300 hover:text-slate-500'}`}>
               <v.icon size={12} /> {v.label}
             </button>
           ))}
           <div className="h-4 w-px bg-slate-200 ml-2"></div>
           <button onClick={() => openGlobalReport('daily')} className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse hover:bg-rose-700 transition-colors">
             <Terminal size={12} /> ALPHA INTEL
           </button>
           <button onClick={() => signOut()} className="text-slate-300 hover:text-rose-600 transition-colors"><LogOut size={14}/></button>
        </div>
      </nav>

      <main className="max-w-[1000px] mx-auto px-4 lg:px-6 py-4 lg:py-6">
        <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} dataDate={processedData.latestDate} isCurrent={processedData.isCurrent} />
        
        {/* 全局情報區入口 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
           <button onClick={() => openGlobalReport('daily')} className="bg-slate-950 p-6 rounded-[2rem] text-white flex items-center justify-between group hover:ring-4 ring-rose-500/20 transition-all border border-white/5 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500 blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative z-10 flex items-center gap-4">
                 <div className="bg-rose-600 p-3 rounded-2xl shadow-lg shadow-rose-900/20"><Zap size={20} /></div>
                 <div className="text-left">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-rose-500 block mb-0.5">INTEL CENTER</span>
                    <h2 className="text-lg font-black italic tracking-tighter uppercase">生成今日獲利日報</h2>
                 </div>
              </div>
              <ChevronRight size={24} className="opacity-30 group-hover:translate-x-1 transition-transform" />
           </button>
           <button onClick={() => openGlobalReport('weekly')} className="bg-white p-6 rounded-[2rem] text-slate-950 flex items-center justify-between group hover:ring-4 ring-slate-200 transition-all border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex items-center gap-4">
                 <div className="bg-slate-100 p-3 rounded-2xl text-slate-950"><BarChart3 size={20} /></div>
                 <div className="text-left">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-0.5">STRATEGY DOSSIER</span>
                    <h2 className="text-lg font-black italic tracking-tighter uppercase">解密週度投資週報</h2>
                 </div>
              </div>
              <ChevronRight size={24} className="opacity-30 group-hover:translate-x-1 transition-transform" />
           </button>
        </div>

        {activeView !== 'portfolio' && <MarketBriefing brief={processedData.marketBrief} loading={state.loading} />}

        <div className="flex justify-center mb-6">
          <div className="bg-slate-200/50 p-1 rounded-2xl flex gap-1">
            <button onClick={() => setStrategy('short')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${strategy === 'short' ? 'bg-slate-950 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>⚡ 當沖特快</button>
            <button onClick={() => setStrategy('long')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${strategy === 'long' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>🌊 波段價值</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {activeView === 'portfolio' && (
            <>
              <div onClick={() => setIsManualAdding(!isManualAdding)} className="group relative rounded-[2rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-3 transition-all hover:bg-slate-50 hover:border-slate-300 cursor-pointer">
                <div className={`p-4 rounded-full ${isManualAdding ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}><Plus size={24} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">新增持股追蹤</span>
              </div>
              {isManualAdding && (
                <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-6 animate-in slide-in-from-top-4 duration-300">
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input autoFocus type="text" placeholder="搜尋股票代號或名稱..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/20" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  {processedData.searchResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {processedData.searchResults.map(s => (
                        <div key={s.id} onClick={() => { setSelectedStock(s); setIsManualAdding(false); setSearchQuery(''); }} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                          <div><span className="text-[9px] font-black text-slate-400 block">{s.stock_code}</span><span className="text-sm font-black text-slate-900">{s.stock_name}</span></div>
                          <div className="text-right"><span className="text-[9px] font-black text-slate-400 block uppercase">市價</span><span className="text-sm font-black mono-text">${s.close_price}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {activeView === 'elite' && processedData.eliteList.map(s => <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => setSelectedStock(s)} />)}
          {activeView === 'full' && processedData.fullList.map(s => <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => setSelectedStock(s)} />)}
          {activeView === 'portfolio' && processedData.portfolioList.map(s => <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => setSelectedStock(s)} />)}
        </div>
      </main>

      {selectedStock && <StockDetailModal stock={selectedStock} onClose={() => { setSelectedStock(null); setStockAiReport(null); }} onRunAi={() => handleRunStockAi(selectedStock)} onTogglePortfolio={handleTogglePortfolio} aiReport={stockAiReport} isAiLoading={isStockAiLoading} />}
      
      {isGlobalReportOpen && (
        <GlobalAiReportModal 
          type={globalReportType} 
          onClose={() => setIsGlobalReportOpen(false)} 
          portfolioStocks={state.portfolio.map(p => p.stock_name)}
        />
      )}
    </div>
  );
};

export default App;
