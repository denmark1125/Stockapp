
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Compass, Layout, Wallet, LogOut, Search, Plus, Zap, Cpu, ArrowUpRight, ChevronRight, Menu, X, Info
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
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [state, setState] = useState<DashboardState>({
    data: [], portfolio: [], loading: true, error: null, lastUpdated: null
  });

  const [activeView, setActiveView] = useState<ViewMode>('elite');
  const [strategy, setStrategy] = useState<StrategyMode>('long'); // 預設改為波段，更符合「穩健大錢」邏輯
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isGlobalReportOpen, setIsGlobalReportOpen] = useState(false);
  const [globalReportType, setGlobalReportType] = useState<'daily' | 'weekly'>('daily');

  const [stockAiReport, setStockAiReport] = useState<{text: string, links: {title: string, uri: string}[]} | null>(null);
  const [isStockAiLoading, setIsStockAiLoading] = useState(false);

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
    // 建立股票最新數據 Map
    const latestSnapshotMap = new Map<string, DailyAnalysis>();
    const scoreHistoryMap = new Map<string, number[]>();

    state.data.forEach(item => {
      if (!latestSnapshotMap.has(item.stock_code)) latestSnapshotMap.set(item.stock_code, item);
      if (!scoreHistoryMap.has(item.stock_code)) scoreHistoryMap.set(item.stock_code, []);
      const scores = scoreHistoryMap.get(item.stock_code);
      if (scores && scores.length < 5) scores.push(strategy === 'short' ? Number(item.score_short || 0) : Number(item.score_long || 0));
    });

    const allDates = [...new Set(state.data.map(s => s.analysis_date))].sort().reverse();
    const latestDate = allDates[0] || null;
    const latestData = latestDate ? state.data.filter(s => s.analysis_date === latestDate) : [];
    const marketBrief = latestData.find(s => s.stock_code === 'MARKET_BRIEF') || null;
    const latestStocks = latestData.filter(s => s.stock_code !== 'MARKET_BRIEF');

    // 核心選股權重演算法
    const getEliteScore = (s: DailyAnalysis) => {
      const history = scoreHistoryMap.get(s.stock_code) || [];
      const currentScore = strategy === 'short' ? (Number(s.score_short) || 0) : (Number(s.score_long) || 0);
      
      // 穩定度權重：如果是波段，歷史高分的穩定度佔 40%
      if (strategy === 'long' && history.length > 1) {
        const avgScore = history.reduce((a, b) => a + b, 0) / history.length;
        return (currentScore * 0.6) + (avgScore * 0.4);
      }
      return currentScore;
    };

    let baseList = [...latestStocks].sort((a, b) => getEliteScore(b) - getEliteScore(a));
    
    // 只保留真正精銳的標的 (分數需 > 70)
    const eliteList = baseList.filter(s => getEliteScore(s) >= 70).slice(0, 12);
    
    const portfolioList = state.portfolio.map(p => {
      const mkt = latestSnapshotMap.get(p.stock_code);
      const currentPrice = mkt ? Number(mkt.close_price) : Number(p.buy_price);
      return {
        ...(mkt || { 
          id: p.id, stock_code: p.stock_code, stock_name: p.stock_name, 
          close_price: p.buy_price, analysis_date: 'N/A', trade_signal: 'HOLD',
          ai_score: 0, score_short: 0, score_long: 0, roe: null, revenue_yoy: null, pe_ratio: null,
          vol_ratio: 1, volatility: 0
        }),
        buy_price: Number(p.buy_price),
        close_price: currentPrice,
        quantity: p.quantity,
        profit_loss_ratio: ((currentPrice - p.buy_price) / p.buy_price) * 100,
        is_holding_item: true,
      } as DailyAnalysis;
    });

    return { 
      marketBrief, 
      eliteList, 
      fullList: baseList, 
      portfolioList, 
      latestDate, 
      isCurrent: latestDate === format(new Date(), 'yyyy-MM-dd'),
      searchResults: searchQuery ? latestStocks.filter(s => s.stock_name.includes(searchQuery) || s.stock_code.includes(searchQuery)).slice(0, 5) : []
    };
  }, [state.data, state.portfolio, strategy, searchQuery]);

  const handleRunStockAi = async (stock: DailyAnalysis) => {
    setIsStockAiLoading(true);
    setStockAiReport(null);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const prompt = `你是 Alpha Ledger 首席交易員。針對股票：${stock.stock_name}(${stock.stock_code})，現價 ${stock.close_price}。這檔股票目前在我們的 Python 腳本中被評為 ${strategy === 'short' ? '當沖' : '波段'} 潛力股。請針對當前網路上的法人研究報告、PTT、以及主力動向進行解碼。請給出明確的「進場點」、「加碼點」與「終極停損點」。中文回答。`;
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: prompt,
        config: { tools: [{googleSearch: {}}] }
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = chunks.map((c: any) => c.web).filter(Boolean).map((w: any) => ({ title: w.title, uri: w.uri }));
      setStockAiReport({ text: response.text || "...", links });
    } catch (e) { setStockAiReport({ text: "⚠️ 情報解碼失敗。", links: [] }); }
    finally { setIsStockAiLoading(false); }
  };

  const handleTogglePortfolio = async (stock: DailyAnalysis, buyPrice?: number, quantity?: number) => {
    try {
      if (stock.is_holding_item) await removeFromPortfolio(stock.stock_code);
      else { if (buyPrice === undefined || quantity === undefined) return; await addToPortfolio(stock, buyPrice, quantity); }
      await loadData();
    } catch (e) { console.error(e); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("驗證失敗");
    setAuthLoading(false);
  };

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FCFBF9]">
      <div className="w-full max-w-[320px] text-center">
        <h1 className="serif-text text-3xl font-bold tracking-tight mb-2 text-[#1A1A1A]">Alpha Ledger</h1>
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] mb-10 font-bold">經理人決策系統</p>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Terminal ID</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="分析員代碼" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Access Key</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="安全金鑰" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
          </div>
          <button type="submit" disabled={authLoading} className="w-full bg-[#1A1A1A] text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all mt-4">
            {authLoading ? '驗證中...' : '進入指揮部'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#1A1A1A] pb-32">
      <nav className="hidden lg:flex sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="serif-text text-xl font-bold tracking-tighter">Alpha Ledger</h1>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex gap-8">
            {[
              { id: 'elite', label: '獲利雷達', icon: Compass },
              { id: 'full', label: '全市場審查', icon: Layout },
              { id: 'portfolio', label: '資產帳冊', icon: Wallet }
            ].map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id as ViewMode)} className={`flex items-center gap-2 text-[11px] font-bold transition-all ${activeView === v.id ? 'text-[#C83232]' : 'text-slate-400 hover:text-slate-600'}`}>
                <v.icon size={14} /> {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => setIsGlobalReportOpen(true)} className="bg-[#C83232] text-white px-5 py-2.5 rounded-full text-[10px] font-bold flex items-center gap-2 hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/10">
             <Cpu size={14} /> AI 深度獲利報告
           </button>
           <button onClick={() => signOut()} className="text-slate-400 hover:text-[#C83232] transition-colors"><LogOut size={16}/></button>
        </div>
      </nav>

      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[92%] max-w-[420px]">
        <div className="bg-[#1A1A1A] text-white rounded-[2rem] px-2 py-3 flex items-center justify-around shadow-2xl border border-white/5 backdrop-blur-lg bg-opacity-95">
          {[
            { id: 'elite', label: '雷達', icon: Compass },
            { id: 'full', label: '市場', icon: Layout },
            { id: 'portfolio', label: '帳冊', icon: Wallet }
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveView(item.id as ViewMode)} className={`flex-1 flex flex-col items-center gap-1 py-1 transition-all active:scale-90 ${activeView === item.id ? 'text-white' : 'text-slate-500'}`}>
              <item.icon size={22} strokeWidth={activeView === item.id ? 2.5 : 2} />
              <span className="text-[9px] font-bold tracking-tighter">{item.label}</span>
            </button>
          ))}
          <div className="w-px h-8 bg-white/10 mx-2"></div>
          <button onClick={() => { setGlobalReportType('daily'); setIsGlobalReportOpen(true); }} className="flex-1 flex flex-col items-center gap-1 text-[#C83232] active:scale-90">
            <Zap size={22} fill="currentColor" />
            <span className="text-[9px] font-bold tracking-tighter">AI 報告</span>
          </button>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-4 lg:px-8 py-6">
        <header className="mb-10 lg:flex items-end justify-between border-b border-slate-100 pb-8">
           <div>
              <h2 className="serif-text text-4xl lg:text-5xl font-bold tracking-tight mb-2">
                {activeView === 'elite' ? '精選雷達' : activeView === 'full' ? '市場審查' : '資產帳冊'}
              </h2>
              <p className="text-[11px] text-[#C83232] font-black uppercase tracking-[0.4em]">
                {activeView === 'elite' ? 'Elite Conviction List' : activeView === 'full' ? 'Comprehensive Audit' : 'Asset Management'}
              </p>
           </div>
           <div className="hidden lg:block">
              <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} dataDate={processedData.latestDate} isCurrent={processedData.isCurrent} />
           </div>
        </header>

        {activeView !== 'portfolio' && <MarketBriefing brief={processedData.marketBrief} loading={state.loading} />}

        <div className="flex gap-2 mb-10 bg-slate-100/50 p-1.5 rounded-2xl w-fit mx-auto lg:mx-0 border border-slate-100 shadow-inner">
          <button onClick={() => setStrategy('short')} className={`px-8 py-3 rounded-xl text-[11px] font-bold transition-all ${strategy === 'short' ? 'bg-[#C83232] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>當沖雷達</button>
          <button onClick={() => setStrategy('long')} className={`px-8 py-3 rounded-xl text-[11px] font-bold transition-all ${strategy === 'long' ? 'bg-[#1A1A1A] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>波段佈局</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeView === 'portfolio' && (
            <div onClick={() => setIsManualAdding(!isManualAdding)} className="group relative rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-3 transition-all hover:bg-white hover:border-[#1A1A1A] cursor-pointer h-full min-h-[220px]">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300 group-hover:text-[#1A1A1A] group-hover:bg-slate-100 transition-all shadow-sm"><Plus size={32} /></div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-[#1A1A1A]">登錄新資產</span>
            </div>
          )}

          {(activeView === 'elite' ? processedData.eliteList : activeView === 'full' ? processedData.fullList : processedData.portfolioList).map(s => (
            <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => { setSelectedStock(s); setStockAiReport(null); }} />
          ))}

          {activeView === 'elite' && processedData.eliteList.length === 0 && (
            <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-slate-100">
              <p className="serif-text text-2xl text-slate-300 italic mb-2">今日市場尚未捕捉到精銳標的</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">等待量能噴發或趨勢成形</p>
            </div>
          )}
        </div>
      </main>

      {isManualAdding && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="w-full max-w-md bg-white shadow-2xl rounded-[3rem] p-10 animate-in zoom-in duration-300 border border-slate-100">
            <div className="flex justify-between items-center mb-8">
               <div>
                <h3 className="serif-text text-2xl font-bold text-[#1A1A1A]">登錄資產</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Manual Audit Registration</p>
               </div>
               <button onClick={() => setIsManualAdding(false)} className="p-2 hover:bg-slate-50 rounded-full"><X size={24} className="text-slate-400" /></button>
            </div>
            <div className="relative mb-8">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input autoFocus type="text" placeholder="輸入標的代码或名稱..." className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-5 text-sm font-bold outline-none shadow-inner" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="space-y-3 max-h-[340px] overflow-y-auto scrollbar-hide">
              {processedData.searchResults.map(s => (
                <div key={s.id} onClick={() => { setSelectedStock(s); setIsManualAdding(false); setSearchQuery(''); }} className="flex items-center justify-between p-5 bg-white hover:bg-slate-50 rounded-2xl cursor-pointer transition-all border border-slate-100 hover:border-[#1A1A1A] group">
                  <div>
                    <span className="text-[10px] font-bold text-slate-300 block tracking-widest mb-0.5 group-hover:text-slate-400">{s.stock_code}</span>
                    <span className="text-lg font-bold text-[#1A1A1A]">{s.stock_name}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-[#1A1A1A] group-hover:text-white transition-all">
                    <ArrowUpRight size={18} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedStock && (
        <StockDetailModal 
          stock={selectedStock} 
          onClose={() => { setSelectedStock(null); setStockAiReport(null); }} 
          onRunAi={() => handleRunStockAi(selectedStock)} 
          onTogglePortfolio={handleTogglePortfolio} 
          aiReport={stockAiReport}
          isAiLoading={isStockAiLoading}
        />
      )}
      
      {isGlobalReportOpen && (
        <GlobalAiReportModal type={globalReportType} onClose={() => setIsGlobalReportOpen(false)} portfolioStocks={state.portfolio.map(p => p.stock_name)} />
      )}
    </div>
  );
};

export default App;
