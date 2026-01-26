
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw, X, Plus, ShieldAlert, CheckCircle2, ArrowRight, LogOut, Loader2,
  Sparkles, Quote
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

  // AI 狀態
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  /**
   * 1. 核心量化演算法引擎 (Single Source of Truth)
   * 集中管理所有訊號、顏色與理由，確保全站邏輯統一。
   */
  const calculateTradeSignal = useCallback((stock: DailyAnalysis) => {
    const score = stock.ai_score ?? 0;
    const roe = stock.roe ?? 0;
    const growth = stock.revenue_growth ?? 0;
    const technical = stock.technical_signal || "";
    
    // --- 嚴格邏輯防呆 (絕對禁止在 ROE <= 5 時稱讚獲利) ---
    if (roe <= 5) {
      if (score > 80) return { signal: "技術強基本弱", color: "slate" as const, reason: `獲利能力疲弱 (ROE ${roe}%)，目前的強勢可能源於短線籌碼炒作，建議謹慎。`, isAlert: false };
      return { signal: "觀望", color: "slate" as const, reason: `獲利低於門檻 (ROE ${roe}%)，基本面支撐力道不足，不具長期投資價值。`, isAlert: false };
    }

    // --- 賣出訊號 (Sell Logic) ---
    if (score < 60) return { signal: "建議賣出", color: "rose" as const, reason: "AI 總體評分不及格，趨勢指標轉弱，建議優先減碼避險。", isAlert: true };
    if (technical.includes("死亡交叉") || growth < -20) return { signal: "基本面惡化", color: "rose" as const, reason: "技術面出現空頭排列且營收顯著衰退，下行風險增加。", isAlert: true };

    // --- 買進訊號 (Buy Logic) ---
    if (score >= 85 && roe > 15 && growth > 15) {
      return { signal: "強力買進", color: "emerald" as const, reason: `成長動能極佳！ROE (${roe}%) 與營收同步成長，技術面呈現完美多頭。`, isAlert: false };
    }
    if (roe > 20) {
      return { signal: "績優選股", color: "emerald" as const, reason: `高獲利能力支撐 (ROE ${roe}%)，具備強大護城河，適合長期配置。`, isAlert: false };
    }

    return { signal: "中性/持股", color: "slate" as const, reason: "目前表現平穩，未觸發極端買賣訊號，建議按既定計畫持股。", isAlert: false };
  }, []);

  // Auth 監聽
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // 資料載入
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
   * 2. AI 深度解讀功能
   * 依照 Gemini 最新 SDK 規範調用
   */
  const handleAiInsight = async (stock: DailyAnalysis | DailyAnalysis[]) => {
    setIsAiLoading(true);
    setAiReport(null);
    setIsReportModalOpen(true);
    
    try {
      // 依照規範使用 process.env.API_KEY
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API });
      let prompt = "";

      if (Array.isArray(stock)) {
        // 生成今日戰報
        const top5 = stock.slice(0, 5).map(s => `${s.stock_name} (ROE: ${s.roe}%, AI分數: ${s.ai_score})`).join(', ');
        prompt = `你是首席投資分析師。根據今日前五名強勢股數據：${top5}，生成一份「CEO 晨間戰報」。內容需包含：1.今日市場主旋律。2.熱門產業洞察。3.具體的操作心法。請用繁體中文，語氣冷靜專業，排版如雜誌專欄。`;
      } else {
        // 單股深度解讀
        prompt = `請深度分析股票「${stock.stock_name}」。關鍵數據：ROE ${stock.roe}%，營收成長率 ${stock.revenue_growth}%，AI 評分 ${stock.ai_score}。請給出 3 點極具專業價值的操作洞察，並明確給出策略建議。請用繁體中文。`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      // 依照規範使用 .text 屬性 (不是方法)
      setAiReport(response.text);
    } catch (err) {
      console.error(err);
      setAiReport("分析引擎目前忙碌中或金鑰設定有誤，請檢查環境變數。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 3. 決策數據運算
  const decisionMatrix = useMemo(() => {
    const today = state.data;
    const topPick = today.length > 0 ? today.reduce((prev, curr) => (prev.ai_score! > curr.ai_score!) ? prev : curr) : null;
    
    const portfolioDetails = state.portfolio.map(item => {
      const market = today.find(d => d.stock_code === item.stock_code);
      const currentPrice = market?.close_price || item.buy_price;
      const profitLossPercent = ((currentPrice - item.buy_price) / item.buy_price) * 100;
      
      // 使用統一量化引擎
      const quant = market ? calculateTradeSignal(market) : { signal: "持股", color: "slate" as const, reason: "尚無今日數據", isAlert: false };

      return {
        ...item,
        currentPrice,
        aiScore: market?.ai_score || 0,
        returnPercent: profitLossPercent,
        quant,
        isAlert: quant.isAlert
      };
    });

    return { topPick, portfolioDetails, alerts: portfolioDetails.filter(p => p.isAlert) };
  }, [state.data, state.portfolio, calculateTradeSignal]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("註冊成功");
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
             <button onClick={() => handleAiInsight(state.data)} className="flex items-center gap-3 px-6 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-500 transition-all">
               <Sparkles size={18} /> 生成今日戰報
             </button>
             <button onClick={loadData} className="p-4 border-2 border-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all">
               <RefreshCw size={24} className={state.loading ? 'animate-spin' : ''} />
             </button>
             <button onClick={() => signOut()} className="p-4 border-2 border-slate-200 text-slate-300 rounded-full hover:border-rose-500 hover:text-rose-500 transition-all">
               <LogOut size={24} />
             </button>
          </div>
        </div>

        {/* Section A: Dashboard Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-32">
          <div className="bg-slate-900 text-white p-10 lg:p-16 flex flex-col justify-between">
            <div>
              <div className="mono-text text-[10px] uppercase text-slate-500 font-black mb-8 tracking-[0.4em]">今日首選 / TOP PICK</div>
              {decisionMatrix.topPick ? (
                <>
                  <h2 className="text-6xl lg:text-8xl font-black italic tracking-tighter mb-4">{decisionMatrix.topPick.stock_name}</h2>
                  <div className="text-2xl lg:text-3xl font-black text-emerald-400 mb-8 italic uppercase">強力買進 (Strong Buy)</div>
                  <p className="text-slate-400 text-lg lg:text-xl leading-relaxed italic max-w-md">
                    「{decisionMatrix.topPick.stock_name} ROE 指標卓越 ({decisionMatrix.topPick.roe}%)，配合高 AI 評分，是今日最強量化標的。」
                  </p>
                </>
              ) : <div className="animate-pulse text-slate-700">SCANNING...</div>}
            </div>
            <div className="mt-12 flex items-center gap-8">
               <button onClick={() => decisionMatrix.topPick && setSelectedStock(decisionMatrix.topPick)} className="px-8 py-4 bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all">數據詳情</button>
               <button onClick={() => decisionMatrix.topPick && handleAiInsight(decisionMatrix.topPick)} className="flex items-center gap-2 mono-text text-xs font-black uppercase tracking-widest hover:text-emerald-400">
                 <Sparkles size={14} /> AI 深度解讀
               </button>
            </div>
          </div>

          <div className="border-[6px] border-slate-900 p-10 lg:p-16 flex flex-col">
            <div className="mono-text text-[10px] uppercase text-slate-400 font-black mb-8 tracking-[0.4em]">庫存警戒 / ALERTS</div>
            <div className="space-y-8 flex-1">
              {decisionMatrix.alerts.length > 0 ? (
                decisionMatrix.alerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-6 group border-b border-slate-100 pb-6 last:border-0">
                    <div className="p-4 bg-rose-500 text-white"><ShieldAlert size={32} /></div>
                    <div>
                      <h4 className="text-3xl font-black italic uppercase tracking-tighter">{alert.stock_name}</h4>
                      <p className="text-rose-600 font-bold italic mt-2 uppercase">趨勢破壞：建議立即退場。</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-6 py-12">
                  <div className="p-4 bg-emerald-500 text-white"><CheckCircle2 size={32} /></div>
                  <div className="text-3xl font-black italic uppercase tracking-tighter">Status: Secure.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section B: Signal List */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-12 mono-text text-xs font-black uppercase tracking-[0.2em]">
             <button onClick={() => setActiveView('daily')} className={`pb-2 border-b-2 transition-all ${activeView === 'daily' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-300'}`}>每日信號</button>
             <button onClick={() => setActiveView('portfolio')} className={`pb-2 border-b-2 transition-all ${activeView === 'portfolio' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-300'}`}>我的庫存</button>
          </div>
          {activeView === 'portfolio' && (
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-3 text-xs font-black uppercase tracking-widest hover:text-rose-500 transition-all">
              <Plus size={16} /> 登記持股
            </button>
          )}
        </div>

        <div className="flex flex-col">
          {activeView === 'daily' ? (
            state.data.map(stock => {
              const quant = calculateTradeSignal(stock);
              return (
                <ActionCard 
                  key={stock.id} 
                  stock={stock}
                  quant={quant}
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
                    stock={{...market, stock_name: item.stock_name, stock_code: item.stock_code}} 
                    quant={item.quant}
                    isPortfolio 
                    returnPercent={item.returnPercent}
                    buyPrice={item.buy_price}
                    onSelect={() => setSelectedStock({...market, stock_name: item.stock_name, stock_code: item.stock_code})}
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
               <Sparkles size={16}/> 首席策略官簡報
            </div>
            {isAiLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6">
                <Loader2 size={48} className="animate-spin text-slate-200" />
                <p className="mono-text text-xs uppercase font-black text-slate-400">正在生成深度洞察...</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none">
                <Quote size={40} className="text-slate-100 fill-slate-100 mb-4" />
                <div className="text-xl lg:text-2xl font-medium italic text-slate-800 leading-relaxed whitespace-pre-wrap font-serif">
                  {aiReport}
                </div>
                <div className="mt-16 border-t pt-8 flex justify-end">
                   <button onClick={() => setIsReportModalOpen(false)} className="px-10 py-4 bg-slate-900 text-white font-black uppercase text-xs tracking-widest hover:bg-rose-500 transition-all">關閉簡報</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Position Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white p-12 relative shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-12">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">登記資產.</h2>
                <button onClick={() => setIsAddModalOpen(false)}><X size={24}/></button>
             </div>
             <div className="space-y-8">
                <input type="text" placeholder="代碼 (e.g. 2330)" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.code} onChange={e => setNewHolding({...newHolding, code: e.target.value})} />
                <input type="text" placeholder="名稱" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.name} onChange={e => setNewHolding({...newHolding, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-8">
                    <input type="number" placeholder="成本價" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.price} onChange={e => setNewHolding({...newHolding, price: e.target.value})} />
                    <input type="number" placeholder="股數" className="w-full border-b-2 border-slate-900 py-3 text-2xl font-black outline-none bg-transparent" value={newHolding.qty} onChange={e => setNewHolding({...newHolding, qty: e.target.value})} />
                </div>
                <button onClick={async () => {
                  if (!newHolding.code || !newHolding.name) return;
                  await addToPortfolio(newHolding.code, newHolding.name, Number(newHolding.price), Number(newHolding.qty));
                  setIsAddModalOpen(false);
                  loadData();
                }} className="w-full py-6 bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-emerald-500 transition-all">確認加入</button>
             </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-6 bg-slate-900/60 backdrop-blur-xl overflow-y-auto">
           <div className="w-full max-w-4xl bg-white p-10 lg:p-20 relative shadow-2xl animate-in fade-in zoom-in-95 duration-300 my-8">
             <button onClick={() => setSelectedStock(null)} className="absolute top-10 right-10 p-3 hover:bg-slate-100 rounded-full transition-all"><X size={24}/></button>
             <div className="flex flex-col lg:flex-row lg:items-baseline gap-6 mb-12">
               <h2 className="text-6xl lg:text-9xl font-black italic tracking-tighter uppercase">{selectedStock.stock_name}</h2>
               <span className="text-3xl font-bold text-slate-300 italic">{selectedStock.stock_code}</span>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
               <div className="space-y-8">
                 <div className="p-8 bg-slate-50 border-l-4 border-slate-900">
                   <div className="mono-text text-[10px] uppercase font-black mb-4 opacity-50">本地量化訊號</div>
                   <div className="text-2xl font-black italic">{calculateTradeSignal(selectedStock).reason}</div>
                 </div>
                 <div className="grid grid-cols-2 gap-8">
                    <div className="p-6 border border-slate-100">
                      <div className="mono-text text-[10px] uppercase font-black mb-2 opacity-50">ROE 指數</div>
                      <div className="text-4xl font-black italic">{selectedStock.roe}%</div>
                    </div>
                    <div className="p-6 border border-slate-100">
                      <div className="mono-text text-[10px] uppercase font-black mb-2 opacity-50">AI 評分</div>
                      <div className="text-4xl font-black italic">{selectedStock.ai_score}</div>
                    </div>
                 </div>
               </div>
               <div className="flex flex-col h-full justify-between">
                  <div className="bg-slate-900 text-white p-8 mb-8 border border-slate-700">
                    <div className="flex items-center gap-2 mb-6">
                      <Sparkles size={16} className="text-emerald-400" />
                      <span className="mono-text text-[10px] uppercase font-black tracking-widest">AI 分析官推薦</span>
                    </div>
                    <p className="text-sm italic leading-relaxed text-slate-400">獲取 Gemini 3 模型的深度策略報告，包含買賣點位與未來展望。</p>
                    <button onClick={() => handleAiInsight(selectedStock)} className="mt-8 px-6 py-3 bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all">獲取深度分析</button>
                  </div>
                  <button onClick={() => setSelectedStock(null)} className="w-full py-6 bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-rose-500 transition-all">關閉視窗</button>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
