
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  RefreshCw, X, ShieldAlert, ArrowRight, Loader2,
  Sparkles, Quote, BookOpen, Target, Globe, PieChart, Activity, FileText,
  Trophy, Star
} from 'lucide-react';
import { DashboardState, DailyAnalysis, TradeSignal } from './types';
import { fetchDailyAnalysis, fetchPortfolio, addToPortfolio, deleteFromPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { StockDetailModal } from './components/StockDetailModal';
import { GoogleGenAI } from "@google/genai";
import { format, isAfter, isValid, isBefore, addHours } from 'date-fns';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
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
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);

  const timeoutRef = useRef<any>(null);

  const handleLogout = useCallback(async () => {
    await signOut();
    setSession(null);
    localStorage.removeItem('supabase.auth.token');
    alert('系統已自動登出。');
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (session) {
      timeoutRef.current = setTimeout(handleLogout, 5 * 60 * 1000);
    }
  }, [session, handleLogout]);

  useEffect(() => {
    if (!session) return;
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [session, resetTimer]);

  const fetchStockName = async (code: string) => {
    if (code.length < 4) return;
    try {
      const formattedCode = code.toUpperCase().includes('.TW') ? code.toUpperCase() : `${code.toUpperCase()}.TW`;
      const { data } = await supabase
        .from('daily_analysis')
        .select('stock_name')
        .eq('stock_code', formattedCode)
        .limit(1)
        .maybeSingle();

      if (data && data.stock_name) {
        setNewHolding(prev => ({ ...prev, name: data.stock_name }));
      }
    } catch (err) {
      console.error("查無此股號");
    }
  };

  const calculateTradeSignal = useCallback((stock: DailyAnalysis, isPortfolioItem = false, buyPrice?: number): TradeSignal => {
    const score = stock.ai_score ?? 0;
    
    // 與 Python 腳本邏輯對齊
    if (stock.trade_signal === 'TRADE_BUY' || score >= 85) {
      return { 
        signal: "多頭進場 BUY", color: "emerald", 
        reason: stock.ai_comment || "動能強勁且具備安全邊際，符合進場條件。", 
        isAlert: false, trend: 'up', tags: ["高確信", "動能噴發"]
      };
    } else if (stock.trade_signal === 'TRADE_WATCH' || score >= 75) {
       return { 
        signal: "持續觀察 WATCH", color: "amber", 
        reason: "結構轉強但未達買入門檻，建議放入追蹤名單。", 
        isAlert: false, trend: 'stable', tags: ["待觀察", "結構改善"]
      };
    }

    return { 
      signal: "暫避風險 AVOID", color: "slate", 
      reason: "目前評分偏低，建議觀望等待更好的交易結構。", 
      isAlert: false, trend: 'stable', tags: []
    };
  }, []);

  const handleAiInsight = async (stock: DailyAnalysis | DailyAnalysis[]) => {
    setIsAiLoading(true);
    setAiReport(null);
    setIsReportModalOpen(true);
    try {
      const apiKey = import.meta.env.NEXT_PUBLIC_GEMINI_API || import.meta.env.VITE_GEMINI_API_KEY;

      // 🔥【關鍵修正 2】防呆檢查
      if (!apiKey) {
        throw new Error("未偵測到 API 金鑰，請檢查 .env 檔案或 GitHub Secrets 設定");
      }

      // 🔥【關鍵修正 3】初始化 AI (使用您引入的 @google/genai 新版 SDK)
      const ai = new GoogleGenAI({ apiKey });
      const today = format(new Date(), 'yyyy年MM月dd日 HH:mm');
      let prompt = "";
      let systemInstruction = "你是台股價值投資審計大師，語氣精煉且富有巴菲特的智慧。請直接給出結論，拒絕廢話。";

      if (Array.isArray(stock)) {
        const dataStr = stock.slice(0, 10).map(s => `[${s.stock_name} | AI:${s.ai_score} | 停損:${s.trade_stop}]`).join('\n');
        prompt = `當前時間：${today}。分析 AI 優選名單：\n${dataStr}\n請針對這些標的給出風控建議與宏觀判斷。`;
      } else {
        prompt = `當前時間：${today}。標的：${stock.stock_name}。AI分數 ${stock.ai_score}，停損價 ${stock.trade_stop}，獲利價 ${stock.trade_tp1}。請點評其風險回報比。`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { systemInstruction }
      });
      setAiReport(response.text || "生成失敗。");
    } catch (err: any) {
      setAiReport(`審計失敗: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

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
      
      const now = new Date();
      // 容許 1 小時的時間誤差（伺服器與本地時差）
      const safetyBuffer = addHours(now, 1);
      
      let latestDate = new Date(0);
      
      marketData.forEach(item => {
        const d = new Date(item.updated_at);
        // 關鍵：必須是有效日期，比目前紀錄晚，且「不可晚於現在（排除未來異常數據）」
        if (isValid(d) && isAfter(d, latestDate) && isBefore(d, safetyBuffer)) {
          latestDate = d;
        }
      });
      
      // 如果完全沒找到有效時間，則使用當前時間作為 fallback
      const finalUpdateDate = isValid(latestDate) && latestDate.getTime() !== 0 ? latestDate : now;
      
      setState({ 
        data: marketData, 
        portfolio: portfolioData, 
        loading: false, 
        error: null, 
        lastUpdated: finalUpdateDate, 
        topPickCode: marketData[0]?.stock_code || null 
      });
    } catch (err: any) { 
      setState(prev => ({ ...prev, loading: false, error: err.message })); 
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const decisionMatrix = useMemo(() => {
    const eliteData = [...state.data].filter(s => (s.ai_score || 0) >= 70).sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));
    const topPick = eliteData[0] || null;
    const portfolioDetails = state.portfolio.map(item => {
      const market = state.data.find(d => d.stock_code === item.stock_code);
      const quant = market ? calculateTradeSignal(market, true, item.buy_price) : null;
      return { ...item, currentPrice: market?.close_price || item.buy_price, returnPercent: market ? ((market.close_price - item.buy_price) / item.buy_price) * 100 : 0, quant, marketData: market };
    });
    return { eliteData, topPick, portfolioDetails };
  }, [state.data, state.portfolio, calculateTradeSignal]);

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] p-4">
      <div className="w-full max-w-[360px] bg-white p-8 border border-slate-200 shadow-xl rounded-sm">
        <h1 className="text-4xl font-black italic text-center mb-10 text-slate-950 uppercase">Alpha Ledger.</h1>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setAuthLoading(true);
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) setAuthError(error.message);
          setAuthLoading(false);
        }} className="space-y-6">
          <input type="email" placeholder="Executive ID" required className="w-full border-b-2 border-slate-100 py-3 text-sm outline-none focus:border-slate-950 font-bold" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Passkey" required className="w-full border-b-2 border-slate-100 py-3 text-sm outline-none focus:border-slate-950 font-bold" value={password} onChange={e => setPassword(e.target.value)} />
          {authError && <p className="text-rose-600 text-[10px] font-black uppercase">{authError}</p>}
          <button type="submit" disabled={authLoading} className="w-full py-5 bg-slate-950 text-white font-black text-[11px] uppercase tracking-[0.4em]">Authenticate</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-950 font-['Space_Grotesk']">
      <nav className="sticky top-0 z-50 bg-white/95 border-b border-slate-200 px-6 py-5 flex justify-between items-center shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4">
          <BookOpen size={20} />
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Taiwan Alpha Ledger.</h1>
        </div>
        <button onClick={() => signOut().then(() => setSession(null))} className="text-[10px] font-black uppercase text-slate-400 hover:text-rose-600">Terminate</button>
      </nav>

      <main className="max-w-[1100px] mx-auto px-6 py-10">
        <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} />

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <div className="lg:col-span-2 bg-white p-12 border border-slate-200 shadow-2xl relative overflow-hidden rounded-sm">
            <div className="absolute top-0 right-0 p-8 opacity-5"><Trophy size={140} /></div>
            {decisionMatrix.topPick ? (
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <span className="bg-slate-950 text-white text-[10px] font-black uppercase px-3 py-1 tracking-[0.3em]">AI PREMIUM TOP PICK</span>
                </div>
                <h2 className="text-6xl font-black italic tracking-tighter uppercase mb-10 text-slate-950 leading-none">
                  {decisionMatrix.topPick.stock_name}
                </h2>
                <div className="grid grid-cols-3 gap-12 mb-10 border-y border-slate-100 py-8">
                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">AI Score</p><p className="text-3xl font-black text-emerald-600">{decisionMatrix.topPick.ai_score}</p></div>
                  <div><p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Stop Loss</p><p className="text-3xl font-black text-rose-500">${decisionMatrix.topPick.trade_stop || '--'}</p></div>
                  <div><p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Target</p><p className="text-3xl font-black text-emerald-600">${decisionMatrix.topPick.trade_tp1 || '--'}</p></div>
                </div>
                <button onClick={() => setSelectedStock(decisionMatrix.topPick)} className="bg-slate-950 text-white px-10 py-5 text-[12px] font-black uppercase tracking-[0.4em] hover:bg-emerald-600 transition-all flex items-center gap-4 shadow-xl active:scale-95">啟動審計審查 <ArrowRight size={18} /></button>
              </div>
            ) : <div className="py-24 text-center text-slate-300">Scanning Market...</div>}
          </div>
          <div className="bg-white p-8 border border-slate-200 shadow-xl flex flex-col justify-between">
            <div>
               <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 flex items-center gap-2"><Globe size={16} /> SENTIMENT</h3>
               <div className="space-y-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">選股策略: <span className="text-slate-950">ATR 波動優選</span></p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">風險過濾: <span className="text-rose-500 font-black">2.0x ATR</span></p>
               </div>
            </div>
            <button onClick={() => handleAiInsight(decisionMatrix.eliteData)} className="w-full py-5 border-2 border-slate-950 text-[11px] font-black uppercase tracking-[0.3em] hover:bg-slate-950 hover:text-white transition-all">生成優選研報</button>
          </div>
        </div>

        <div className="flex gap-12 mb-8 border-b-2 border-slate-200/50 pb-2">
          <button onClick={() => setActiveView('daily')} className={`text-[12px] font-black uppercase tracking-[0.3em] pb-4 relative ${activeView === 'daily' ? 'text-slate-950' : 'text-slate-300'}`}>
            MARKET LISTING
            {activeView === 'daily' && <div className="absolute bottom-[-2px] left-0 w-full h-[4px] bg-slate-950"></div>}
          </button>
          <button onClick={() => setActiveView('portfolio')} className={`text-[12px] font-black uppercase tracking-[0.3em] pb-4 relative ${activeView === 'portfolio' ? 'text-slate-950' : 'text-slate-300'}`}>
            VAULT VAULT ({state.portfolio.length})
            {activeView === 'portfolio' && <div className="absolute bottom-[-2px] left-0 w-full h-[4px] bg-slate-950"></div>}
          </button>
        </div>

        <div className="space-y-1">
          {activeView === 'daily' ? (
            decisionMatrix.eliteData.map((stock, idx) => (
              <div key={stock.id} className="relative">
                {idx < 3 && <div className="absolute -left-2 top-4 z-10 bg-amber-400 text-slate-950 px-2 py-0.5 text-[8px] font-black uppercase rounded-sm shadow-sm flex items-center gap-1"><Star size={10} /> TOP {idx + 1}</div>}
                <ActionCard stock={stock} quant={calculateTradeSignal(stock)} onSelect={() => setSelectedStock(stock)} />
              </div>
            ))
          ) : (
            decisionMatrix.portfolioDetails.map(item => (
              <div key={item.id} className="relative group">
                <button onClick={() => deleteFromPortfolio(item.id).then(loadData)} className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-3 text-rose-500 hover:bg-rose-50 rounded-full transition-all"><X size={20} /></button>
                {item.marketData ? <ActionCard stock={item.marketData} quant={item.quant!} isPortfolio buyPrice={item.buy_price} returnPercent={item.returnPercent} onSelect={() => setSelectedStock(item.marketData!)} /> : <div className="p-8 bg-slate-50 text-slate-300 text-[11px] font-black uppercase text-center border-2 border-dashed">正在同步現價...</div>}
              </div>
            ))
          )}
        </div>
      </main>

      {selectedStock && <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} onRunAi={(stock) => { setSelectedStock(null); handleAiInsight(stock); }} />}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/20 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-white p-10 relative shadow-2xl overflow-y-auto max-h-[90vh] rounded-sm border border-slate-200">
            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-8 right-8 p-2.5 hover:bg-slate-100 rounded-full"><X size={24}/></button>
            <div className="text-center mb-16 border-b-4 border-slate-950 pb-10 uppercase"><h3 className="text-4xl font-black italic mb-3">Audit Report</h3></div>
            {isAiLoading ? <div className="flex flex-col items-center py-24 gap-6"><Loader2 size={48} className="animate-spin text-slate-100" /></div> : <div className="serif-text text-lg italic leading-relaxed whitespace-pre-wrap">{aiReport}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
