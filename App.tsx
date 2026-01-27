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
// 引用 Google 官方 SDK
import { GoogleGenerativeAI } from "@google/generative-ai";
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

  // --- 自動登出機制 ---
  const handleLogout = useCallback(async () => {
    await signOut();
    setSession(null);
    localStorage.removeItem('supabase.auth.token');
    alert('為了資安，系統已自動登出。');
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (session) {
      timeoutRef.current = setTimeout(handleLogout, 15 * 60 * 1000); // 15分鐘
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

  // --- 股號自動帶入名稱 ---
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

  // --- 訊號判斷邏輯 ---
  const calculateTradeSignal = useCallback((stock: DailyAnalysis, isPortfolioItem = false, buyPrice?: number): TradeSignal => {
    const score = stock.ai_score ?? 0;
    
    // 庫存股止損邏輯 (優先級最高)
    if (isPortfolioItem && buyPrice) {
      const dropPercent = ((stock.close_price - buyPrice) / buyPrice) * 100;
      if (dropPercent <= -5) {
        return { 
          signal: "止損賣出 SELL", color: "rose", 
          reason: `觸發風控：虧損達 ${dropPercent.toFixed(1)}%，請執行紀律操作。`, 
          isAlert: true, trend: 'down', tags: ["觸發止損"]
        };
      }
    }

    // 買進訊號
    if (score >= 85) {
      return { 
        signal: isPortfolioItem ? "加碼 ADD" : "強力買進 BUY", 
        color: "emerald", 
        reason: "AI 評分極高，動能強勁且具備安全邊際，符合進場條件。", 
        isAlert: false, trend: 'up', tags: ["高確信", "動能噴發"]
      };
    } else if (score >= 75) {
       return { 
        signal: isPortfolioItem ? "續抱 HOLD" : "觀察 WATCH", 
        color: "amber", 
        reason: "結構轉強但未達買入門檻，建議放入追蹤名單。", 
        isAlert: false, trend: 'stable', tags: ["待觀察", "結構改善"]
      };
    }

    return { 
      signal: "觀望 AVOID", color: "slate", 
      reason: "目前評分偏低，建議觀望等待更好的交易結構。", 
      isAlert: false, trend: 'stable', tags: []
    };
  }, []);

  // --- AI 深度審計功能 (搭載 Gemini 3.0 Preview) ---
  const handleAiInsight = async (stock: DailyAnalysis | DailyAnalysis[]) => {
    setIsAiLoading(true);
    setAiReport(null);
    setIsReportModalOpen(true);
    try {
      // 1. 正確讀取環境變數 (Vite 專用寫法)
      // 使用 as any 繞過 TS 檢查，確保部署順利
      const env = (import.meta as any).env;
      const apiKey = env.NEXT_PUBLIC_GEMINI_API || env.VITE_GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error("系統未偵測到 API 金鑰，請檢查環境變數配置。");
      }

      // 2. 初始化 SDK
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // 🔥🔥🔥 關鍵修正：使用 gemini-3-pro-preview 模型 🔥🔥🔥
      const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

      const today = format(new Date(), 'yyyy年MM月dd日 HH:mm');
      let prompt = "";
      
      if (Array.isArray(stock)) {
        // 戰情室模式
        const dataStr = stock.slice(0, 5).map(s => 
          `[${s.stock_name} | AI:${s.ai_score} | ROE:${s.roe}%]`
        ).join('\n');
        
        prompt = `現在是 ${today}。你是巴菲特風格的台股分析師。
        分析這份「今日優選名單」：
        ${dataStr}
        
        請撰寫一份簡短的宏觀研報：
        1. 市場情緒：這些高分股反映了什麼資金流向？
        2. 首選標的：從中挑選一支最強的，說明理由。
        3. 風險提示：有沒有過熱跡象？
        4. 給 CEO 的一句操作箴言。
        (使用繁體中文，語氣專業毒舌)`;
      } else {
        // 個股模式
        prompt = `現在是 ${today}。分析標的：${stock.stock_name}。
        數據面板：AI評分 ${stock.ai_score}，ROE ${stock.roe}%，營收成長 ${stock.revenue_growth}%。
        
        請進行深度審計：
        1. 這是一門好生意嗎？(護城河分析)
        2. 這個價格安全嗎？(估值分析)
        3. 最終指令：買進、觀望還是賣出？
        (使用繁體中文，300字以內)`;
      }

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setAiReport(response.text());

    } catch (err: any) {
      console.error(err);
      // 錯誤處理：如果預覽版不穩定，提示使用者
      if (err.message.includes("not found")) {
         setAiReport("⚠️ Gemini 3 Preview 模型連線異常，請確認您的 API Key 是否有預覽版權限，或暫時切換回 1.5 Pro。");
      } else {
         setAiReport(`審計失敗: ${err.message || "請檢查 API Key"}`);
      }
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
      const safetyBuffer = addHours(now, 1);
      let latestDate = new Date(0);
      
      marketData.forEach(item => {
        const d = new Date(item.updated_at);
        if (isValid(d) && isAfter(d, latestDate) && isBefore(d, safetyBuffer)) {
          latestDate = d;
        }
      });
      
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
    // 篩選邏輯
    const eliteData = [...state.data].filter(s => (s.ai_score || 0) >= 70).sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));
    const topPick = eliteData[0] || null;
    const portfolioDetails = state.portfolio.map(item => {
      const market = state.data.find(d => d.stock_code === item.stock_code);
      const quant = market ? calculateTradeSignal(market, true, item.buy_price) : null;
      return { 
        ...item, 
        currentPrice: market?.close_price || item.buy_price, 
        returnPercent: market ? ((market.close_price - item.buy_price) / item.buy_price) * 100 : 0, 
        quant, 
        marketData: market 
      };
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Top Pick Section */}
          <div className="lg:col-span-2 bg-white p-12 border border-slate-200 shadow-2xl relative overflow-hidden rounded-sm group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Trophy size={140} /></div>
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
                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ROE %</p><p className="text-3xl font-black text-slate-800">{decisionMatrix.topPick.roe}%</p></div>
                  <div><p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Rev Growth</p><p className="text-3xl font-black text-amber-600">{decisionMatrix.topPick.revenue_growth}%</p></div>
                </div>
                <button onClick={() => setSelectedStock(decisionMatrix.topPick)} className="bg-slate-950 text-white px-10 py-5 text-[12px] font-black uppercase tracking-[0.4em] hover:bg-emerald-600 transition-all flex items-center gap-4 shadow-xl active:scale-95">啟動審計審查 <ArrowRight size={18} /></button>
              </div>
            ) : <div className="py-24 text-center text-slate-300">Scanning Market...</div>}
          </div>

          {/* Sentiment / Report Section */}
          <div className="bg-white p-8 border border-slate-200 shadow-xl flex flex-col justify-between">
            <div>
               <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 flex items-center gap-2"><Globe size={16} /> SENTIMENT</h3>
               <div className="space-y-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">選股策略: <span className="text-slate-950">AI 多因子量化</span></p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">風險過濾: <span className="text-rose-500 font-black">嚴格 ROE 審查</span></p>
               </div>
            </div>
            <button onClick={() => handleAiInsight(decisionMatrix.eliteData)} className="w-full py-5 border-2 border-slate-950 text-[11px] font-black uppercase tracking-[0.3em] hover:bg-slate-950 hover:text-white transition-all">生成優選研報</button>
          </div>
        </div>

        {/* 視圖切換 */}
        <div className="flex justify-between items-center mb-8 border-b-2 border-slate-200/50 pb-2">
          <div className="flex gap-12">
            <button onClick={() => setActiveView('daily')} className={`text-[12px] font-black uppercase tracking-[0.3em] pb-4 relative ${activeView === 'daily' ? 'text-slate-950' : 'text-slate-300'}`}>
              MARKET LISTING
              {activeView === 'daily' && <div className="absolute bottom-[-2px] left-0 w-full h-[4px] bg-slate-950"></div>}
            </button>
            <button onClick={() => setActiveView('portfolio')} className={`text-[12px] font-black uppercase tracking-[0.3em] pb-4 relative ${activeView === 'portfolio' ? 'text-slate-950' : 'text-slate-300'}`}>
              VAULT ({state.portfolio.length})
              {activeView === 'portfolio' && <div className="absolute bottom-[-2px] left-0 w-full h-[4px] bg-slate-950"></div>}
            </button>
          </div>
          
          {/* Add Asset 按鈕 */}
          {activeView === 'portfolio' && (
            <button onClick={() => setIsAddModalOpen(true)} className="px-6 py-2 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors">
              + ADD ASSET
            </button>
          )}
        </div>

        {/* 列表顯示區 */}
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

      {/* 彈出視窗：戰力分析 */}
      {selectedStock && (
        <StockDetailModal 
          stock={selectedStock} 
          onClose={() => setSelectedStock(null)} 
          onRunAi={(stock) => { setSelectedStock(null); handleAiInsight(stock); }} 
        />
      )}

      {/* 彈出視窗：AI 報告 */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/20 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-white p-10 relative shadow-2xl overflow-y-auto max-h-[90vh] rounded-sm border border-slate-200">
            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-8 right-8 p-2.5 hover:bg-slate-100 rounded-full"><X size={24}/></button>
            <div className="text-center mb-16 border-b-4 border-slate-950 pb-10 uppercase"><h3 className="text-4xl font-black italic mb-3">Audit Report</h3></div>
            {isAiLoading ? <div className="flex flex-col items-center py-24 gap-6"><Loader2 size={48} className="animate-spin text-slate-100" /></div> : <div className="serif-text text-lg italic leading-relaxed whitespace-pre-wrap">{aiReport}</div>}
          </div>
        </div>
      )}

      {/* 資產建倉 Modal (之前缺失的部分已補上) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/10 backdrop-blur-md">
          <div className="w-full max-w-md bg-white p-12 shadow-2xl rounded-sm border border-slate-100">
             <div className="flex justify-between items-start mb-12">
                <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter">Log<br />Asset.</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2.5 hover:bg-slate-50 rounded-full"><X size={24}/></button>
             </div>
             <form onSubmit={async (e) => {
               e.preventDefault();
               await addToPortfolio(newHolding.code, newHolding.name, Number(newHolding.price), Number(newHolding.qty));
               setIsAddModalOpen(false);
               loadData();
               setNewHolding({ code: '', name: '', price: '', qty: '' });
             }} className="space-y-8">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">證券代號 SYMBOL</label>
                  <input 
                    type="text" 
                    placeholder="2330" 
                    required 
                    className="w-full border-b-2 border-slate-100 py-3 text-2xl font-black outline-none focus:border-slate-950 transition-all uppercase" 
                    value={newHolding.code} 
                    onChange={e => setNewHolding({...newHolding, code: e.target.value})} 
                    onBlur={() => fetchStockName(newHolding.code)}
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium italic">輸入完畢點擊空白處自動帶入名稱</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">資產名稱 NAME</label>
                  <input 
                    type="text" 
                    placeholder="台積電" 
                    required 
                    className="w-full border-b-2 border-slate-100 py-3 text-2xl font-black outline-none focus:border-slate-950 transition-all" 
                    value={newHolding.name} 
                    onChange={e => setNewHolding({...newHolding, name: e.target.value})} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-10">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">買入價格 BUY</label>
                      <input type="number" step="0.01" required className="w-full border-b-2 border-slate-100 py-3 text-2xl font-black outline-none focus:border-slate-950 transition-all" value={newHolding.price} onChange={e => setNewHolding({...newHolding, price: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">持有數量 QTY</label>
                      <input type="number" required className="w-full border-b-2 border-slate-100 py-3 text-2xl font-black outline-none focus:border-slate-950 transition-all" value={newHolding.qty} onChange={e => setNewHolding({...newHolding, qty: e.target.value})} />
                    </div>
                </div>
                <button type="submit" className="w-full py-6 bg-slate-950 text-white font-black uppercase tracking-[0.4em] hover:bg-emerald-600 transition-all shadow-2xl rounded-sm mt-6">
                  確認建立倉位 COMMIT
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;