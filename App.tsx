
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, Zap, Trophy, Compass, Filter, CheckCircle2, Loader2, Target, LogOut, TrendingUp, Sparkles
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { StockDetailModal } from './components/StockDetailModal';
import { GoogleGenAI } from "@google/genai";

type FilterMode = 'all' | 'quality' | 'growth' | 'value' | 'profitable';

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
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  
  // AI 狀態
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!session) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
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

  // Gemini AI 分析邏輯
  const generateStockReport = async (stock: DailyAnalysis) => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    setAiReport(null);

    try {
      // Initialize GoogleGenAI with the API key from environment variables.
      // Guidelines: Always use a new instance before call to ensure up-to-date config.
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API });
      const response = await ai.models.generateContent({
        // Guidelines: Using 'gemini-3-pro-preview' for complex text tasks such as stock strategic evaluation.
        model: 'gemini-3-pro-preview',
        contents: `
          你是資深財經分析師。請分析這檔股票：${stock.stock_name} (${stock.stock_code})
          當前數據：
          - 價格：${stock.close_price}
          - AI 評分：${stock.ai_score}
          - ROE：${stock.roe}%
          - 營收 YoY：${stock.revenue_yoy}%
          - 訊號：${stock.trade_signal}
          
          請提供繁體中文簡報，包含：
          1. 核心評價與戰略地位。
          2. 進出場建議與風險提示。
          語氣要專業果斷。約 150 字。
        `,
      });
      // Guidelines: Access response.text as a property, not a method.
      setAiReport(response.text || "無法生成報告。");
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      setAiReport("⚠️ AI 連線異常或 API 額度限制。");
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredList = useMemo(() => {
    const list = state.data.filter(s => s.stock_code !== 'MARKET_BRIEF');
    switch (filterMode) {
      case 'quality': return list.filter(s => (s.roe || 0) > 15);
      case 'growth': return list.filter(s => (s.revenue_yoy || 0) > 20);
      case 'profitable': return list.filter(s => s.ai_score >= 85);
      default: return list;
    }
  }, [state.data, filterMode]);

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] p-6">
      <div className="w-full max-w-[400px] bg-white p-10 shadow-2xl rounded-[2.5rem] text-center border border-slate-50">
        <div className="bg-slate-950 w-16 h-16 rounded-3xl flex items-center justify-center text-white mx-auto mb-10 shadow-xl">
          <Zap fill="currentColor" size={24} />
        </div>
        <h1 className="text-3xl font-black mb-10 italic tracking-tight">Alpha Ledger.</h1>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setAuthLoading(true);
          setAuthError('');
          try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
          } catch (err: any) { setAuthError("登入失敗，請檢查憑證或 API 設定。"); }
          finally { setAuthLoading(false); }
        }} className="space-y-5">
          <input type="email" placeholder="授權信箱" required className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-slate-200" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="密鑰" required className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-slate-200" value={password} onChange={e => setPassword(e.target.value)} />
          {authError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest">{authError}</p>}
          <button type="submit" disabled={authLoading} className="w-full py-5 bg-slate-950 text-white font-black text-xs uppercase tracking-widest rounded-2xl active-scale disabled:opacity-50">
            {authLoading ? '驗證中...' : '進入終端'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-24 sm:pb-10">
      {/* 桌面版導航 */}
      <nav className="sticky top-0 z-[100] bg-white/80 border-b border-slate-100 px-6 sm:px-10 py-5 flex justify-between items-center backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-slate-950 p-2.5 rounded-xl text-white shadow-lg"><Zap size={18} fill="currentColor" /></div>
          <h1 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase">Alpha Ledger.</h1>
        </div>
        <div className="hidden sm:flex items-center gap-10">
           <button onClick={() => setActiveView('daily')} className={`text-xs font-black uppercase tracking-widest transition-colors ${activeView === 'daily' ? 'text-slate-950 underline underline-offset-8' : 'text-slate-300 hover:text-slate-400'}`}>市場掃描</button>
           <button onClick={() => setActiveView('portfolio')} className={`text-xs font-black uppercase tracking-widest transition-colors ${activeView === 'portfolio' ? 'text-slate-950 underline underline-offset-8' : 'text-slate-300 hover:text-slate-400'}`}>資產金庫</button>
           <button onClick={() => signOut()} className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 hover:text-rose-500"><LogOut size={12}/> 登出</button>
        </div>
      </nav>

      {/* 手機版底欄導航 */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[110] bg-white/95 border-t border-slate-100 px-10 py-5 flex justify-around backdrop-blur-xl shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
        <button onClick={() => setActiveView('daily')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeView === 'daily' ? 'text-slate-950' : 'text-slate-400'}`}>
          <Compass size={22} strokeWidth={activeView === 'daily' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Radar</span>
        </button>
        <button onClick={() => setActiveView('portfolio')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeView === 'portfolio' ? 'text-slate-950' : 'text-slate-400'}`}>
          <Target size={22} strokeWidth={activeView === 'portfolio' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Vault</span>
        </button>
      </div>

      <main className="max-w-[1200px] mx-auto px-5 sm:px-8 py-6 sm:py-10">
        <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} />

        {activeView === 'daily' && (
          <div className="mb-8 overflow-x-auto scrollbar-hide -mx-5 px-5">
            <div className="flex items-center gap-3 w-max">
              {[
                { id: 'all', label: '全部標的', icon: <Filter size={14}/> },
                { id: 'quality', label: '品質因子', icon: <Trophy size={14}/> },
                { id: 'growth', label: '成長因子', icon: <Zap size={14}/> },
                { id: 'profitable', label: '高分嚴選', icon: <CheckCircle2 size={14}/> },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterMode(f.id as FilterMode)}
                  className={`px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active-scale
                    ${filterMode === f.id ? 'bg-slate-950 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-400 border border-slate-100'}
                  `}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
           <div className="flex justify-between items-center px-1">
             <h2 className="text-xl sm:text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
               {activeView === 'daily' ? 'Market Radar' : 'Vault Assets'}
               {activeView === 'daily' && <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">{filteredList.length} 件</span>}
             </h2>
             {state.loading && <Loader2 className="animate-spin text-slate-300" size={20} />}
           </div>

           {state.error && (
             <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl text-rose-500 text-xs font-bold text-center">
               ⚠️ 數據加載錯誤: {state.error}
             </div>
           )}

           <div className="grid grid-cols-1 gap-5">
              {(activeView === 'daily' ? filteredList : state.portfolio).map((item: any) => (
                <ActionCard 
                  key={item.stock_code || item.id} 
                  stock={activeView === 'daily' ? item : {...item, trade_signal: 'INVEST_HOLD', ai_score: 100}} 
                  history={[]} 
                  onSelect={() => {
                    setSelectedStock(item);
                    setAiReport(null);
                  }} 
                />
              ))}
           </div>

           {!state.loading && !state.error && (activeView === 'daily' ? filteredList : state.portfolio).length === 0 && (
             <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-[0.2em] border-2 border-dashed border-slate-100 rounded-[3rem]">
               無匹配標的資料
             </div>
           )}
        </div>
      </main>

      {selectedStock && (
        <StockDetailModal 
          stock={selectedStock} 
          onClose={() => setSelectedStock(null)} 
          onRunAi={() => generateStockReport(selectedStock)}
          aiReport={aiReport}
          isAiLoading={isAiLoading}
        />
      )}
    </div>
  );
};

export default App;
