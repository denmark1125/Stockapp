
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw, X, Plus, ShieldAlert, CheckCircle2, ArrowRight, LogOut, Loader2,
  FileText, Sparkles, Quote
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
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);

  // AI 深度報告狀態 (僅在點擊時觸發)
  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  /**
   * 1. 本地量化演算法引擎 (Local Quant Engine)
   * 這是決策的核心，不消耗 API 額度且邏輯嚴謹。
   */
  const calculateTradeSignal = useCallback((stock: DailyAnalysis) => {
    const score = stock.ai_score ?? 0;
    const roe = stock.roe ?? 0;
    const growth = stock.revenue_growth ?? 0;
    const technical = stock.technical_signal || "";
    
    // --- 賣出訊號 (Sell Logic) ---
    if (score < 60) return { signal: "賣出", color: "rose", reason: "AI 總體評分不及格，趨勢極端疲弱，建議避開。" };
    if (technical.includes("死亡交叉") || technical.includes("空頭")) return { signal: "技術轉弱", color: "rose", reason: "技術面出現空頭排列，短期下行壓力巨大。" };
    if (growth < -20) return { signal: "基本面惡化", color: "rose", reason: "營收出現嚴重負成長，基本面支撐力道薄弱。" };

    // --- 買進訊號 (Buy Logic) ---
    if (score >= 85 && (technical.includes("多頭") || technical.includes("金叉"))) {
      return { signal: "強力買進", color: "emerald", reason: `評分 (${score}) 與技術面完美契合，多頭動能強勁。` };
    }
    if (roe > 15 && growth > 10) {
      return { signal: "價值選股", color: "emerald", reason: `獲利能力優秀 (ROE: ${roe}%) 且營收持續增長。` };
    }

    // --- 邏輯防呆與風險提示 (Guardrails) ---
    if (roe <= 5) return { signal: "觀望", color: "slate", reason: "獲利能力疲弱 (ROE過低)，目前不具備長期投資價值。" };
    if (score > 80 && growth < 0) return { signal: "小心假突破", color: "slate", reason: "技術面強勢但營收負成長，需留意高檔出貨風險。" };

    return { signal: "中性/持股", color: "slate", reason: "走勢平穩，建議維持目前持股水位，持續觀察。" };
  }, []);

  // 監聽 Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // 載入資料
  const loadData = useCallback(async () => {
    if (!session) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const [marketData, portfolioData] = await Promise.all([
        fetchDailyAnalysis(),
        fetchPortfolio()
      ]);
      setState(prev => ({ 
        ...prev, 
        data: marketData, 
        portfolio: portfolioData, 
        loading: false, 
        lastUpdated: new Date() 
      }));
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: "Sync Error" }));
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  /**
   * 2. 深度 AI 解讀 (Deep Insight)
   * 僅在使用者點擊 Modal 時才呼叫 API，節省額度
   */
  const handleDeepAnalysis = async (stock: DailyAnalysis) => {
    setIsAiLoading(true);
    setAiReport(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API });
      const prompt = `
        請以資深分析師的身份，對股票「${stock.stock_name} (${stock.stock_code})」進行深度分析。
        數據如下：ROE ${stock.roe}%, 營收成長 ${stock.revenue_growth}%, AI評分 ${stock.ai_score}, 技術面：${stock.technical_signal}。
        請給出三點精確的洞察，最後給出具體的「執行策略」。使用繁體中文，格式請保持簡潔專業。
      `;
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setAiReport(result.text);
    } catch (err) {
      setAiReport("分析引擎目前忙碌中，請稍後。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 3. 處理 Auth
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("註冊成功！");
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || "驗證失敗");
    } finally {
      setAuthLoading(false);
    }
  };

  // 4. 決策矩陣運算 (包含損益計算)
  const decisionMatrix = useMemo(() => {
    const today = state.data;
    const topPick = today.length > 0 ? today.reduce((prev, curr) => (prev.ai_score! > curr.ai_score!) ? prev : curr) : null;
    
    const portfolioDetails = state.portfolio.map(item => {
      const market = today.find(d => d.stock_code === item.stock_code);
      const currentPrice = market?.close_price || item.buy_price;
      const profitLossPercent = ((currentPrice - item.buy_price) / item.buy_price) * 100;
      
      // 使用量化引擎
      const localAnalysis = market ? calculateTradeSignal(market) : { signal: "持股", color: "slate", reason: "尚無今日數據" };

      return {
        ...item,
        currentPrice,
        aiScore: market?.ai_score || 0,
        returnPercent: profitLossPercent,
        localAnalysis,
        isWeak: (market?.ai_score || 0) < 60
      };
    });

    const alerts = portfolioDetails.filter(p => p.isWeak);
    return { topPick, portfolioDetails, alerts };
  }, [state.data, state.portfolio, calculateTradeSignal]);

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center items-center p-6 text-slate-900">
        <div className="w-full max-w-lg">
          <div className="mono-text text-rose-500 text-xs font-black mb-12 tracking-[0.5em] uppercase text-center">Executive Portal</div>
          <h1 className="editorial-title font-black italic text-center mb-12 uppercase leading-none">Decision<br />Desk.</h1>
          <form onSubmit={handleAuth} className="space-y-6">
            <input type="email" placeholder="EMAIL" required className="w-full border-b-2 border-slate-900 pb-4 bg-transparent outline-none mono-text font-black text-xl" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="PASSWORD" required className="w-full border-b-2 border-slate-900 pb-4 bg-transparent outline-none mono-text font-black text-xl" value={password} onChange={e => setPassword(e.target.value)} />
            {authError && <p className="text-rose-500 font-bold text-sm text-center">{authError}</p>}
            <button type="submit" disabled={authLoading} className="w-full py-6 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.3em] hover:bg-rose-500 transition-all">
              {authLoading ? <Loader2 className="animate-spin mx-auto"/> : (authMode === 'login' ? 'Authenticate' : 'Create Access')}
            </button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full mt-8 text-slate-400 text-xs uppercase font-bold tracking-widest hover:text-slate-900 transition-colors">
            {authMode === 'login' ? 'Register New account' : 'Return to Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-12">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-24">
          <div>
            <div className="mono-text text-rose-500 text-xs font-black uppercase mb-4 tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              Session: {session.user.email}
            </div>
            <h1 className="editorial-title italic font-black uppercase tracking-tighter">Command Center.</h1>
          </div>
          <div className="flex gap-4">
             <button onClick={loadData} className="p-4 border-2 border-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all">
               <RefreshCw size={24} className={state.loading ? 'animate-spin' : ''} />
             </button>
             <button onClick={() => signOut()} className="p-4 border-2 border-slate-200 text-slate-300 rounded-full hover:border-rose-500 hover:text-rose-500 transition-all">
               <LogOut size={24} />
             </button>
          </div>
        </div>

        {/* Section A: AI Briefing & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-32">
          <div className="bg-slate-900 text-white p-10 lg:p-16 flex flex-col justify-between">
            <div>
              <div className="mono-text text-[10px] uppercase text-slate-500 font-black mb-8 tracking-[0.4em]">今日首選 / TOP PICK</div>
              {decisionMatrix.topPick ? (
                <>
                  <h2 className="text-6xl lg:text-8xl font-black italic tracking-tighter mb-4">{decisionMatrix.topPick.stock_name}</h2>
                  <div className="text-2xl lg:text-3xl font-black text-emerald-400 mb-8 italic uppercase">強力買進 (Strong Buy)</div>
                  <p className="text-slate-400 text-lg lg:text-xl leading-relaxed italic max-w-md">
                    「{decisionMatrix.topPick.stock_name} 通過量化引擎篩選，評分達 {decisionMatrix.topPick.ai_score}。基本面與技術面共振明顯。」
                  </p>
                </>
              ) : <div className="animate-pulse text-slate-700">SCANNING...</div>}
            </div>
            <div className="mt-12 flex items-center gap-8">
               <div className="flex flex-col">
                  <span className="mono-text text-[9px] text-slate-500 uppercase">Latest Quote</span>
                  <span className="text-3xl font-black">${decisionMatrix.topPick?.close_price}</span>
               </div>
               <button onClick={() => decisionMatrix.topPick && setSelectedStock(decisionMatrix.topPick)} className="px-8 py-4 bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all">Deep Analysis</button>
            </div>
          </div>

          <div className="border-[6px] border-slate-900 p-10 lg:p-16 flex flex-col">
            <div className="mono-text text-[10px] uppercase text-slate-400 font-black mb-8 tracking-[0.4em]">庫存警戒 / PORTFOLIO ALERTS</div>
            <div className="space-y-8 flex-1">
              {decisionMatrix.alerts.length > 0 ? (
                decisionMatrix.alerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-6 group border-b border-slate-100 pb-6 last:border-0">
                    <div className="p-4 bg-rose-500 text-white"><ShieldAlert size={32} /></div>
                    <div>
                      <h4 className="text-3xl font-black italic uppercase tracking-tighter">{alert.stock_name}</h4>
                      <p className="text-rose-600 font-bold italic mt-2 uppercase">趨勢破壞 (Rating: {alert.aiScore})：建議立即退場。</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-6 py-12">
                  <div className="p-4 bg-emerald-500 text-white"><CheckCircle2 size={32} /></div>
                  <div>
                    <h4 className="text-3xl font-black italic uppercase tracking-tighter">Status: Secure.</h4>
                    <p className="text-slate-400 font-bold italic mt-2 uppercase tracking-tighter">持股評分均在合理區間，無須調整。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section B: Signal List */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-12 mono-text text-xs font-black uppercase tracking-[0.2em]">
             <button onClick={() => setActiveView('daily')} className={`pb-2 border-b-2 transition-all ${activeView === 'daily' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-300'}`}>Market Signals</button>
             <button onClick={() => setActiveView('portfolio')} className={`pb-2 border-b-2 transition-all ${activeView === 'portfolio' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-300'}`}>My Portfolio</button>
          </div>
          {activeView === 'portfolio' && (
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-3 text-xs font-black uppercase tracking-widest hover:text-rose-500 transition-all">
              <Plus size={16} /> Register Asset
            </button>
          )}
        </div>

        <div className="flex flex-col">
          {activeView === 'daily' ? (
            state.data.map(stock => {
              const quantAnalysis = calculateTradeSignal(stock);
              return (
                <ActionCard 
                  key={stock.id} 
                  stock={{...stock, ai_suggestion: quantAnalysis.reason}} 
                  onSelect={() => setSelectedStock(stock)} 
                />
              )
            })
          ) : (
            decisionMatrix.portfolioDetails.map(item => {
              const market = state.data.find(d => d.stock_code === item.stock_code) || ({} as DailyAnalysis);
              return (
                <div key={item.id} className="relative group">
                  <ActionCard 
                    stock={{...market, stock_name: item.stock_name, stock_code: item.stock_code, ai_score: item.aiScore, ai_suggestion: item.localAnalysis.reason}} 
                    isPortfolio 
                    returnPercent={item.returnPercent}
                    buyPrice={item.buy_price}
                    onSelect={() => setSelectedStock({...market, stock_name: item.stock_name, stock_code: item.stock_code, ai_score: item.aiScore})}
                  />
                  <button onClick={(e) => { e.stopPropagation(); deleteFromPortfolio(item.id).then(loadData); }} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                    <X size={20} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal: Add Position */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white p-12 relative shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-12">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">New Asset.</h2>
                <button onClick={() => setIsAddModalOpen(false)}><X size={24}/></button>
             </div>
             <div className="space-y-8">
                <div className="space-y-2">
                  <label className="mono-text text-[10px] font-black uppercase text-slate-400">Stock Code</label>
                  <input type="text" placeholder="e.g. 2330" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.code} onChange={e => setNewHolding({...newHolding, code: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="mono-text text-[10px] font-black uppercase text-slate-400">Display Name</label>
                  <input type="text" placeholder="台積電" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.name} onChange={e => setNewHolding({...newHolding, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-2">
                    <label className="mono-text text-[10px] font-black uppercase text-slate-400">Entry Price</label>
                    <input type="number" placeholder="0.0" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.price} onChange={e => setNewHolding({...newHolding, price: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                    <label className="mono-text text-[10px] font-black uppercase text-slate-400">Quantity</label>
                    <input type="number" placeholder="1000" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.qty} onChange={e => setNewHolding({...newHolding, qty: e.target.value})} />
                   </div>
                </div>
                <button onClick={async () => {
                  if (!newHolding.code || !newHolding.name) return;
                  await addToPortfolio(newHolding.code, newHolding.name, Number(newHolding.price), Number(newHolding.qty));
                  setIsAddModalOpen(false);
                  loadData();
                }} className="w-full py-6 bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-emerald-500 transition-all">Confirm Asset</button>
             </div>
          </div>
        </div>
      )}

      {/* Modal: Detailed Analysis & AI Insight */}
      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-6 bg-slate-900/60 backdrop-blur-xl overflow-y-auto">
           <div className="w-full max-w-4xl bg-white p-10 lg:p-20 relative shadow-2xl animate-in fade-in zoom-in-95 duration-300 my-8">
             <button onClick={() => setSelectedStock(null)} className="absolute top-10 right-10 p-3 hover:bg-slate-100 rounded-full transition-all"><X size={24}/></button>
             <div className="mono-text text-rose-500 text-xs font-black uppercase mb-12 tracking-widest italic">Confidential Alpha Report</div>
             
             <div className="flex flex-col lg:flex-row lg:items-baseline gap-6 mb-12">
               <h2 className="text-6xl lg:text-9xl font-black italic tracking-tighter uppercase">{selectedStock.stock_name}</h2>
               <span className="text-3xl font-bold text-slate-300 italic">{selectedStock.stock_code}</span>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-12">
               <div className="space-y-8">
                 <div className="p-8 bg-slate-50 border-l-4 border-slate-900">
                   <div className="mono-text text-[10px] uppercase font-black mb-4 opacity-50">Local Quant Signal</div>
                   <div className="text-2xl font-black italic">
                     {calculateTradeSignal(selectedStock).reason}
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-8">
                    <div className="p-6 border border-slate-100">
                      <div className="mono-text text-[10px] uppercase font-black mb-2 opacity-50">ROE</div>
                      <div className="text-4xl font-black italic">{selectedStock.roe}%</div>
                    </div>
                    <div className="p-6 border border-slate-100">
                      <div className="mono-text text-[10px] uppercase font-black mb-2 opacity-50">AI Score</div>
                      <div className="text-4xl font-black italic">{selectedStock.ai_score}</div>
                    </div>
                 </div>
               </div>

               <div className="flex flex-col h-full justify-between">
                  <div className="bg-slate-900 text-white p-8 mb-8 flex-1">
                    <div className="flex items-center gap-2 mb-6">
                      <Sparkles size={16} className="text-emerald-400" />
                      <span className="mono-text text-[10px] uppercase font-black tracking-widest">AI Deep Insight</span>
                    </div>
                    {isAiLoading ? (
                      <div className="flex flex-col items-center justify-center h-40">
                         <Loader2 className="animate-spin text-slate-500 mb-4" />
                         <span className="text-xs uppercase mono-text opacity-50">Synthesizing Data...</span>
                      </div>
                    ) : aiReport ? (
                      <div className="text-sm lg:text-base italic leading-relaxed whitespace-pre-wrap text-slate-300">
                        {aiReport}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 border border-dashed border-slate-700">
                        <p className="text-xs italic text-slate-500 mb-4">點擊下方按鈕啟動 Gemini 3 分析模型</p>
                        <button onClick={() => handleDeepAnalysis(selectedStock)} className="px-6 py-3 bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all">啟動 AI 深度報告</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setSelectedStock(null)} className="w-full py-6 bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-rose-500 transition-all">Dismiss Terminal</button>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
