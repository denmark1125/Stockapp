
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

  // AI 戰報狀態
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 1. 監聽 Auth 狀態
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 2. 資料載入
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
      console.error(err);
      setState(prev => ({ ...prev, loading: false, error: "Sync Error" }));
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  // 3. 生成 AI 戰報
  const generateAiReport = async () => {
    if (state.data.length === 0) return;
    setIsAiLoading(true);
    setIsReportModalOpen(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API });
      const top5 = state.data.slice(0, 5).map(s => 
        `股票：${s.stock_name}，產業：${s.sector}，AI評分：${s.ai_score}，技術訊號：${s.technical_signal}`
      ).join('\n');

      const prompt = `
        你是一位專門服務 CEO 的首席市場策略官。請根據以下今日台股前 5 名強勢股數據，生成一份「CEO 晨間簡報」。
        
        數據內容：
        ${top5}

        請嚴格依照以下格式生成（使用繁體中文）：
        1. 【今日市場氣氛】：用一句話形容今天大盤趨勢（多頭/空頭/震盪）。
        2. 【資金流向觀察】：根據產業分布，分析資金正在往哪個題材集中。
        3. 【執行官操作心法】：給 CEO 今日的投資建議（簡潔有力）。

        要求：排版要有專業雜誌感，口吻成熟冷靜。
      `;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setAiReport(result.text);
    } catch (err) {
      console.error("AI Report Error:", err);
      setAiReport("目前無法連結 AI 策略官，請稍後再試。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 4. Auth 處理
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

  const decisionMatrix = useMemo(() => {
    const today = state.data;
    const topPick = today.length > 0 ? today.reduce((prev, curr) => (prev.ai_score! > curr.ai_score!) ? prev : curr) : null;
    
    const portfolioDetails = state.portfolio.map(item => {
      const market = today.find(d => d.stock_code === item.stock_code);
      return {
        ...item,
        currentPrice: market?.close_price || item.buy_price,
        aiScore: market?.ai_score || 0,
        returnPercent: (((market?.close_price || item.buy_price) - item.buy_price) / item.buy_price) * 100,
        isWeak: (market?.ai_score || 0) < 60
      };
    });

    const alerts = portfolioDetails.filter(p => p.isWeak);
    return { topPick, portfolioDetails, alerts };
  }, [state.data, state.portfolio]);

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
            {authMode === 'login' ? 'Request New Account' : 'Return to Login'}
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
             <button onClick={generateAiReport} className="flex items-center gap-3 px-6 py-4 border-2 border-slate-900 font-black text-xs uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">
               <Sparkles size={18} /> AI 戰報
             </button>
             <button onClick={loadData} className="p-4 border-2 border-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all">
               <RefreshCw size={24} className={state.loading ? 'animate-spin' : ''} />
             </button>
             <button onClick={() => signOut()} className="p-4 border-2 border-slate-200 text-slate-300 rounded-full hover:border-rose-500 hover:text-rose-500 transition-all">
               <LogOut size={24} />
             </button>
          </div>
        </div>

        {/* Section A: AI Briefing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-32">
          <div className="bg-slate-900 text-white p-10 lg:p-16 flex flex-col justify-between">
            <div>
              <div className="mono-text text-[10px] uppercase text-slate-500 font-black mb-8 tracking-[0.4em]">今日首選 / TOP PICK</div>
              {decisionMatrix.topPick ? (
                <>
                  <h2 className="text-6xl lg:text-8xl font-black italic tracking-tighter mb-4">{decisionMatrix.topPick.stock_name}</h2>
                  <div className="text-2xl lg:text-3xl font-black text-emerald-400 mb-8 italic uppercase">強力買進 (Strong Buy)</div>
                  <p className="text-slate-400 text-lg lg:text-xl leading-relaxed italic max-w-md">
                    「{decisionMatrix.topPick.stock_name} 目前 AI 評分高達 {decisionMatrix.topPick.ai_score} 分。技術面與基本面達成罕見共振。」
                  </p>
                </>
              ) : <div className="animate-pulse text-slate-700">SCANNING...</div>}
            </div>
            <div className="mt-12 flex items-center gap-8">
               <div className="flex flex-col">
                  <span className="mono-text text-[9px] text-slate-500 uppercase">Entry Quote</span>
                  <span className="text-3xl font-black">${decisionMatrix.topPick?.close_price}</span>
               </div>
               <button onClick={() => decisionMatrix.topPick && setSelectedStock(decisionMatrix.topPick)} className="px-8 py-4 bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all">Analysis</button>
            </div>
          </div>

          <div className="border-[6px] border-slate-900 p-10 lg:p-16 flex flex-col">
            <div className="mono-text text-[10px] uppercase text-slate-400 font-black mb-8 tracking-[0.4em]">持股警報 / PORTFOLIO ALERT</div>
            <div className="space-y-8 flex-1">
              {decisionMatrix.alerts.length > 0 ? (
                decisionMatrix.alerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-6 group">
                    <div className="p-4 bg-rose-500 text-white"><ShieldAlert size={32} /></div>
                    <div>
                      <h4 className="text-3xl font-black italic uppercase tracking-tighter">{alert.stock_name}</h4>
                      <p className="text-rose-600 font-bold italic mt-2 uppercase tracking-tighter">AI 評分破底 ({alert.aiScore})：建議立即清倉。</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-6 py-12">
                  <div className="p-4 bg-emerald-500 text-white"><CheckCircle2 size={32} /></div>
                  <div>
                    <h4 className="text-3xl font-black italic uppercase tracking-tighter">All Systems Clear.</h4>
                    <p className="text-slate-400 font-bold italic mt-2 uppercase tracking-tighter">當前庫存結構健康，無需進行防禦性減碼。</p>
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
              <Plus size={16} /> Add Position
            </button>
          )}
        </div>

        <div className="flex flex-col">
          {activeView === 'daily' ? (
            state.data.map(stock => (
              <ActionCard key={stock.id} stock={stock} onSelect={() => setSelectedStock(stock)} />
            ))
          ) : (
            decisionMatrix.portfolioDetails.map(item => {
              const market = state.data.find(d => d.stock_code === item.stock_code) || ({} as DailyAnalysis);
              return (
                <div key={item.id} className="relative group">
                  <ActionCard 
                    stock={{...market, stock_name: item.stock_name, stock_code: item.stock_code, ai_score: item.aiScore}} 
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

      {/* AI Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-2xl">
          <div className="w-full max-w-3xl bg-white p-12 lg:p-20 relative shadow-2xl animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-10 right-10 p-2 hover:bg-slate-100 rounded-full"><X size={24}/></button>
            <div className="mono-text text-rose-500 text-xs font-black uppercase mb-12 tracking-widest flex items-center gap-3">
               <Sparkles size={16}/> 首席策略官簡報 / Morning Briefing
            </div>
            {isAiLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6">
                <Loader2 size={48} className="animate-spin text-slate-200" />
                <p className="mono-text text-xs uppercase font-black text-slate-400">正在同步全球市場數據並生成洞察...</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none">
                <div className="mb-12"><Quote size={40} className="text-slate-100 fill-slate-100 mb-4" /></div>
                <div className="text-xl lg:text-2xl font-medium italic text-slate-800 leading-relaxed whitespace-pre-wrap font-serif">
                  {aiReport}
                </div>
                <div className="mt-16 border-t-4 border-slate-900 pt-8 flex justify-between items-center">
                   <div className="mono-text text-[10px] uppercase font-black tracking-widest text-slate-400">Generated on: {format(new Date(), 'yyyy/MM/dd HH:mm')}</div>
                   <button onClick={() => setIsReportModalOpen(false)} className="px-10 py-4 bg-slate-900 text-white font-black uppercase text-xs tracking-widest hover:bg-rose-500 transition-all">Dismiss</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Modals (Add Position & Detail) Logic... */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white p-12 relative shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-12">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">Register Asset.</h2>
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
                    <label className="mono-text text-[10px] font-black uppercase text-slate-400">Cost Basis</label>
                    <input type="number" placeholder="0.0" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.price} onChange={e => setNewHolding({...newHolding, price: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                    <label className="mono-text text-[10px] font-black uppercase text-slate-400">Volume</label>
                    <input type="number" placeholder="1000" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.qty} onChange={e => setNewHolding({...newHolding, qty: e.target.value})} />
                   </div>
                </div>
                <button onClick={async () => {
                  if (!newHolding.code || !newHolding.name) return;
                  await addToPortfolio(newHolding.code, newHolding.name, Number(newHolding.price), Number(newHolding.qty));
                  setIsAddModalOpen(false);
                  loadData();
                }} className="w-full py-6 bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-emerald-500 transition-all">Confirm Execution</button>
             </div>
          </div>
        </div>
      )}

      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-6 bg-slate-900/60 backdrop-blur-xl">
           <div className="w-full max-w-4xl bg-white p-10 lg:p-20 relative shadow-2xl animate-in fade-in zoom-in-95 duration-300 my-8">
             <button onClick={() => setSelectedStock(null)} className="absolute top-10 right-10 p-3 hover:bg-slate-100 rounded-full transition-all"><X size={24}/></button>
             <div className="mono-text text-rose-500 text-xs font-black uppercase mb-12 tracking-widest italic">Confidential Alpha Report</div>
             <div className="flex flex-col lg:flex-row lg:items-baseline gap-6 mb-12">
               <h2 className="text-6xl lg:text-9xl font-black italic tracking-tighter uppercase">{selectedStock.stock_name}</h2>
               <span className="text-3xl font-bold text-slate-300 italic">{selectedStock.stock_code}</span>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
               <div className="space-y-8">
                 <div className="p-8 bg-slate-50 border-l-4 border-slate-900">
                   <div className="mono-text text-[10px] uppercase font-black mb-4 opacity-50">Strategic Logic</div>
                   <div className="text-2xl font-black italic">AI 建議：{selectedStock.ai_score && selectedStock.ai_score >= 85 ? "執行強烈買進" : "持續觀望"}</div>
                 </div>
                 <p className="text-xl lg:text-2xl text-slate-700 leading-relaxed font-medium italic">「{selectedStock.stock_name} 的 ROE ({selectedStock.roe}%) 表現極佳，且技術面上呈現出『{selectedStock.technical_signal}』。此為高度確定性之訊號。」</p>
               </div>
               <div className="grid grid-cols-2 gap-8 h-fit">
                  <div className="p-6 border border-slate-100">
                    <div className="mono-text text-[10px] uppercase font-black mb-2 opacity-50">AI Score</div>
                    <div className="text-4xl font-black italic">{selectedStock.ai_score}</div>
                  </div>
                  <button onClick={() => setSelectedStock(null)} className="col-span-2 py-6 bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-rose-500 transition-all">Dismiss</button>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
