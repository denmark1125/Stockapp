
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw, X, Plus, ShieldAlert, CheckCircle2, ArrowRight, LogOut, Loader2,
  Sparkles, Quote, AlertTriangle
} from 'lucide-react';
import { DashboardState, DailyAnalysis, PortfolioItem } from './types';
import { fetchDailyAnalysis, fetchPortfolio, addToPortfolio, deleteFromPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { GoogleGenAI } from "@google/genai";
import { format } from 'date-fns';

// 修正 App 元件：補全被截斷的邏輯、回傳 JSX 並導出元件
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

  // 監聽 Auth 狀態
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 載入儀表板資料
  const loadData = useCallback(async () => {
    if (!session) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const [analysis, portfolio] = await Promise.all([
        fetchDailyAnalysis(),
        fetchPortfolio()
      ]);
      setState({
        data: analysis,
        portfolio: portfolio,
        loading: false,
        error: null,
        lastUpdated: new Date(),
        topPickCode: analysis[0]?.stock_code || null
      });
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, loadData]);

  /**
   * 1. 核心量化演算法引擎 - 實作「一票否決」安全機制 (Veto System)
   * 確保投資建議 100% 基於真實數據，防止誤導。
   */
  const calculateTradeSignal = useCallback((stock: DailyAnalysis) => {
    const score = stock.ai_score ?? 0;
    const roe = stock.roe ?? 0;
    const growth = stock.revenue_growth ?? 0;
    const technical = stock.technical_signal || "";
    
    const hasFundamentalData = stock.roe !== undefined && stock.revenue_growth !== undefined;
    
    // --- 數據缺失處理 ---
    if (!hasFundamentalData) {
      return { 
        signal: "數據缺失", 
        color: "slate" as const, 
        reason: "基本面數據不足（ROE/營收增長缺失），建議僅作技術面極短線參考。", 
        isAlert: false, 
        isAnomaly: true 
      };
    }

    // --- 一票否決 (Veto System)：禁止誤導 ---
    // ROE <= 0 絕對禁止顯示強力買進
    if (roe <= 0) {
      return { 
        signal: "觀察中", 
        color: "slate" as const, 
        reason: `獲利能力喪失 (ROE ${roe}%)。目前不具備買進資格，無論評分多高，需等待基本面改善。`, 
        isAlert: false, 
        isAnomaly: true 
      };
    }

    // --- 風險降級：ROE <= 5% 判定為短線炒作，無視 AI 分數 ---
    if (roe <= 5) {
      return { 
        signal: "短線警告", 
        color: "slate" as const, 
        reason: `獲利體質薄弱 (ROE ${roe}%)。目前強勢純屬技術面炒作，長期配置風險極高。`, 
        isAlert: false, 
        isAnomaly: true 
      };
    }

    // --- 賣出訊號 (Sell Logic) ---
    if (score < 60 || growth < -20 || technical.includes("死亡交叉")) {
      return { 
        signal: "建議賣出", 
        color: "rose" as const, 
        reason: growth < -20 ? "營收出現顯著衰退，基本面支撐力道已崩潰。" : "AI 綜合評價低於安全門檻，技術趨勢已轉弱。", 
        isAlert: true, 
        isAnomaly: false 
      };
    }

    // --- 買進訊號 (Buy Logic) ---
    if (score >= 85 && roe > 15 && growth > 15) {
      return { 
        signal: "強力買進", 
        color: "emerald" as const, 
        reason: "基本面與技術面雙重共振。高獲利能力與高成長動能契合，動能強勁。", 
        isAlert: false, 
        isAnomaly: false 
      };
    }

    if (roe > 15) {
      return { 
        signal: "績優持有", 
        color: "emerald" as const, 
        reason: `獲利能力卓越 (ROE ${roe}%)，具備長期穩定投資價值。`, 
        isAlert: false, 
        isAnomaly: false 
      };
    }

    return { 
      signal: "中性", 
      color: "slate" as const, 
      reason: "數據表現平穩，未見極端交易信號。建議按計畫持股，分批佈局。", 
      isAlert: false, 
      isAnomaly: false 
    };
  }, []);

  /**
   * 2. AI 深度報告 - 批判性 Prompt 與最新 SDK 規範
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
        // 生成戰略簡報
        const top5 = stock.slice(0, 5).map(s => `${s.stock_name} (ROE: ${s.roe}%, 分數: ${s.ai_score})`).join(', ');
        prompt = `
          你是首席投資策略師。根據今日強勢股數據：${top5}。
          特別指令：
          1. 批判性審查：若發現 ROE 低於 5% 卻榜上有名，務必批判性指出這是投機風險，而非基本面增長。
          2. 市場分析：分析數據背後的邏輯是否矛盾。
          3. 語氣冷靜且專業，直接向 CEO 報告今日戰局。
          請用繁體中文。
        `;
      } else {
        // 單股深度解讀
        prompt = `
          請深度解讀股票「${stock.stock_name}」。
          當前指標：ROE ${stock.roe}%，營收成長率 ${stock.revenue_growth}%，AI 評分 ${stock.ai_score}，技術信號：${stock.technical_signal}。
          
          批判性指令：
          1. 數據審核：若數據異常（如 ROE 為 0 或營收負成長但評分卻高），務必揭露這可能是「拉高出貨 (Pump and Dump)」的風險。
          2. 現實核查：若 ROE 低於 5%，請嚴厲提醒 CEO 該公司缺乏獲利體質。
          3. 決策建議：提供 3 個基於數據的具體執行點。
          請用繁體中文，格式請簡明扼要且專業。
        `;
      }

      // 依照規範使用 ai.models.generateContent
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      // 依照規範使用 .text 屬性
      setAiReport(response.text || "無法獲取 AI 分析報告。");
    } catch (err) {
      console.error(err);
      setAiReport("分析系統暫時離線。請確認 API 金鑰有效性並重試。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 3. 決策矩陣運算 (動態文案判定)
  const decisionMatrix = useMemo(() => {
    const today = state.data;
    const topPick = today.length > 0 ? today.reduce((prev, curr) => ((prev.ai_score || 0) > (curr.ai_score || 0)) ? prev : curr) : null;
    
    // 動態文案判定
    const getTopPickLabel = (s: DailyAnalysis | null) => {
      if (!s) return "掃描中...";
      if (s.roe === undefined) return "技術面驅動分析";
      if (s.roe > 15) return "獲利能力頂尖";
      if (s.roe >= 5) return "基本面穩健";
      return "數據異常/投機風險警告";
    };

    const portfolioDetails = state.portfolio.map(item => {
      const market = today.find(d => d.stock_code === item.stock_code);
      const currentPrice = market?.close_price || item.buy_price;
      const profitLossPercent = ((currentPrice - item.buy_price) / item.buy_price) * 100;
      
      // 使用統一量化引擎
      const quant = market ? calculateTradeSignal(market) : { signal: "持股", color: "slate" as const, reason: "尚無數據", isAlert: false, isAnomaly: false };

      return {
        ...item,
        currentPrice,
        aiScore: market?.ai_score || 0,
        returnPercent: profitLossPercent,
        quant,
        isAlert: quant.isAlert
      };
    });

    return { 
      topPick, 
      topPickLabel: getTopPickLabel(topPick),
      portfolioDetails, 
      alerts: portfolioDetails.filter(p => p.isAlert) 
    };
  }, [state.data, state.portfolio, calculateTradeSignal]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('註冊成功！請至信箱收取驗證信。');
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

  const handleAddToPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addToPortfolio(newHolding.code, newHolding.name, Number(newHolding.price), Number(newHolding.qty));
      setIsAddModalOpen(false);
      setNewHolding({ code: '', name: '', price: '', qty: '' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-sm shadow-2xl p-8 border border-slate-200">
          <div className="flex items-center gap-2 mb-8">
            <ShieldAlert className="text-slate-900" size={32} />
            <h1 className="text-2xl font-black italic tracking-tighter uppercase">Quantum AI Advisor</h1>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-900 transition-all text-sm font-medium" 
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-900 transition-all text-sm font-medium" 
                required 
              />
            </div>
            {authError && <p className="text-rose-600 text-xs font-bold">{authError}</p>}
            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full bg-slate-900 text-white py-4 font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="animate-spin" /> : (authMode === 'login' ? 'Login' : 'Sign Up')}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-all"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 selection:bg-slate-900 selection:text-white font-sans">
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert size={28} className="text-slate-900" />
          <div className="flex flex-col">
            <span className="text-xl font-black italic tracking-tighter uppercase leading-none">Quantum AI</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Decision Matrix v2.5</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-rose-600 transition-all"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 rounded-sm p-10 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-all duration-700">
              <Sparkles size={120} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-widest">
                  今日最佳首選
                </span>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  {decisionMatrix.topPickLabel}
                </span>
              </div>
              <h2 className="text-5xl lg:text-7xl font-black italic tracking-tighter uppercase mb-2">
                {decisionMatrix.topPick?.stock_name || '掃描中'}
              </h2>
              <div className="flex items-center gap-6 mb-8">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase">AI Score</span>
                  <span className="text-3xl font-black">{decisionMatrix.topPick?.ai_score || 0}</span>
                </div>
                <div className="flex flex-col border-l border-slate-700 pl-6">
                  <span className="text-[9px] font-black text-slate-500 uppercase">ROE</span>
                  <span className="text-3xl font-black">{decisionMatrix.topPick?.roe || 0}%</span>
                </div>
              </div>
              <button 
                onClick={() => decisionMatrix.topPick && handleAiInsight(decisionMatrix.topPick)}
                className="bg-white text-slate-900 px-8 py-4 text-xs font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2"
              >
                獲取深度分析 <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <CheckCircle2 size={14} /> 策略概覽
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">警示標的</div>
                  <div className="text-4xl font-black text-rose-600">{decisionMatrix.alerts.length}</div>
                </div>
                <button 
                  onClick={() => handleAiInsight(state.data)}
                  className="text-[10px] font-black uppercase text-slate-900 underline underline-offset-4 hover:text-emerald-500 transition-all"
                >
                  生成全市場戰報
                </button>
              </div>
            </div>
            <div className="pt-8 border-t border-slate-100 flex items-center justify-between text-[9px] font-black uppercase text-slate-400">
              <span>Last Sync: {state.lastUpdated ? format(state.lastUpdated, 'HH:mm:ss') : '--:--'}</span>
              <button onClick={loadData} className="hover:text-slate-900 transition-all flex items-center gap-1">
                <RefreshCw size={10} /> Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12 mb-10 border-b border-slate-200">
          <button 
            onClick={() => setActiveView('daily')}
            className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeView === 'daily' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-400'}`}
          >
            每日 AI 市場分析
            {activeView === 'daily' && <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-900" />}
          </button>
          <button 
            onClick={() => setActiveView('portfolio')}
            className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeView === 'portfolio' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-400'}`}
          >
            我的投資組合 ({state.portfolio.length})
            {activeView === 'portfolio' && <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-900" />}
          </button>
        </div>

        {state.loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-slate-200" size={48} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">系統運算中...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {activeView === 'daily' ? (
              state.data.map((stock) => (
                <ActionCard 
                  key={stock.id} 
                  stock={stock} 
                  quant={calculateTradeSignal(stock)}
                  onSelect={() => handleAiInsight(stock)}
                />
              ))
            ) : (
              <>
                <div className="flex justify-end mb-6">
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all"
                  >
                    <Plus size={14} /> 新增持股
                  </button>
                </div>
                {decisionMatrix.portfolioDetails.map((item) => (
                  <div key={item.id} className="relative group">
                    <button 
                      onClick={() => deleteFromPortfolio(item.id).then(loadData)}
                      className="absolute -top-2 -right-2 z-10 bg-white border border-slate-200 text-slate-300 hover:text-rose-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={14} />
                    </button>
                    <ActionCard 
                      stock={{
                        ...state.data.find(d => d.stock_code === item.stock_code)!,
                        stock_name: item.stock_name,
                        stock_code: item.stock_code
                      } as DailyAnalysis}
                      quant={item.quant}
                      isPortfolio
                      buyPrice={item.buy_price}
                      returnPercent={item.returnPercent}
                      onSelect={() => {
                        const market = state.data.find(d => d.stock_code === item.stock_code);
                        if (market) handleAiInsight(market);
                      }}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>

      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl rounded-sm">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 flex items-center justify-center">
                  <Quote size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter">AI 決策深度報告</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generative Analysis by Gemini</p>
                </div>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-300 hover:text-slate-900 transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="animate-spin text-slate-200" size={48} />
                  <p className="text-[10px] font-black uppercase text-slate-400 animate-pulse">正在生成批判性見解...</p>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none prose-sm lg:prose-base">
                  <div className="bg-slate-50 border-l-4 border-slate-900 p-6 mb-8 italic text-slate-600 font-medium text-sm">
                    本報告由 AI 策略師生成。投資涉及風險，數據僅供決策參考，不構成法律建議。
                  </div>
                  <div className="whitespace-pre-wrap font-medium leading-relaxed text-slate-800">
                    {aiReport}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsReportModalOpen(false)}
                className="bg-slate-900 text-white px-10 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                確認並返回
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md shadow-2xl rounded-sm p-8 border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black italic uppercase tracking-tighter">新增持股明細</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-300 hover:text-slate-900">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddToPortfolio} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">代碼</label>
                  <input 
                    type="text" 
                    placeholder="2330.TW"
                    value={newHolding.code} 
                    onChange={e => setNewHolding({ ...newHolding, code: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-900 transition-all text-sm font-bold uppercase" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">名稱</label>
                  <input 
                    type="text" 
                    placeholder="台積電"
                    value={newHolding.name} 
                    onChange={e => setNewHolding({ ...newHolding, name: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-900 transition-all text-sm font-bold" 
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">成本價</label>
                  <input 
                    type="number" 
                    value={newHolding.price} 
                    onChange={e => setNewHolding({ ...newHolding, price: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-900 transition-all text-sm font-bold" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">股數</label>
                  <input 
                    type="number" 
                    value={newHolding.qty} 
                    onChange={e => setNewHolding({ ...newHolding, qty: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-900 transition-all text-sm font-bold" 
                    required 
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full bg-slate-900 text-white py-4 text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all"
              >
                確認加入投資組合
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
