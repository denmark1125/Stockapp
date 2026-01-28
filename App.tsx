import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, Zap, Sparkles, Trophy, Compass, Filter, CheckCircle2, Loader2, Target, BookOpen, ChevronDown, ChevronUp, TrendingUp, LogOut
} from 'lucide-react';
import { DashboardState, DailyAnalysis, PortfolioItem } from './types';
import { fetchDailyAnalysis, fetchPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { StockDetailModal } from './components/StockDetailModal';
import { GoogleGenAI } from "@google/genai";
import { isAfter, isValid } from 'date-fns';

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
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);
  
  // 每日全盤簡報狀態
  const [dailyBriefing, setDailyBriefing] = useState<string | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);

  // 個股 AI 分析狀態
  const [stockReport, setStockReport] = useState<string | null>(null);
  const [isStockLoading, setIsStockLoading] = useState(false);

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
      setState({ 
        data: marketData, portfolio: portfolioData, loading: false, error: null, 
        lastUpdated: new Date()
      });
    } catch (err: any) { 
      setState(prev => ({ ...prev, loading: false, error: err.message })); 
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const processedLists = useMemo(() => {
    const daily = state.data.filter(s => s.stock_code !== 'MARKET_BRIEF');
    const allDates = daily.map(s => s.analysis_date).filter(Boolean);
    const latestDate = allDates.length > 0 ? [...allDates].sort().reverse()[0] : null;
    
    const currentQuotes = latestDate ? daily.filter(s => s.analysis_date === latestDate) : daily;
    const quotesMap: Record<string, DailyAnalysis> = {};
    currentQuotes.forEach(q => { quotesMap[q.stock_code] = q; });

    const historyMap: Record<string, { close_price: number }[]> = {};
    daily.forEach(item => {
      if (!historyMap[item.stock_code]) historyMap[item.stock_code] = [];
      if (historyMap[item.stock_code].length < 10) {
        historyMap[item.stock_code].unshift({ close_price: item.close_price });
      }
    });

    const portfolioList = state.portfolio.map(p => {
      const quote = quotesMap[p.stock_code];
      return {
        ...quote,
        stock_code: p.stock_code,
        stock_name: p.stock_name,
        buy_price: p.buy_price,
        quantity: p.quantity,
        portfolio_id: p.id,
        is_holding_item: true,
        ai_score: quote?.ai_score || 0,
        close_price: quote?.close_price || 0,
        trade_signal: quote?.trade_signal || 'INVEST_HOLD'
      } as DailyAnalysis;
    });

    const applyFilter = (list: DailyAnalysis[]) => {
      switch (filterMode) {
        case 'quality': return list.filter(s => (s.roe || 0) > 15);
        case 'growth': return list.filter(s => (s.revenue_yoy || 0) > 20);
        case 'profitable': return list.filter(s => s.ai_score >= 85);
        default: return list;
      }
    };

    return { 
      dailyList: applyFilter(currentQuotes).sort((a,b) => b.ai_score - a.ai_score),
      portfolioList: portfolioList.sort((a,b) => b.ai_score - a.ai_score),
      historyMap 
    };
  }, [state.data, state.portfolio, filterMode]);

  // 1. 生成每日全盤策略簡報
  const generateDailyBriefing = async () => {
    if (isBriefingLoading) return;
    
    // 修正：使用 Vite 環境變數
    const apiKey = (import.meta.env as any).VITE_GEMINI_API;
    if (!apiKey) { alert("⚠️ API Key 未設定"); return; }

    setIsBriefingLoading(true);
    
    try {
      const topStocks = processedLists.dailyList.slice(0, 5);
      const context = topStocks.map(s => `${s.stock_name}(${s.stock_code}): 分數${s.ai_score}, ROE ${s.roe}%, 營收YoY ${s.revenue_yoy}%, 短評: ${s.ai_comment}`).join('\n');
      
      // 修正：SDK 初始化語法
      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const result = await model.generateContent(`
          你是一位世界頂尖的機構投資基金經理人，負責撰寫一份「Alpha 每日投資決策建議報告」。
          當前市場高分標的如下：
          ${context}

          請撰寫一份專業報告，語氣要果斷、精準且具備深度洞察力。報告需包含：
          1. 【盤勢定調】：分析今日這幾檔標的反映了什麼市場題材（例如 AI 鏈動能、內需品質支撐等）。
          2. 【Alpha 題材解碼】：針對目前這幾檔強勢股的共同基因進行深度解析。
          3. 【核心配置建議】：身為專業經理人，你會如何配置這 5 檔標的？給出明確的進場優先級。
          
          請使用繁體中文，運用專業術語，字數約 300 字。
      `);
      
      const response = await result.response;
      setDailyBriefing(response.text());
    } catch (error: any) {
      console.error("Briefing Error:", error);
      setDailyBriefing(`⚠️ 分析中斷：${error.message}`);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // 2. 生成個股分析報告 (補回此功能)
  const generateStockReport = async (stock: DailyAnalysis) => {
    if (isStockLoading) return;

    const apiKey = (import.meta.env as any).VITE_GEMINI_API;
    if (!apiKey) { alert("⚠️ API Key 未設定"); return; }

    setIsStockLoading(true);
    setStockReport(null);

    try {
      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const result = await model.generateContent(`
        角色：2026 年華爾街頂尖 AI 經理人。
        標的：${stock.stock_name} (${stock.stock_code})
        數據：現價 ${stock.close_price} | 分數 ${stock.ai_score} | ROE ${stock.roe}% | YoY ${stock.revenue_yoy}%
        
        請給出 150 字內的精簡報告：
        1. 【戰略定位】：目前位階與趨勢。
        2. 【操作指令】：買進/觀望/賣出及其理由。
      `);

      const response = await result.response;
      setStockReport(response.text());
    } catch (error: any) {
      console.error("Stock AI Error:", error);
      setStockReport("⚠️ 無法生成報告，請稍後再試。");
    } finally {
      setIsStockLoading(false);
    }
  };

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] p-6">
      <div className="w-full max-w-[400px] bg-white p-10 shadow-2xl rounded-[2.5rem] text-center border border-slate-50">
        <div className="bg-slate-950 w-16 h-16 rounded-3xl flex items-center justify-center text-white mx-auto mb-10">
          <Zap fill="currentColor" size={24} />
        </div>
        <h1 className="text-3xl font-black mb-10 italic">Alpha Ledger.</h1>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setAuthLoading(true);
          setAuthError('');
          try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
          } catch (err: any) { setAuthError(err.message); }
          finally { setAuthLoading(false); }
        }} className="space-y-5">
          <input type="email" placeholder="授權信箱" required className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-slate-200" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="密鑰" required className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-slate-200" value={password} onChange={e => setPassword(e.target.value)} />
          {authError && <p className="text-rose-500 text-[10px] font-black">{authError}</p>}
          <button type="submit" disabled={authLoading} className="w-full py-5 bg-slate-950 text-white font-black text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-transform disabled:opacity-50">
            {authLoading ? '驗證中...' : '進入終端'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-24 sm:pb-10">
      <nav className="sticky top-0 z-[100] bg-white/80 border-b border-slate-100 px-6 sm:px-10 py-5 flex justify-between items-center backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-slate-950 p-2.5 rounded-xl text-white shadow-lg"><Zap size={18} fill="currentColor" /></div>
          <h1 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase">Alpha Ledger.</h1>
        </div>
        <div className="hidden sm:flex items-center gap-10">
           <button onClick={() => setActiveView('daily')} className={`text-xs font-black uppercase tracking-widest transition-colors ${activeView === 'daily' ? 'text-slate-950 underline underline-offset-8' : 'text-slate-300 hover:text-slate-500'}`}>市場掃描</button>
           <button onClick={() => setActiveView('portfolio')} className={`text-xs font-black uppercase tracking-widest transition-colors ${activeView === 'portfolio' ? 'text-slate-950 underline underline-offset-8' : 'text-slate-300 hover:text-slate-500'}`}>資產金庫</button>
           <button onClick={() => signOut()} className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 hover:text-rose-500"><LogOut size={12}/> 登出</button>
        </div>
      </nav>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 border-t border-slate-100 px-10 py-5 flex justify-around backdrop-blur-xl shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
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
          <>
            {/* AI 簡報區塊 */}
            <div className="mb-10 sm:mb-16">
              <div className="group relative overflow-hidden bg-slate-950 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[100px] rounded-full -mr-20 -mt-20"></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center text-white">
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <h2 className="text-white text-xl sm:text-2xl font-black italic tracking-tighter uppercase">Daily Alpha Briefing</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">投信級別核心決策報告書</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowBriefing(!showBriefing)}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      {showBriefing ? <ChevronUp /> : <ChevronDown />}
                    </button>
                  </div>

                  {showBriefing && (
                    <div className="space-y-6">
                      {!dailyBriefing && !isBriefingLoading && (
                        <button 
                          onClick={generateDailyBriefing}
                          className="group/btn flex items-center gap-4 bg-white/5 hover:bg-rose-500 border border-white/10 hover:border-rose-400 px-8 py-5 rounded-2xl transition-all w-full sm:w-fit"
                        >
                          <Sparkles size={20} className="text-rose-500 group-hover/btn:text-white" />
                          <span className="text-white text-xs font-black uppercase tracking-widest">請示今日 Alpha 策略建議</span>
                        </button>
                      )}

                      {isBriefingLoading && (
                        <div className="flex flex-col items-center py-10 gap-4">
                          <Loader2 className="animate-spin text-rose-500" size={32} />
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest animate-pulse">正在彙整萬點因子、深度校正各產業鏈報價...</p>
                        </div>
                      )}

                      {dailyBriefing && (
                        <div className="bg-white/5 border border-white/10 p-6 sm:p-10 rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
                          <div className="serif-text text-slate-300 text-base sm:text-lg leading-loose whitespace-pre-wrap italic">
                            {dailyBriefing}
                          </div>
                          <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex items-center gap-2">
                              <TrendingUp size={16} className="text-rose-500" />
                              <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">今日核心策略已鎖定</span>
                            </div>
                            <button 
                              onClick={generateDailyBriefing}
                              className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-500 transition-colors"
                            >
                              重新生成報告
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                    className={`px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap
                      ${filterMode === f.id ? 'bg-slate-950 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-400 border border-slate-100'}
                    `}
                  >
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="space-y-6">
           <div className="flex justify-between items-center px-1">
             <h2 className="text-xl sm:text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
               {activeView === 'daily' ? 'Market Radar' : 'Vault Assets'}
               <span className="text-[10px] sm:text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                 {(activeView === 'daily' ? processedLists.dailyList : processedLists.portfolioList).length}
               </span>
             </h2>
             {state.loading && <Loader2 className="animate-spin text-slate-300" size={20} />}
           </div>

           <div className="grid grid-cols-1 gap-5">
              {(activeView === 'daily' ? processedLists.dailyList : processedLists.portfolioList).map((item: DailyAnalysis) => (
                <ActionCard 
                  key={item.portfolio_id || item.stock_code + (item.analysis_date || '')} 
                  stock={item}
                  isPortfolio={activeView === 'portfolio'}
                  history={processedLists.historyMap[item.stock_code] || []} 
                  onSelect={() => {
                    setSelectedStock(item);
                    setStockReport(null); // 開啟新視窗時清空舊報告
                  }} 
                />
              ))}
           </div>

           {!state.loading && (activeView === 'daily' ? processedLists.dailyList : processedLists.portfolioList).length === 0 && (
             <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-[0.2em] border-2 border-dashed border-slate-100 rounded-[3rem]">
               {activeView === 'daily' ? '無匹配因子標的' : '目前尚無資產庫存'}
             </div>
           )}
        </div>
      </main>

      {/* 個股 AI Modal */}
      {selectedStock && (
        <StockDetailModal 
          stock={selectedStock} 
          onClose={() => setSelectedStock(null)} 
          onRunAi={() => generateStockReport(selectedStock)}
          aiReport={stockReport}
          isAiLoading={isStockLoading}
        />
      )}
    </div>
  );
};

export default App;