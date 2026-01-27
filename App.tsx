
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw, X, ShieldAlert, ArrowRight, Loader2,
  Sparkles, Quote, BookOpen, Target, Globe, PieChart, Activity, FileText
} from 'lucide-react';
import { DashboardState, DailyAnalysis, TradeSignal } from './types';
import { fetchDailyAnalysis, fetchPortfolio, addToPortfolio, deleteFromPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { StockDetailModal } from './components/StockDetailModal';
import { GoogleGenAI } from "@google/genai";
import { format } from 'date-fns';

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

  /**
   * 股號自動偵測邏輯
   */
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
    const roe = stock.roe ?? 0;
    const rev = stock.revenue_growth ?? 0;
    const tags: string[] = [];

    if (score >= 80) tags.push("資優生");
    if (roe >= 15) tags.push("高獲利");
    if (rev >= 25) tags.push("營收爆發");
    if (stock.pe_ratio && stock.pe_ratio > 0 && stock.pe_ratio < 12) tags.push("低估值");

    if (isPortfolioItem && buyPrice) {
      const dropPercent = ((stock.close_price - buyPrice) / buyPrice) * 100;
      if (dropPercent <= -5) { 
        return { 
          signal: "賣出 SELL", color: "rose", 
          reason: `跌幅 ${dropPercent.toFixed(1)}% 已觸發紀律止損。`, 
          isAlert: true, trend: 'down', tags: ["立即止損"]
        };
      }
    }

    if (score >= 78 && roe > 5) {
      return { 
        signal: isPortfolioItem ? "加碼 ADD" : "買入 BUY", 
        color: "emerald", 
        reason: `動能強勁且獲利穩定，適合${isPortfolioItem ? '擴大倉位' : '建立頭寸'}。`, 
        isAlert: false, trend: 'up', tags
      };
    }

    return { 
      signal: isPortfolioItem ? "續抱 HOLD" : "觀望 WAIT", 
      color: "slate", 
      reason: "動能平庸或估值合理，目前缺乏顯著的獲利邊際。", 
      isAlert: false, trend: 'stable', tags: []
    };
  }, []);

  const handleAiInsight = async (stock: DailyAnalysis | DailyAnalysis[]) => {
    setIsAiLoading(true);
    setAiReport(null);
    setIsReportModalOpen(true);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const today = format(new Date(), 'yyyy年MM月dd日 HH:mm');
      let prompt = "";
      let systemInstruction = "你是台股價值投資審計大師，語氣精煉、毒舌且富有巴菲特的智慧。請直接給出結論，拒絕廢話。";

      if (Array.isArray(stock)) {
        const dataStr = stock.slice(0, 5).map(s => `[${s.stock_name} | ROE:${s.roe}% | AI:${s.ai_score}]`).join('\n');
        prompt = `當前時間：**${today}**。\n\n分析當前優選名單：\n${dataStr}\n
        請撰寫「巴菲特台股研報」：
        1. 【宏觀判斷】：反映了什麼樣的產業題材？
        2. 【護城河選股】：選出一檔進行點評。
        3. 【地雷警示】：對名單中的弱點進行批評。
        4. 【股神箴言】：給予 CEO 的策略指令。`;
      } else {
        prompt = `當前時間：${today}。分析標的：${stock.stock_name}。數據：ROE ${stock.roe}%, 營收 ${stock.revenue_growth}%, AI ${stock.ai_score}。給出審計報告。`;
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
      const latestDataDate = marketData.length > 0 ? new Date(marketData[0].updated_at) : new Date();
      setState({ 
        data: marketData, 
        portfolio: portfolioData, 
        loading: false, 
        error: null, 
        lastUpdated: latestDataDate, 
        topPickCode: marketData[0]?.stock_code || null 
      });
    } catch (err: any) { 
      setState(prev => ({ ...prev, loading: false, error: err.message })); 
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const decisionMatrix = useMemo(() => {
    const cleanData = [...state.data].filter(s => (s.roe ?? -100) > -99).sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));
    const topPick = cleanData.find(s => s.ai_score >= 80) || null;
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
    return { cleanData, topPick, portfolioDetails };
  }, [state.data, state.portfolio, calculateTradeSignal]);

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] p-4">
      <div className="w-full max-w-[360px] bg-white p-8 border border-slate-200 shadow-xl rounded-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-slate-950">Alpha Ledger.</h1>
        </div>
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
          <button type="submit" disabled={authLoading} className="w-full py-5 bg-slate-950 text-white font-black text-[11px] uppercase tracking-[0.4em]">
            {authLoading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-950 font-['Space_Grotesk']">
      <nav className="sticky top-0 z-50 bg-white/95 border-b border-slate-200 px-6 py-5 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <BookOpen size={20} />
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Taiwan Alpha Ledger.</h1>
        </div>
        <button onClick={() => signOut()} className="text-[10px] font-black uppercase text-slate-400 hover:text-rose-600">Terminate</button>
      </nav>

      <main className="max-w-[1100px] mx-auto px-6 py-10">
        <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} />

        {/* 恢復：本日首選區 與 市場情緒 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <div className="lg:col-span-2 bg-white p-8 lg:p-12 border border-slate-200 shadow-2xl relative overflow-hidden group rounded-sm">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Sparkles size={120} />
            </div>
            {decisionMatrix.topPick ? (
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <span className="bg-slate-950 text-white text-[10px] font-black uppercase px-3 py-1 tracking-[0.3em]">今日權重首選 TOP PICK</span>
                  <span className="mono-text text-[11px] text-slate-400 font-bold uppercase tracking-widest">{format(new Date(), 'yyyy / MM / dd')}</span>
                </div>
                <h2 className="text-5xl lg:text-6xl font-black italic tracking-tighter uppercase mb-10 text-slate-950 leading-none">
                  {decisionMatrix.topPick.stock_name}
                </h2>
                <div className="grid grid-cols-3 gap-12 mb-10 border-y border-slate-100 py-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">獲利效率 ROE</p>
                    <p className="text-3xl font-black">{decisionMatrix.topPick.roe === null || decisionMatrix.topPick.roe <= 0 ? '虧損' : `${decisionMatrix.topPick.roe}%`}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">AI 動能 SCORE</p>
                    <p className="text-3xl font-black text-emerald-600">{decisionMatrix.topPick.ai_score}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">成交價格 PRICE</p>
                    <p className="text-3xl font-black truncate">${decisionMatrix.topPick.close_price}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStock(decisionMatrix.topPick)} className="w-full md:w-auto bg-slate-950 text-white px-10 py-5 text-[12px] font-black uppercase tracking-[0.4em] hover:bg-emerald-600 transition-all flex items-center justify-center gap-4 shadow-xl active:scale-95">
                  獲取深度審計報告 <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div className="py-24 text-center">
                 <Loader2 size={40} className="animate-spin text-slate-100 mx-auto mb-4" />
                 <p className="mono-text text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">市場深度掃描中 Scanning Assets...</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
             <div className="bg-white p-8 border border-slate-200 shadow-xl flex-1 rounded-sm flex flex-col justify-between">
                <div>
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 flex items-center gap-2"><Globe size={16} /> 市場情緒 SENTIMENT</h3>
                   <div className="space-y-5">
                      <div className="flex justify-between border-b border-slate-50 pb-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">當前風險級別</span>
                        <span className="text-[11px] font-black text-emerald-500 uppercase">低 Low</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 pb-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">主流導向</span>
                        <span className="text-[11px] font-black text-slate-950 uppercase">高效率資本</span>
                      </div>
                   </div>
                </div>
                <button onClick={() => handleAiInsight(decisionMatrix.cleanData)} className="w-full py-5 mt-10 border-2 border-slate-950 text-[11px] font-black uppercase tracking-[0.3em] hover:bg-slate-950 hover:text-white transition-all">
                  生成宏觀研報 MACRO
                </button>
             </div>
          </div>
        </div>

        <div className="flex gap-12 mb-8 border-b-2 border-slate-200/50 pb-2">
          <button onClick={() => setActiveView('daily')} className={`text-[12px] font-black uppercase tracking-[0.3em] pb-4 relative ${activeView === 'daily' ? 'text-slate-950' : 'text-slate-300'}`}>
            MARKET
            {activeView === 'daily' && <div className="absolute bottom-[-2px] left-0 w-full h-[4px] bg-slate-950"></div>}
          </button>
          <button onClick={() => setActiveView('portfolio')} className={`text-[12px] font-black uppercase tracking-[0.3em] pb-4 relative ${activeView === 'portfolio' ? 'text-slate-950' : 'text-slate-300'}`}>
            VAULT ({state.portfolio.length})
            {activeView === 'portfolio' && <div className="absolute bottom-[-2px] left-0 w-full h-[4px] bg-slate-950"></div>}
          </button>
          <div className="ml-auto flex gap-4">
            {activeView === 'portfolio' && <button onClick={() => setIsAddModalOpen(true)} className="px-6 py-2 bg-slate-950 text-white text-[10px] font-black uppercase">ADD ASSET</button>}
            <button onClick={loadData} className="p-2 border border-slate-200 text-slate-400 hover:text-slate-950">
              <RefreshCw size={18} className={state.loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          {activeView === 'daily' ? (
            decisionMatrix.cleanData.map(stock => (
              <ActionCard key={stock.id} stock={stock} quant={calculateTradeSignal(stock)} onSelect={() => setSelectedStock(stock)} />
            ))
          ) : (
            decisionMatrix.portfolioDetails.map(item => (
              <div key={item.id} className="relative group">
                <button onClick={() => deleteFromPortfolio(item.id).then(loadData)} className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-3 text-rose-500 hover:bg-rose-50 rounded-full transition-all">
                  <X size={20} />
                </button>
                {item.marketData ? (
                  <ActionCard 
                    stock={item.marketData} 
                    quant={item.quant!} 
                    isPortfolio 
                    buyPrice={item.buy_price}
                    returnPercent={item.returnPercent} 
                    onSelect={() => setSelectedStock(item.marketData!)} 
                  />
                ) : (
                  <div className="p-8 bg-slate-50 text-slate-300 text-[11px] font-black uppercase text-center border-2 border-dashed">正在同步市場現價...</div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {selectedStock && (
        <StockDetailModal 
          stock={selectedStock} 
          onClose={() => setSelectedStock(null)} 
          onRunAi={(stock) => {
            setSelectedStock(null);
            handleAiInsight(stock);
          }} 
        />
      )}

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/20 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-white p-10 relative shadow-2xl overflow-y-auto max-h-[90vh] rounded-sm border border-slate-200">
            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-8 right-8 p-2.5 hover:bg-slate-100 rounded-full"><X size={24}/></button>
            <div className="text-center mb-16 border-b-4 border-slate-950 pb-10 uppercase">
              <h3 className="text-4xl font-black italic mb-3">Audit Report</h3>
              <p className="text-[11px] text-slate-400 font-black tracking-widest">The Ledger Insights | Confidential</p>
            </div>
            {isAiLoading ? (
              <div className="flex flex-col items-center py-24 gap-6">
                <Loader2 size={48} className="animate-spin text-slate-100" />
                <p className="text-[10px] font-black tracking-[0.5em] text-slate-300">Generating Insights...</p>
              </div>
            ) : (
              <div className="max-w-[640px] mx-auto serif-text text-lg italic leading-relaxed whitespace-pre-wrap">
                {aiReport}
              </div>
            )}
          </div>
        </div>
      )}

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
                    type="text" placeholder="2330" required 
                    className="w-full border-b-2 border-slate-100 py-3 text-2xl font-black outline-none focus:border-slate-950 uppercase" 
                    value={newHolding.code} 
                    onChange={e => setNewHolding({...newHolding, code: e.target.value})} 
                    onBlur={() => fetchStockName(newHolding.code)}
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium italic">點擊空白處自動帶入中文名稱</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">資產名稱 NAME</label>
                  <input 
                    type="text" placeholder="台積電" required 
                    className="w-full border-b-2 border-slate-100 py-3 text-2xl font-black outline-none focus:border-slate-950" 
                    value={newHolding.name} 
                    onChange={e => setNewHolding({...newHolding, name: e.target.value})} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-10">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">買入價格 BUY</label>
                      <input type="number" step="0.01" required className="w-full border-b-2 border-slate-100 py-3 text-2xl font-black outline-none focus:border-slate-950" value={newHolding.price} onChange={e => setNewHolding({...newHolding, price: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">持有數量 QTY</label>
                      <input type="number" required className="w-full border-b-2 border-slate-100 py-3 text-2xl font-black outline-none focus:border-slate-950" value={newHolding.qty} onChange={e => setNewHolding({...newHolding, qty: e.target.value})} />
                    </div>
                </div>
                <button type="submit" className="w-full py-6 bg-slate-950 text-white font-black uppercase tracking-[0.4em] hover:bg-emerald-600 transition-all">
                  COMMIT POSITION
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
