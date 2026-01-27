import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw, X, ShieldAlert, CheckCircle2, ArrowRight, Loader2,
  Sparkles, Quote, Mail, Lock, BarChart3
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, addToPortfolio, deleteFromPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { GoogleGenAI } from "@google/genai";
import { format } from 'date-fns';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [state, setState] = useState<DashboardState>({
    data: [], portfolio: [], loading: true, error: null, lastUpdated: null, topPickCode: null,
  });

  const [activeView, setActiveView] = useState<'daily' | 'portfolio'>('daily');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHolding, setNewHolding] = useState({ code: '', name: '', price: '', qty: '' });
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const calculateTradeSignal = useCallback((stock: DailyAnalysis, isPortfolioItem = false, buyPrice?: number) => {
    const score = stock.ai_score ?? 0;
    const prevScore = stock.previous_ai_score ?? score;
    const roe = stock.roe ?? 0;
    const turnover = stock.turnover_value ?? 0;
    const revenueGrowth = stock.revenue_growth ?? 0;
    const isScoreDeclining = score < prevScore;
    
    if (isPortfolioItem && buyPrice) {
      const dropPercent = ((stock.close_price - buyPrice) / buyPrice) * 100;
      if ((dropPercent <= -5 && isScoreDeclining) || dropPercent <= -10) {
        return { 
          signal: "絕對止損 (EXIT)", 
          color: "rose" as const, 
          reason: `紀律警報：跌幅達 ${dropPercent.toFixed(1)}% 且 AI 動能轉弱。請立即執行紀律操作。`, 
          isAlert: true,
          trend: 'down' as const
        };
      }
    }

    if (score >= 85 && roe >= 12 && turnover > 50000000) {
      return { 
        signal: "強力買進", 
        color: "emerald" as const, 
        reason: `獲利卓越：ROE(${roe}%)且大戶資金(${(turnover/1000000).toFixed(0)}M)進場，數據支撐力極強。`, 
        isAlert: false,
        trend: 'up' as const
      };
    }

    if (revenueGrowth > 30) {
      return { 
        signal: "轉機黑馬", 
        color: "amber" as const, 
        reason: `營收爆發：雖 ROE 尚未轉正，但營收年增 ${revenueGrowth}% 展現強勁轉機，建議小量試單。`, 
        isAlert: false,
        trend: 'up' as const
      };
    }

    if (roe < 5 && revenueGrowth < 10 && score >= 70) {
      return { 
        signal: "虛漲警示", 
        color: "slate" as const, 
        reason: `數據疑雲：獲利不足卻出現高分。可能是短線技術炒作，嚴禁長期重倉。`, 
        isAlert: false,
        trend: 'down' as const
      };
    }

    if (score >= 70) {
      return { 
        signal: "偏多操作", 
        color: "emerald" as const, 
        reason: "基本面穩定，技術面維持強勢，順勢跟隨市場趨勢。", 
        isAlert: false,
        trend: isScoreDeclining ? 'stable' : 'up'
      };
    }

    return { 
      signal: "觀望建議", 
      color: "slate" as const, 
      reason: "動能不足或數據指標模糊，資金效率低，保持觀望。", 
      isAlert: false,
      trend: 'stable' as const
    };
  }, []);

  const handleAiInsight = async (stock: DailyAnalysis | DailyAnalysis[]) => {
    setIsAiLoading(true);
    setAiReport(null);
    setIsReportModalOpen(true);
    try {
      // 安全獲取 API Key
      const apiKey = (process as any)?.env?.API_KEY || (import.meta as any)?.env?.NEXT_PUBLIC_GEMINI_API;
      
      if (!apiKey) throw new Error("缺少 AI API Key 設定。");

      const ai = new GoogleGenAI({ apiKey });
      const today = new Date().toLocaleDateString('zh-TW');
      let prompt = "";

      if (Array.isArray(stock)) {
        const dataStr = stock.slice(0, 5).map(s => `${s.stock_name}(AI:${s.ai_score}, ROE:${s.roe}%, Rev:${s.revenue_growth}%)`).join(' | ');
        prompt = `你是華爾街最冷酷的量化解盤長。日期：${today}。今日掃描名單：${dataStr}。
        任務：
        1. 針對這份名單進行無情審計。
        2. 指出哪一支是「真金」轉機股，哪一支是數據虛漲的垃圾。
        3. 以毒舌、專業且精煉的口吻回答。繁體中文，300字內。`;
      } else {
        prompt = `你是嚴格的基本面審計師。標的：${stock.stock_name}。
        現狀數據：ROE ${stock.roe}%, 營收成長 ${stock.revenue_growth}%, AI 分數 ${stock.ai_score}。
        任務：
        1. 拆解矛盾：這間公司是真的生意變好，還是在玩數字遊戲？
        2. 若 ROE < 5% 必須點破其風險。
        3. 給出最後的操作指令：【進場】、【試單】或【逃命】。
        4. 語氣要像巴菲特一樣智慧且直白。繁體中文。`;
      }

      // 使用 Gemini 3 Pro 進行深度分析
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });
      
      setAiReport(response.text || "未能生成分析報告，請稍後再試。");
    } catch (err: any) {
      console.error(err);
      setAiReport(`分析失敗: ${err.message || '請確認環境變數配置'}`);
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
    const topPick = today.length > 0 ? today.reduce((prev, curr) => ((prev.ai_score ?? 0) > (curr.ai_score ?? 0) ? prev : curr)) : null;
    const portfolioDetails = state.portfolio.map(item => {
      const market = today.find(d => d.stock_code === item.stock_code);
      const quant = market ? calculateTradeSignal(market, true, item.buy_price) : null;
      return { ...item, currentPrice: market?.close_price || item.buy_price, returnPercent: market ? ((market.close_price - item.buy_price) / item.buy_price) * 100 : 0, quant, marketData: market };
    });
    return { topPick, portfolioDetails, alerts: portfolioDetails.filter(p => p.quant?.isAlert) };
  }, [state.data, state.portfolio, calculateTradeSignal]);

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#fcfcfc]">
      <div className="w-full max-w-[420px] bg-white p-10 border border-slate-100 shadow-2xl rounded-sm">
        <div className="mb-12 text-center lg:text-left">
          <div className="mono-text text-rose-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Security Protocol</div>
          <h1 className="text-4xl lg:text-5xl font-black italic tracking-tighter uppercase leading-[0.85] mb-2 text-slate-900">
            Executive<br />Protocol.
          </h1>
        </div>
        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="mono-text text-[9px] font-bold uppercase text-slate-400">Email Address</label>
            <div className="flex items-center gap-3 border-b border-slate-200 py-2 focus-within:border-slate-900 transition-all">
              <Mail size={16} className="text-slate-300" />
              <input type="email" required className="w-full bg-transparent outline-none font-bold text-slate-900" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mono-text text-[9px] font-bold uppercase text-slate-400">Security Key</label>
            <div className="flex items-center gap-3 border-b border-slate-200 py-2 focus-within:border-slate-900 transition-all">
              <Lock size={16} className="text-slate-300" />
              <input type="password" required className="w-full bg-transparent outline-none font-bold text-slate-900" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>
          {authError && <p className="text-rose-600 font-bold text-[10px] uppercase">{authError}</p>}
          <button type="submit" disabled={authLoading} className="w-full py-4 bg-slate-950 text-white font-black text-xs uppercase tracking-[0.3em] hover:bg-rose-600 transition-all shadow-lg active:scale-95">
            {authLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : (authMode === 'login' ? 'Authenticate' : 'Request Credentials')}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-950 font-['Space_Grotesk']">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100 px-6 lg:px-12 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BarChart3 size={20} className="text-slate-900" />
          <h1 className="text-lg font-black italic tracking-tighter uppercase leading-none">Quantum Pulse.</h1>
        </div>
        <button onClick={() => signOut()} className="mono-text text-[10px] font-bold uppercase text-slate-400 hover:text-rose-600 transition-colors">Logout</button>
      </nav>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <div className="lg:col-span-2 bg-white p-8 border border-slate-100 shadow-xl relative overflow-hidden rounded-lg">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-1 tracking-widest rounded-sm">Top Performance</span>
                <span className="mono-text text-[10px] uppercase text-slate-400 tracking-widest">{format(new Date(), 'yyyy / MM / dd')}</span>
              </div>
              <h2 className="text-4xl lg:text-7xl font-black italic tracking-tighter uppercase mb-8 leading-[0.9] text-slate-900 break-words">
                {decisionMatrix.topPick?.stock_name || 'SCANNING...'}
              </h2>
              <div className="flex gap-10 mb-10 border-t border-slate-50 pt-8">
                <div>
                  <div className="text-[9px] font-bold uppercase text-slate-400 mb-1 tracking-widest">ROE Efficiency</div>
                  <div className="text-3xl lg:text-5xl font-black text-slate-900">{decisionMatrix.topPick?.roe}%</div>
                </div>
                <div className="border-l border-slate-100 pl-10">
                  <div className="text-[9px] font-bold uppercase text-slate-400 mb-1 tracking-widest">AI Confidence</div>
                  <div className="text-3xl lg:text-5xl font-black text-emerald-600">{decisionMatrix.topPick?.ai_score}</div>
                </div>
              </div>
              <button onClick={() => decisionMatrix.topPick && handleAiInsight(decisionMatrix.topPick)} className="w-full lg:w-auto bg-slate-950 text-white px-8 py-4 text-[11px] font-black uppercase tracking-[0.3em] hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 rounded-sm shadow-md active:scale-95">
                Launch Auditor Report <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="bg-white p-8 border border-slate-100 shadow-xl flex flex-col justify-between rounded-lg">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 flex items-center gap-2">
                <ShieldAlert size={14} /> Risk Monitor
              </h3>
              <div className="space-y-6">
                {decisionMatrix.alerts.length > 0 ? (
                  decisionMatrix.alerts.map(a => (
                    <div key={a.id} className="flex items-center gap-4 border-b border-slate-50 pb-4">
                      <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse"></div>
                      <div className="text-xl font-black italic uppercase tracking-tighter text-slate-900 truncate">{a.stock_name}</div>
                      <div className="text-[9px] font-bold text-rose-600 uppercase ml-auto">EXIT</div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-4 py-4">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                    <div className="text-xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">System Secure</div>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => handleAiInsight(state.data)} className="w-full py-4 mt-8 border border-slate-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-900 hover:text-white transition-all rounded-sm">
              War-Room Summary
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 border-b border-slate-100 pb-4 gap-6">
          <div className="flex gap-10">
            <button onClick={() => setActiveView('daily')} className={`text-[11px] font-black uppercase tracking-widest pb-3 transition-all relative ${activeView === 'daily' ? 'text-slate-900' : 'text-slate-300'}`}>
              Market Signals
              {activeView === 'daily' && <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-950"></div>}
            </button>
            <button onClick={() => setActiveView('portfolio')} className={`text-[11px] font-black uppercase tracking-widest pb-3 transition-all relative ${activeView === 'portfolio' ? 'text-slate-900' : 'text-slate-300'}`}>
              Portfolio ({state.portfolio.length})
              {activeView === 'portfolio' && <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-950"></div>}
            </button>
          </div>
          <div className="flex items-center gap-4">
             {activeView === 'portfolio' && (
               <button onClick={() => setIsAddModalOpen(true)} className="px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors rounded-sm">Add Position</button>
             )}
             <button onClick={loadData} className="p-2.5 bg-white border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm rounded-sm transition-all active:rotate-180">
               <RefreshCw size={18} className={state.loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>

        <div className="space-y-1">
          {activeView === 'daily' ? (
            state.data.map(stock => {
              const quant = calculateTradeSignal(stock);
              return (
                <ActionCard key={stock.id} stock={stock} quant={quant} onSelect={() => handleAiInsight(stock)} />
              );
            })
          ) : (
            decisionMatrix.portfolioDetails.map(item => (
              <div key={item.id} className="relative group">
                <button onClick={(e) => { e.stopPropagation(); deleteFromPortfolio(item.id).then(loadData); }} className="absolute top-4 right-6 z-20 p-2 text-slate-200 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all">
                  <X size={18} />
                </button>
                {item.marketData ? (
                  <ActionCard stock={item.marketData} quant={item.quant!} isPortfolio buyPrice={item.buy_price} returnPercent={item.returnPercent} onSelect={() => handleAiInsight(item.marketData!)} />
                ) : (
                  <div className="p-10 bg-white border border-slate-50 text-slate-300 text-center font-bold text-xs uppercase tracking-widest rounded-lg">Syncing...</div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-xl">
          <div className="w-full max-w-3xl bg-white p-8 relative shadow-2xl overflow-y-auto max-h-[90vh] rounded-lg">
            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full transition-colors"><X size={24}/></button>
            <div className="mono-text text-rose-500 text-[10px] font-black uppercase mb-10 tracking-[0.4em] flex items-center gap-2">
               <Sparkles size={16}/> Auditor Intelligence Synthesis
            </div>
            {isAiLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={40} className="animate-spin text-slate-200" />
                <p className="mono-text text-[9px] uppercase font-black tracking-widest text-slate-300">Auditing Real-Time Vectors...</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none">
                <Quote size={32} className="text-slate-100 fill-slate-100 mb-8" />
                <div className="text-lg lg:text-xl font-medium italic text-slate-800 leading-relaxed whitespace-pre-wrap font-serif border-l-4 border-slate-950 pl-8">
                  {aiReport}
                </div>
                <div className="mt-12 pt-8 border-t border-slate-50 flex justify-end">
                   <button onClick={() => setIsReportModalOpen(false)} className="px-10 py-4 bg-slate-950 text-white font-black uppercase text-[11px] tracking-[0.3em] hover:bg-rose-600 transition-all rounded-sm shadow-md">Dismiss Intelligence</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/5 backdrop-blur-md">
          <div className="w-full max-w-md bg-white p-10 relative shadow-2xl rounded-lg">
             <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">New<br />Position.</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full"><X size={20}/></button>
             </div>
             <form onSubmit={async (e) => {
               e.preventDefault();
               await addToPortfolio(newHolding.code, newHolding.name, Number(newHolding.price), Number(newHolding.qty));
               setIsAddModalOpen(false);
               loadData();
             }} className="space-y-6">
                <div>
                  <label className="mono-text text-[8px] font-bold uppercase text-slate-400">Ticker Code</label>
                  <input type="text" placeholder="2330" className="w-full border-b border-slate-100 py-2 text-2xl font-black outline-none focus:border-slate-950 transition-colors" value={newHolding.code} onChange={e => setNewHolding({...newHolding, code: e.target.value})} />
                </div>
                <div>
                  <label className="mono-text text-[8px] font-bold uppercase text-slate-400">Company Name</label>
                  <input type="text" placeholder="TSMC" className="w-full border-b border-slate-100 py-2 text-2xl font-black outline-none focus:border-slate-950 transition-colors" value={newHolding.name} onChange={e => setNewHolding({...newHolding, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-10">
                    <div>
                      <label className="mono-text text-[8px] font-bold uppercase text-slate-400">Buy Price</label>
                      <input type="number" step="0.01" className="w-full border-b border-slate-100 py-2 text-2xl font-black outline-none focus:border-slate-950 transition-colors" value={newHolding.price} onChange={e => setNewHolding({...newHolding, price: e.target.value})} />
                    </div>
                    <div>
                      <label className="mono-text text-[8px] font-bold uppercase text-slate-400">Quantity</label>
                      <input type="number" className="w-full border-b border-slate-100 py-2 text-2xl font-black outline-none focus:border-slate-950 transition-colors" value={newHolding.qty} onChange={e => setNewHolding({...newHolding, qty: e.target.value})} />
                    </div>
                </div>
                <button type="submit" className="w-full py-5 bg-slate-950 text-white font-black uppercase tracking-[0.3em] hover:bg-emerald-600 transition-all shadow-lg rounded-sm mt-4">Confirm Position</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;