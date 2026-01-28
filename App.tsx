import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, Zap, Sparkles, Trophy, Compass, Filter, CheckCircle2, Loader2, Target, BookOpen, ChevronDown, ChevronUp, TrendingUp, Crown, LogOut
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { StockDetailModal } from './components/StockDetailModal';
// ✅ 使用穩定版 SDK
import { GoogleGenerativeAI } from "@google/generative-ai";
import { format } from 'date-fns';

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
  
  // 每日簡報狀態
  const [dailyBriefing, setDailyBriefing] = useState<string | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);

  // 個股 AI 報告狀態
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

  // 🔥 核心數據處理：Elite 50 演算法
  const processedData = useMemo(() => {
    const rawData = state.data.filter(s => s.stock_code !== 'MARKET_BRIEF');
    
    // 1. 取得資料庫中最新的一個日期
    const analysisDates = rawData.map(s => s.analysis_date).filter(Boolean);
    const latestDate = analysisDates.length > 0 ? [...new Set(analysisDates)].sort().reverse()[0] : null;

    // 2. 獲取該最新日期的所有行情快照
    const latestQuotes = latestDate ? rawData.filter(s => s.analysis_date === latestDate) : [];
    const quotesMap: Record<string, DailyAnalysis> = {};
    latestQuotes.forEach(q => { quotesMap[q.stock_code] = q; });

    // 3. 建立歷史趨勢圖數據
    const historyMap: Record<string, { close_price: number }[]> = {};
    rawData.forEach(item => {
      if (!historyMap[item.stock_code]) historyMap[item.stock_code] = [];
      if (historyMap[item.stock_code].length < 10) {
        historyMap[item.stock_code].push({ close_price: item.close_price });
      }
    });

    // 4. Elite 50 篩選機制：只取前 50 檔高分股
    const dailyRadarList = latestQuotes
      .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
      .slice(0, 50);

    // 5. 處理 Portfolio 清單
    const portfolioList = state.portfolio.map(p => {
      const currentQuote = quotesMap[p.stock_code];
      return {
        ...(currentQuote || {}),
        stock_code: p.stock_code,
        stock_name: p.stock_name,
        buy_price: p.buy_price,
        quantity: p.quantity,
        portfolio_id: p.id,
        is_holding_item: true,
        ai_score: currentQuote?.ai_score || 0,
        close_price: currentQuote?.close_price || 0,
        trade_signal: currentQuote?.trade_signal || 'INVEST_HOLD'
      } as DailyAnalysis;
    });

    const applyFilter = (list: DailyAnalysis[]) => {
      switch (filterMode) {
        case 'quality': return list.filter(s => (s.roe || 0) > 15);
        case 'growth': return list.filter(s => (s.revenue_yoy || 0) > 20);
        case 'profitable': return list.filter(s => s.ai_score >= 90);
        default: return list;
      }
    };

    return { 
      dailyList: applyFilter(dailyRadarList),
      portfolioList: portfolioList.sort((a,b) => b.ai_score - a.ai_score),
      historyMap,
      latestDate
    };
  }, [state.data, state.portfolio, filterMode]);

  const isDataToday = useMemo(() => {
    if (!processedData.latestDate) return false;
    const today = format(new Date(), 'yyyy-MM-dd');
    return processedData.latestDate === today;
  }, [processedData.latestDate]);

  // ✅ 1. 股神戰情簡報 (God's Command)
  const generateDailyBriefing = async () => {
    if (isBriefingLoading) return;
    
    // 修正：使用 VITE_GEMINI_API 搭配 as any 避開 TS 檢查
    const apiKey = (import.meta.env as any).VITE_GEMINI_API;
    
    if (!apiKey) { 
      alert("⚠️ 請檢查 Vercel 環境變數：VITE_GEMINI_API 未設定"); 
      return; 
    }

    setIsBriefingLoading(true);
    
    try {
      const topStocks = processedData.dailyList.slice(0, 10);
      const context = topStocks.map(s => `${s.stock_name}(${s.stock_code}): 分數${s.ai_score}, 點評: ${s.ai_comment}`).join('\n');
      
      const genAI = new GoogleGenerativeAI(apiKey);
      // 使用穩定版 gemini-pro 模型
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const result = await model.generateContent(`
          你是一位世界頂尖、號稱「股神」的機構投資基金經理人。
          今日系統已從數百檔標的篩選出最精華的【Elite 50 必投清單】。
          
          核心領先標的：
          ${context}

          請撰寫一份具備極高權威感的【股神戰情簡報】：
          1. 【盤勢核心定調】：分析這 50 檔標的集體呈現的攻擊方向。
          2. 【Alpha 基因分析】：為什麼這些標的能從數百家公司中脫穎而出？
          3. 【操作軍令狀】：給予投資人最明確的進場配置比例與心理建設。
          
          字數約 450 字，運用大師級別的語氣（如：市場正在獎勵、資金正在挪移、極度稀缺性）。
      `);
      
      const response = await result.response;
      setDailyBriefing(response.text());
    } catch (error: any) {
      console.error("Briefing Error:", error);
      setDailyBriefing("⚠️ 股神腦核同步中，請確認 API 配額或稍後重試。");
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // ✅ 2. 個股 AI 分析 (補回功能)
  const generateStockReport = async (stock: DailyAnalysis) => {
    if (isStockLoading) return;

    const apiKey = (import.meta.env as any).VITE_GEMINI_API;
    if (!apiKey) { 
        alert("⚠️ 請檢查 Vercel 環境變數：VITE_GEMINI_API 未設定"); 
        return; 
    }

    setIsStockLoading(true);
    setStockReport(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
      setStockReport("⚠️ 無法生成報告，請檢查 API 配額。");
    } finally {
      setIsStockLoading(false);
    }
  };

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] p-6 text-slate-900">
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
          <input type="email" placeholder="授權信箱" required className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="密鑰" required className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2" value={password} onChange={e => setPassword(e.target.value)} />
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
           <button onClick={() => setActiveView('daily')} className={`text-xs font-black uppercase tracking-widest transition-colors ${activeView === 'daily' ? 'text-slate-950 underline underline-offset-8 decoration-rose-500 decoration-2' : 'text-slate-300 hover:text-slate-500'}`}>精英掃描</button>
           <button onClick={() => setActiveView('portfolio')} className={`text-xs font-black uppercase tracking-widest transition-colors ${activeView === 'portfolio' ? 'text-slate-950 underline underline-offset-8 decoration-rose-500 decoration-2' : 'text-slate-300 hover:text-slate-500'}`}>資產金庫</button>
           <button onClick={() => signOut()} className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 hover:text-rose-500"><LogOut size={12}/> 登出系統</button>
        </div>
      </nav>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 border-t border-slate-100 px-10 py-5 flex justify-around backdrop-blur-xl shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
        <button onClick={() => setActiveView('daily')} className={`flex flex-col items-center gap-1.5 ${activeView === 'daily' ? 'text-rose-500' : 'text-slate-400'}`}>
          <Crown size={22} strokeWidth={activeView === 'daily' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Elite</span>
        </button>
        <button onClick={() => setActiveView('portfolio')} className={`flex flex-col items-center gap-1.5 ${activeView === 'portfolio' ? 'text-slate-950' : 'text-slate-400'}`}>
          <Target size={22} strokeWidth={activeView === 'portfolio' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Vault</span>
        </button>
      </div>

      <main className="max-w-[1200px] mx-auto px-5 sm:px-8 py-6 sm:py-10">
        <SystemStatus 
          lastUpdated={state.lastUpdated} 
          isSyncing={state.loading} 
          dataDate={processedData.latestDate}
          isCurrent={isDataToday}
        />

        {activeView === 'daily' && (
          <>
            {/* God's Command 簡報區塊 */}
            <div className="mb-10 sm:mb-16">
              <div className="group relative overflow-hidden bg-slate-950 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[100px] rounded-full -mr-20 -mt-20"></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-[0_0_30px_rgba(244,63,94,0.4)]">
                        <Crown size={24} />
                      </div>
                      <div>
                        <h2 className="text-white text-xl sm:text-2xl font-black italic tracking-tighter uppercase">God's Command: Elite 50</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          股神特選・必投資清單 
                          <span className="bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded text-[8px] border border-rose-500/30">核心權威</span>
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setShowBriefing(!showBriefing)} className="text-slate-500 hover:text-white transition-colors">
                      {showBriefing ? <ChevronUp /> : <ChevronDown />}
                    </button>
                  </div>

                  {showBriefing && (
                    <div className="space-y-6">
                      {!dailyBriefing && !isBriefingLoading && (
                        <button onClick={generateDailyBriefing} className="group/btn flex items-center gap-4 bg-white/5 hover:bg-rose-500 border border-white/10 hover:border-rose-400 px-8 py-5 rounded-2xl transition-all w-full sm:w-fit">
                          <Sparkles size={20} className="text-rose-500 group-hover/btn:text-white" />
                          <span className="text-white text-xs font-black uppercase tracking-widest">請示股神今日決策指令</span>
                        </button>
                      )}

                      {isBriefingLoading && (
                        <div className="flex flex-col items-center py-10 gap-4">
                          <Loader2 className="animate-spin text-rose-500" size={32} />
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest animate-pulse italic">正在審計精英因子、校對股神配置逻辑...</p>
                        </div>
                      )}

                      {dailyBriefing && (
                        <div className="bg-white/5 border border-white/10 p-6 sm:p-10 rounded-3xl animate-in fade-in slide-in-from-bottom-2">
                          <div className="serif-text text-slate-300 text-base sm:text-lg leading-relaxed whitespace-pre-wrap italic">
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
                  { id: 'all', label: 'Elite 50 全部', icon: <Crown size={14}/> },
                  { id: 'quality', label: '頂級品質', icon: <Trophy size={14}/> },
                  { id: 'growth', label: '爆發成長', icon: <Zap size={14}/> },
                  { id: 'profitable', label: '超高分嚴選', icon: <CheckCircle2 size={14}/> },
                ].map(f => (
                  <button key={f.id} onClick={() => setFilterMode(f.id as FilterMode)}
                    className={`px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active-scale
                      ${filterMode === f.id ? 'bg-rose-600 text-white shadow-xl shadow-rose-200' : 'bg-white text-slate-400 border border-slate-100'}`}
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
             <div className="flex flex-col gap-1">
               <h2 className="text-xl sm:text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
                 {activeView === 'daily' ? 'Alpha Elite 50' : 'Vault Assets'}
                 <span className="text-[10px] sm:text-xs bg-rose-600 text-white px-3 py-1.5 rounded-full font-black shadow-lg shadow-rose-200">
                   {(activeView === 'daily' ? processedData.dailyList : processedData.portfolioList).length}
                 </span>
               </h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                 {activeView === 'daily' ? `股神嚴選：當前最強 ${processedData.dailyList.length} 檔實戰標的` : '當前持倉清單'}
               </p>
             </div>
             {state.loading && <Loader2 className="animate-spin text-slate-300" size={20} />}
           </div>

           <div className="grid grid-cols-1 gap-5">
              {(activeView === 'daily' ? processedData.dailyList : processedData.portfolioList).map((item: DailyAnalysis) => (
                <ActionCard 
                  key={item.portfolio_id || `${item.stock_code}-${item.analysis_date}`} 
                  stock={item}
                  isPortfolio={activeView === 'portfolio'}
                  history={processedData.historyMap[item.stock_code] || []} 
                  onSelect={() => {
                    setSelectedStock(item);
                    setStockReport(null);
                  }} 
                />
              ))}
           </div>

           {!state.loading && (activeView === 'daily' ? processedData.dailyList : processedData.portfolioList).length === 0 && (
             <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-[0.2em] border-2 border-dashed border-slate-100 rounded-[3rem]">
               今日精英因子未達標
             </div>
           )}
        </div>
      </main>

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