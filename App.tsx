
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw, X, Plus, ShieldAlert, CheckCircle2, ArrowRight, LogOut, Loader2,
  Sparkles, Quote, AlertTriangle, TrendingDown, Clock, BarChart3, Mail, Lock
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, addToPortfolio, deleteFromPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { GoogleGenAI } from "@google/genai";
import { format } from 'date-fns';

const App: React.FC = () => {
  // Auth 狀態
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // 應用狀態
  const [state, setState] = useState<DashboardState>({
    data: [], portfolio: [], loading: true, error: null, lastUpdated: null, topPickCode: null,
  });

  const [activeView, setActiveView] = useState<'daily' | 'portfolio'>('daily');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHolding, setNewHolding] = useState({ code: '', name: '', price: '', qty: '' });
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  /**
   * 股神級決策引擎 (The Brain)
   */
  const calculateTradeSignal = useCallback((stock: DailyAnalysis, isPortfolioItem = false, buyPrice?: number) => {
    const score = stock.ai_score ?? 0;
    const prevScore = stock.previous_ai_score ?? score;
    const roe = stock.roe ?? 0;
    const turnover = stock.turnover_value ?? 0;
    const revenueGrowth = stock.revenue_growth ?? 0;
    const isScoreDeclining = score < prevScore;
    
    // 1. 絕對止損 (Hard Exit) - 庫存保護機制
    if (isPortfolioItem && buyPrice) {
      const dropPercent = ((stock.close_price - buyPrice) / buyPrice) * 100;
      if (dropPercent <= -5 && isScoreDeclining) {
        return { 
          signal: "絕對止損 (EXIT)", 
          color: "rose" as const, 
          reason: `最後防線：跌幅達 ${dropPercent.toFixed(1)}% 且 AI 評分走弱。立即撤退，嚴防持續失血。`, 
          isAlert: true,
          trend: 'down' as const
        };
      }
    }

    // 2. 強力買進 (Strong Buy) - 獲利金三角
    if (score >= 85 && roe >= 12 && turnover > 50000000) {
      return { 
        signal: "強力買進", 
        color: "emerald" as const, 
        reason: `頂級標的：獲利卓越 (ROE ${roe}%) 且有大額資金 (${(turnover/1000000).toFixed(0)}M) 背書，動能極強。`, 
        isAlert: false,
        trend: (isScoreDeclining ? 'down' : 'up') as "up" | "down" | "stable"
      };
    }

    // 3. 轉機觀察 (Turnover Watch) - 捕捉黑馬
    if (roe <= 0 && revenueGrowth > 30) {
      return { 
        signal: "轉機觀察", 
        color: "amber" as const, 
        reason: `黑馬訊號：雖尚未獲利 (ROE ${roe}%)，但營收年增達 ${revenueGrowth}%。生意爆發中，可小量試單。`, 
        isAlert: false,
        trend: 'up' as const
      };
    }

    // 4. 投機警告 (Anomaly) - 防止炒作陷阱
    if (roe < 5 && score >= 70) {
      return { 
        signal: "投機警告", 
        color: "slate" as const, 
        reason: `獲利支撐不足 (ROE 僅 ${roe}%)。當前高分主要源於技術面，嚴禁重倉，謹防拉高出貨。`, 
        isAlert: false,
        trend: (isScoreDeclining ? 'down' : 'stable') as "up" | "down" | "stable"
      };
    }

    // 基本偏多
    if (score >= 70) {
      return { 
        signal: "偏多操作", 
        color: "emerald" as const, 
        reason: isScoreDeclining ? "技術面獲利了結壓力增加，觀察回測支撐。" : "營收支撐穩定，趨勢上行中。", 
        isAlert: false,
        trend: (isScoreDeclining ? 'down' : 'up') as "up" | "down" | "stable"
      };
    }

    return { 
      signal: "建議觀望", 
      color: "slate" as const, 
      reason: "指標尚不明確，耐心等待更好的進場點位。", 
      isAlert: false,
      trend: 'stable' as const
    };
  }, []);

  /**
   * 時效性標籤邏輯
   */
  const getMarketStatus = useCallback((updatedAt?: string) => {
    if (!updatedAt) return { label: "SCANNING", color: "bg-slate-300" };
    const date = new Date(updatedAt);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeValue = hour * 100 + minute;
    // 台灣股市盤中 9:00 - 13:30
    if (timeValue >= 900 && timeValue <= 1335) {
      return { label: "LIVE 盤中即時", color: "bg-emerald-500 animate-pulse" };
    }
    return { label: "SETTLED 收盤結算", color: "bg-blue-600" };
  }, []);

  /**
   * AI 首席分析官深度整合
   */
  const handleAiInsight = async (stock: DailyAnalysis | DailyAnalysis[]) => {
    setIsAiLoading(true);
    setAiReport(null);
    setIsReportModalOpen(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API });
      const today = new Date().toLocaleDateString('zh-TW');
      let prompt = "";

      if (Array.isArray(stock)) {
        const dataStr = stock.slice(0, 5).map(s => `${s.stock_name}(ROE:${s.roe}%, 營收成長:${s.revenue_growth}%, AI:${s.ai_score})`).join(', ');
        prompt = `你是首席分析師。日期：${today}。今日前五標的：${dataStr}。
        分析要求：
        1. 針對這五張標的進行「巴菲特式」的數據比對，特別分析「ROE 與 營收成長」是否存在矛盾。
        2. 揪出虛假繁榮：若標的營收噴發但 ROE 極低，必須揭穿其投機本質並嚴厲警告風險。
        3. 給出 CEO 級別的資金配置戰略。語氣直白、專業、具備洞察力。繁體中文。`;
      } else {
        prompt = `深度分析標的：「${stock.stock_name}」。ROE ${stock.roe}%，營收成長 ${stock.revenue_growth}%，AI 分數 ${stock.ai_score}。
        首席指令：
        1. 矛盾點分析：ROE 指標與營收成長是否匹配？這間公司是真的在賺錢還是在虛增規模？
        2. 風險決策：根據數據，這屬於「強力買進」、「黑馬試單」還是「投機陷阱」？
        3. 以直白、精煉、甚至帶點毒舌的巴菲特風格撰寫。繁體中文。`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });
      setAiReport(response.text);
    } catch (err) {
      setAiReport("分析引擎暫時無法連線。");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("註冊成功。");
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!session) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const [marketData, portfolioData] = await Promise.all([fetchDailyAnalysis(), fetchPortfolio()]);
      setState({ data: marketData, portfolio: portfolioData, loading: false, error: null, lastUpdated: new Date(), topPickCode: marketData[0]?.stock_code || null });
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const decisionMatrix = useMemo(() => {
    const today = state.data;
    const topPick = today.length > 0 ? today.reduce((prev, curr) => (prev.ai_score! > curr.ai_score!) ? prev : curr) : null;
    const portfolioDetails = state.portfolio.map(item => {
      const market = today.find(d => d.stock_code === item.stock_code);
      const quant = market ? calculateTradeSignal(market, true, item.buy_price) : null;
      return { ...item, currentPrice: market?.close_price || item.buy_price, returnPercent: market ? ((market.close_price - item.buy_price) / item.buy_price) * 100 : 0, quant, marketData: market };
    });
    return { topPick, portfolioDetails, alerts: portfolioDetails.filter(p => p.quant?.isAlert) };
  }, [state.data, state.portfolio, calculateTradeSignal]);

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#fcfcfc]">
      <div className="w-full max-w-[480px] bg-white p-12 lg:p-16 border border-slate-100 shadow-2xl rounded-sm">
        <div className="mb-14">
          <div className="mono-text text-rose-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Security Protocol</div>
          <h1 className="text-5xl lg:text-6xl font-black italic tracking-tighter uppercase leading-[0.85] mb-2 text-slate-900">
            Executive<br />Protocol.
          </h1>
        </div>
        <form onSubmit={handleAuth} className="space-y-8">
          <div className="relative group">
            <label className="mono-text text-[9px] font-bold uppercase text-slate-400 group-focus-within:text-slate-900 transition-colors">Email Address</label>
            <div className="flex items-center gap-3 border-b border-slate-200 py-2 group-focus-within:border-slate-900 transition-all">
              <Mail size={16} className="text-slate-300" />
              <input type="email" required className="w-full bg-transparent outline-none font-bold text-slate-900 placeholder:text-slate-200" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="relative group">
            <label className="mono-text text-[9px] font-bold uppercase text-slate-400 group-focus-within:text-slate-900 transition-colors">Password</label>
            <div className="flex items-center gap-3 border-b border-slate-200 py-2 group-focus-within:border-slate-900 transition-all">
              <Lock size={16} className="text-slate-300" />
              <input type="password" required className="w-full bg-transparent outline-none font-bold text-slate-900 placeholder:text-slate-200" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>
          {authError && <p className="text-rose-600 font-bold text-[10px] uppercase tracking-wider">{authError}</p>}
          <button type="submit" disabled={authLoading} className="w-full py-5 bg-slate-950 text-white font-black text-xs uppercase tracking-[0.3em] hover:bg-rose-600 transition-all shadow-lg">
            {authLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : (authMode === 'login' ? 'Authenticate' : 'Request Credentials')}
          </button>
        </form>
        <div className="mt-12 text-center border-t border-slate-50 pt-8">
          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="mono-text text-[10px] font-bold uppercase text-slate-400 hover:text-slate-900 tracking-widest transition-all">
            {authMode === 'login' ? "New Executive? Sign Up" : "Existing Member? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-950 selection:bg-slate-900 selection:text-white">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 lg:px-12 py-5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BarChart3 size={24} className="text-slate-900" />
          <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">Quantum Insight.</h1>
        </div>
        <button onClick={() => signOut()} className="mono-text text-[10px] font-bold uppercase text-slate-400 hover:text-rose-500 transition-colors">Logout</button>
      </nav>

      <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16 mb-24 lg:mb-32">
          <div className="lg:col-span-2 bg-white p-10 lg:p-14 border border-slate-100 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Sparkles size={160} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-1 tracking-widest">Priority Selection</span>
                <span className="mono-text text-[10px] uppercase text-slate-400 tracking-widest">{format(new Date(), 'yyyy / MM / dd')}</span>
              </div>
              <h2 className="text-6xl lg:text-8xl font-black italic tracking-tighter uppercase mb-10 leading-[0.85] text-slate-900 break-words">
                {decisionMatrix.topPick?.stock_name || 'Scanning...'}
              </h2>
              <div className="flex gap-12 mb-12 border-t border-slate-50 pt-10">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">ROE Efficiency</div>
                  <div className="text-4xl lg:text-5xl font-black text-slate-900">{decisionMatrix.topPick?.roe}%</div>
                </div>
                <div className="border-l border-slate-100 pl-12">
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">AI Confidence</div>
                  <div className="text-4xl lg:text-5xl font-black text-slate-900">{decisionMatrix.topPick?.ai_score}</div>
                </div>
              </div>
              <button onClick={() => decisionMatrix.topPick && handleAiInsight(decisionMatrix.topPick)} className="bg-slate-950 text-white px-10 py-5 text-xs font-black uppercase tracking-[0.3em] hover:bg-emerald-500 transition-all flex items-center gap-4">
                Launch Alpha Analysis <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="bg-white p-10 lg:p-14 border border-slate-100 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-300 mb-10 flex items-center gap-3">
                <ShieldAlert size={14} /> Risk Monitor
              </h3>
              <div className="space-y-8">
                {decisionMatrix.alerts.length > 0 ? (
                  decisionMatrix.alerts.map(a => (
                    <div key={a.id} className="flex items-center gap-4 border-b border-slate-50 pb-4">
                      <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse"></div>
                      <div className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 truncate">{a.stock_name}</div>
                      <div className="text-[9px] font-bold text-rose-600 uppercase ml-auto">🚨 Hard Exit</div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-6 py-6">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                    <div className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Status: Secure</div>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => handleAiInsight(state.data)} className="w-full py-4 mt-12 border border-slate-900 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-900 hover:text-white transition-all">
              Market War-Room Summary
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-16 border-b border-slate-100 pb-10 gap-8">
          <div className="flex gap-12">
            <button onClick={() => setActiveView('daily')} className={`text-sm font-black uppercase tracking-widest pb-4 transition-all relative ${activeView === 'daily' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}>
              Signals
              {activeView === 'daily' && <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-950"></div>}
            </button>
            <button onClick={() => setActiveView('portfolio')} className={`text-sm font-black uppercase tracking-widest pb-4 transition-all relative ${activeView === 'portfolio' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}>
              Portfolio ({state.portfolio.length})
              {activeView === 'portfolio' && <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-950"></div>}
            </button>
          </div>
          <div className="flex items-center gap-6">
             {activeView === 'portfolio' && (
               <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-colors">Add Position</button>
             )}
             <button onClick={loadData} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-all">
               <RefreshCw size={20} className={state.loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {activeView === 'daily' ? (
            state.data.map(stock => {
              const quant = calculateTradeSignal(stock);
              const status = getMarketStatus(stock.updated_at);
              return (
                <div key={stock.id} className="relative">
                   <div className={`absolute top-4 left-8 z-10 flex items-center gap-2 px-2 py-1 ${status.color} text-white text-[8px] font-black uppercase rounded-sm shadow-sm`}>
                     <Clock size={8} /> {status.label}
                   </div>
                   <ActionCard stock={stock} quant={quant} onSelect={() => handleAiInsight(stock)} />
                </div>
              );
            })
          ) : (
            decisionMatrix.portfolioDetails.map(item => (
              <div key={item.id} className="relative group">
                <button onClick={(e) => { e.stopPropagation(); deleteFromPortfolio(item.id).then(loadData); }} className="absolute top-6 right-8 z-20 p-2 text-slate-200 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all">
                  <X size={20} />
                </button>
                {item.marketData ? (
                  <ActionCard stock={item.marketData} quant={item.quant!} isPortfolio buyPrice={item.buy_price} returnPercent={item.returnPercent} onSelect={() => handleAiInsight(item.marketData!)} />
                ) : (
                  <div className="p-10 bg-white border border-slate-50 text-slate-300 text-center font-bold text-xs uppercase tracking-widest rounded-sm">Syncing Asset: {item.stock_name}...</div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* AI Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 bg-slate-900/10 backdrop-blur-3xl">
          <div className="w-full max-w-4xl bg-white p-10 lg:p-20 relative shadow-2xl overflow-y-auto max-h-[90vh] rounded-sm">
            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-8 right-8 p-3 hover:bg-slate-50 rounded-full transition-colors"><X size={24}/></button>
            <div className="mono-text text-rose-500 text-[10px] font-black uppercase mb-12 tracking-[0.4em] flex items-center gap-3">
               <Sparkles size={16}/> Alpha Analysis Report
            </div>
            {isAiLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-6">
                <Loader2 size={48} className="animate-spin text-slate-100" />
                <p className="mono-text text-[9px] uppercase font-black tracking-widest text-slate-300">Synthesizing Alpha Intelligence...</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none">
                <Quote size={40} className="text-slate-50 fill-slate-50 mb-8" />
                <div className="text-xl lg:text-2xl font-medium italic text-slate-800 leading-relaxed whitespace-pre-wrap font-serif">
                  {aiReport}
                </div>
                <div className="mt-16 border-t border-slate-50 pt-10 flex justify-end">
                   <button onClick={() => setIsReportModalOpen(false)} className="px-10 py-5 bg-slate-950 text-white font-black uppercase text-[10px] tracking-[0.3em] hover:bg-rose-600 transition-all">Dismiss Report</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/5 backdrop-blur-md">
          <div className="w-full max-w-md bg-white p-12 lg:p-16 relative shadow-2xl rounded-sm">
             <div className="flex justify-between items-center mb-12">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">New<br />Asset.</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full"><X size={24}/></button>
             </div>
             <form onSubmit={async (e) => {
               e.preventDefault();
               await addToPortfolio(newHolding.code, newHolding.name, Number(newHolding.price), Number(newHolding.qty));
               setIsAddModalOpen(false);
               loadData();
             }} className="space-y-8">
                <div className="group">
                  <label className="mono-text text-[9px] font-bold uppercase text-slate-400 group-focus-within:text-slate-900">Ticker Code</label>
                  <input type="text" placeholder="2330" className="w-full border-b border-slate-100 py-3 text-2xl font-black outline-none placeholder:text-slate-100 focus:border-slate-950 transition-colors" value={newHolding.code} onChange={e => setNewHolding({...newHolding, code: e.target.value})} />
                </div>
                <div className="group">
                  <label className="mono-text text-[9px] font-bold uppercase text-slate-400 group-focus-within:text-slate-900">Company Name</label>
                  <input type="text" placeholder="TSMC" className="w-full border-b border-slate-100 py-3 text-2xl font-black outline-none placeholder:text-slate-100 focus:border-slate-950 transition-colors" value={newHolding.name} onChange={e => setNewHolding({...newHolding, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-10">
                    <div className="group">
                      <label className="mono-text text-[9px] font-bold uppercase text-slate-400 group-focus-within:text-slate-900">Cost</label>
                      <input type="number" placeholder="0" className="w-full border-b border-slate-100 py-3 text-2xl font-black outline-none placeholder:text-slate-100 focus:border-slate-950 transition-colors" value={newHolding.price} onChange={e => setNewHolding({...newHolding, price: e.target.value})} />
                    </div>
                    <div className="group">
                      <label className="mono-text text-[9px] font-bold uppercase text-slate-400 group-focus-within:text-slate-900">Qty</label>
                      <input type="number" placeholder="0" className="w-full border-b border-slate-100 py-3 text-2xl font-black outline-none placeholder:text-slate-100 focus:border-slate-950 transition-colors" value={newHolding.qty} onChange={e => setNewHolding({...newHolding, qty: e.target.value})} />
                    </div>
                </div>
                <button type="submit" className="w-full py-6 bg-slate-950 text-white font-black uppercase tracking-[0.3em] hover:bg-emerald-500 transition-all shadow-lg mt-4">Authorize Position</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
