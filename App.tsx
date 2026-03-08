import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Compass, Layout, Wallet, LogOut, Search, Plus, Zap, Cpu,
  ArrowUpRight, ChevronRight, X, AlertTriangle, Shield
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, supabase, signOut, addToPortfolio, removeFromPortfolio } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { MarketBriefing } from './components/MarketBriefing';
import { StockDetailModal } from './components/StockDetailModal';
import { GlobalAiReportModal } from './components/GlobalAiReportModal';
import { GoogleGenAI } from "@google/genai";
import { format } from 'date-fns';

type StrategyMode = 'short' | 'long';
type ViewMode = 'elite' | 'portfolio' | 'full';
type AuthMode = 'login' | 'register';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const [state, setState] = useState<DashboardState>({
    data: [], portfolio: [], loading: true, error: null, lastUpdated: null
  });

  const [activeView, setActiveView] = useState<ViewMode>('elite');
  const [strategy, setStrategy] = useState<StrategyMode>('long');
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isGlobalReportOpen, setIsGlobalReportOpen] = useState(false);
  const [globalReportType, setGlobalReportType] = useState<'daily' | 'weekly'>('daily');

  const [stockAiReport, setStockAiReport] = useState<{text: string, links: {title: string, uri: string}[]} | null>(null);
  const [isStockAiLoading, setIsStockAiLoading] = useState(false);

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
      setState({ data: marketData, portfolio: portfolioData, loading: false, error: null, lastUpdated: new Date() });
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const processedData = useMemo(() => {
    const latestSnapshotMap = new Map<string, DailyAnalysis>();
    const scoreHistoryMap = new Map<string, number[]>();

    state.data.forEach(item => {
      if (!latestSnapshotMap.has(item.stock_code)) latestSnapshotMap.set(item.stock_code, item);
      if (!scoreHistoryMap.has(item.stock_code)) scoreHistoryMap.set(item.stock_code, []);
      const scores = scoreHistoryMap.get(item.stock_code);
      if (scores && scores.length < 5) scores.push(strategy === 'short' ? Number(item.score_short || 0) : Number(item.score_long || 0));
    });

    const allDates = [...new Set(state.data.map(s => s.analysis_date))].sort().reverse();
    const latestDate = allDates[0] || null;
    const latestData = latestDate ? state.data.filter(s => s.analysis_date === latestDate) : [];
    const marketBrief = latestData.find(s => s.stock_code === 'MARKET_BRIEF') || null;
    const latestStocks = latestData.filter(s => s.stock_code !== 'MARKET_BRIEF' && s.stock_code !== 'MARKET_STATE');

    // 取得最新大盤狀態
    const marketStateRow = latestData.find(s => s.stock_code === 'MARKET_STATE');
    const marketRegime = marketStateRow?.market_regime || latestStocks[0]?.market_regime || 'SIDEWAYS';

    const getEliteScore = (s: DailyAnalysis) => {
      const history = scoreHistoryMap.get(s.stock_code) || [];
      const currentScore = strategy === 'short' ? (Number(s.score_short) || 0) : (Number(s.score_long) || 0);
      if (strategy === 'long' && history.length > 1) {
        const avgScore = history.reduce((a, b) => a + b, 0) / history.length;
        return (currentScore * 0.6) + (avgScore * 0.4);
      }
      return currentScore;
    };

    let baseList = [...latestStocks].sort((a, b) => getEliteScore(b) - getEliteScore(a));
    const eliteList = baseList.filter(s => getEliteScore(s) >= 70).slice(0, 12);

    const portfolioList = state.portfolio.map(p => {
      const mkt = latestSnapshotMap.get(p.stock_code);
      const currentPrice = mkt ? Number(mkt.close_price) : Number(p.buy_price);
      return {
        ...(mkt || {
          id: p.id, stock_code: p.stock_code, stock_name: p.stock_name,
          close_price: p.buy_price, analysis_date: 'N/A', trade_signal: 'HOLD',
          ai_score: 0, score_short: 0, score_long: 0, roe: null, revenue_yoy: null, pe_ratio: null,
          vol_ratio: 1, volatility: 0
        }),
        buy_price: Number(p.buy_price),
        close_price: currentPrice,
        quantity: p.quantity,
        profit_loss_ratio: ((currentPrice - p.buy_price) / p.buy_price) * 100,
        is_holding_item: true,
      } as DailyAnalysis;
    });

    // 找出需要停損的庫存
    const stopLossAlerts = portfolioList.filter(s =>
      s.trade_signal === 'SELL_STOP' ||
      (s.trade_stop && s.close_price < s.trade_stop)
    );

    return {
      marketBrief,
      marketRegime,
      eliteList,
      fullList: baseList,
      portfolioList,
      stopLossAlerts,
      latestDate,
      isCurrent: latestDate === format(new Date(), 'yyyy-MM-dd'),
      searchResults: searchQuery ? latestStocks.filter(s => s.stock_name.includes(searchQuery) || s.stock_code.includes(searchQuery)).slice(0, 5) : []
    };
  }, [state.data, state.portfolio, strategy, searchQuery]);

  const handleRunStockAi = async (stock: DailyAnalysis) => {
    setIsStockAiLoading(true);
    setStockAiReport(null);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const prompt = `你是 Alpha Ledger 首席交易員。針對股票：${stock.stock_name}(${stock.stock_code})，現價 ${stock.close_price}。這檔股票目前在我們的 Python 腳本中被評為 ${strategy === 'short' ? '當沖' : '波段'} 潛力股。請針對當前網路上的法人研究報告、PTT、以及主力動向進行解碼。請給出明確的「進場點」、「加碼點」與「終極停損點」。中文回答。`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = chunks.map((c: any) => c.web).filter(Boolean).map((w: any) => ({ title: w.title, uri: w.uri }));
      setStockAiReport({ text: response.text || "...", links });
    } catch (e) {
      setStockAiReport({ text: "⚠️ 情報解碼失敗。", links: [] });
    } finally {
      setIsStockAiLoading(false);
    }
  };

  const handleTogglePortfolio = async (stock: DailyAnalysis, buyPrice?: number, quantity?: number) => {
    try {
      if (stock.is_holding_item) await removeFromPortfolio(stock.stock_code);
      else { if (buyPrice === undefined || quantity === undefined) return; await addToPortfolio(stock, buyPrice, quantity); }
      await loadData();
    } catch (e) { console.error(e); }
  };

  // ── 登入 / 註冊 ──────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError('帳號或密碼錯誤，請重試');
    setAuthLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    if (password !== confirmPassword) { setAuthError('兩次密碼輸入不一致'); return; }
    if (password.length < 6) { setAuthError('密碼至少需要 6 個字元'); return; }
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message === 'User already registered' ? '此信箱已註冊，請直接登入' : '註冊失敗，請稍後再試');
    else setAuthSuccess('✅ 註冊成功！請確認您的信箱後登入，或直接嘗試登入。');
    setAuthLoading(false);
  };

  // ── 未登入頁面 ──────────────────────────
  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FCFBF9]">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#1A1A1A] rounded-2xl mb-4">
            <Shield size={24} className="text-[#C83232]" />
          </div>
          <h1 className="serif-text text-3xl font-bold tracking-tight text-[#1A1A1A]">Alpha Ledger</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] mt-1 font-bold">智慧投資審計系統</p>
        </div>

        {/* 登入 / 註冊 切換 Tab */}
        <div className="flex bg-slate-100 rounded-2xl p-1 mb-6">
          <button
            onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${authMode === 'login' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-400'}`}
          >
            登入
          </button>
          <button
            onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${authMode === 'register' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-400'}`}
          >
            註冊新帳號
          </button>
        </div>

        {/* 表單 */}
        <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">
              {authMode === 'login' ? 'Terminal ID' : '電子信箱'}
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="請輸入電子信箱"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#C83232]/30 focus:border-[#C83232] transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">
              {authMode === 'login' ? 'Access Key' : '設定密碼'}
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder={authMode === 'login' ? '請輸入密碼' : '至少 6 個字元'}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#C83232]/30 focus:border-[#C83232] transition-all"
            />
          </div>

          {/* 註冊專用：確認密碼 */}
          {authMode === 'register' && (
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">確認密碼</label>
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                placeholder="再次輸入密碼"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#C83232]/30 focus:border-[#C83232] transition-all"
              />
            </div>
          )}

          {/* 錯誤訊息 */}
          {authError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600 font-medium">{authError}</p>
            </div>
          )}

          {/* 成功訊息 */}
          {authSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-xs text-emerald-700 font-medium">{authSuccess}</p>
            </div>
          )}

          <button
            type="submit" disabled={authLoading}
            className="w-full bg-[#1A1A1A] text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#C83232] transition-all mt-2 disabled:opacity-50"
          >
            {authLoading ? '處理中...' : authMode === 'login' ? '進入指揮部' : '建立帳號'}
          </button>
        </form>

        {/* 切換提示 */}
        <p className="text-center text-[11px] text-slate-400 mt-6">
          {authMode === 'login' ? (
            <>還沒有帳號？<button onClick={() => { setAuthMode('register'); setAuthError(''); }} className="text-[#C83232] font-bold hover:underline">立即註冊</button></>
          ) : (
            <>已有帳號？<button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-[#C83232] font-bold hover:underline">直接登入</button></>
          )}
        </p>
      </div>
    </div>
  );

  const isBearMarket = processedData.marketRegime === 'BEAR';

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#1A1A1A] pb-32">

      {/* ── 問題5：大盤空頭全寬警告橫幅 ── */}
      {isBearMarket && (
        <div className="w-full bg-[#C83232] text-white px-6 py-3 flex items-center justify-center gap-3 text-center">
          <AlertTriangle size={16} className="shrink-0 animate-pulse" />
          <p className="text-xs font-bold tracking-wide">
            🔴 大盤空頭警戒中 — 系統已封鎖新買進訊號，請專注管理現有庫存停損
          </p>
          <AlertTriangle size={16} className="shrink-0 animate-pulse" />
        </div>
      )}

      {/* ── 問題2：庫存停損警報橫幅 ── */}
      {activeView === 'portfolio' && processedData.stopLossAlerts.length > 0 && (
        <div className="w-full bg-rose-900 text-white px-6 py-4 flex items-center justify-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-yellow-300 animate-bounce" />
          <p className="text-sm font-bold">
            ⚠️ 警報：以下 <span className="text-yellow-300">{processedData.stopLossAlerts.length} 檔</span> 持股已觸發停損 —
            {processedData.stopLossAlerts.map(s => ` ${s.stock_name}`).join('、')} — 請立即處理
          </p>
        </div>
      )}

      {/* ── 導覽列 ── */}
      <nav className="hidden lg:flex sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="serif-text text-xl font-bold tracking-tighter">Alpha Ledger</h1>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex gap-8">
            {[
              { id: 'elite', label: '獲利雷達', icon: Compass },
              { id: 'full', label: '全市場審查', icon: Layout },
              { id: 'portfolio', label: `資產帳冊${processedData.stopLossAlerts.length > 0 ? ` 🔴${processedData.stopLossAlerts.length}` : ''}`, icon: Wallet }
            ].map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id as ViewMode)}
                className={`flex items-center gap-2 text-[11px] font-bold transition-all ${activeView === v.id ? 'text-[#C83232]' : 'text-slate-400 hover:text-slate-600'}`}>
                <v.icon size={14} /> {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* 大盤狀態 badge */}
          <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold border ${
            isBearMarket ? 'bg-red-50 text-red-600 border-red-200' :
            processedData.marketRegime === 'BULL' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
            'bg-yellow-50 text-yellow-600 border-yellow-200'
          }`}>
            {isBearMarket ? '🔴 空頭' : processedData.marketRegime === 'BULL' ? '🟢 多頭' : '🟡 盤整'}
          </div>
          <button onClick={() => setIsGlobalReportOpen(true)} className="bg-[#C83232] text-white px-5 py-2.5 rounded-full text-[10px] font-bold flex items-center gap-2 hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/10">
            <Cpu size={14} /> AI 深度獲利報告
          </button>
          <button onClick={() => signOut()} className="text-slate-400 hover:text-[#C83232] transition-colors"><LogOut size={16} /></button>
        </div>
      </nav>

      {/* ── 手機底部導覽 ── */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[92%] max-w-[420px]">
        <div className="bg-[#1A1A1A] text-white rounded-[2rem] px-2 py-3 flex items-center justify-around shadow-2xl border border-white/5">
          {[
            { id: 'elite', label: '雷達', icon: Compass },
            { id: 'full', label: '市場', icon: Layout },
            { id: 'portfolio', label: processedData.stopLossAlerts.length > 0 ? `帳冊🔴` : '帳冊', icon: Wallet }
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveView(item.id as ViewMode)}
              className={`flex-1 flex flex-col items-center gap-1 py-1 transition-all active:scale-90 ${activeView === item.id ? 'text-white' : 'text-slate-500'}`}>
              <item.icon size={22} strokeWidth={activeView === item.id ? 2.5 : 2} />
              <span className="text-[9px] font-bold tracking-tighter">{item.label}</span>
            </button>
          ))}
          <div className="w-px h-8 bg-white/10 mx-2"></div>
          <button onClick={() => { setGlobalReportType('daily'); setIsGlobalReportOpen(true); }} className="flex-1 flex flex-col items-center gap-1 text-[#C83232] active:scale-90">
            <Zap size={22} fill="currentColor" />
            <span className="text-[9px] font-bold tracking-tighter">AI 報告</span>
          </button>
        </div>
      </div>

      {/* ── 主內容 ── */}
      <main className="max-w-[1200px] mx-auto px-4 lg:px-8 py-6">
        <header className="mb-10 lg:flex items-end justify-between border-b border-slate-100 pb-8">
          <div>
            <h2 className="serif-text text-4xl lg:text-5xl font-bold tracking-tight mb-2">
              {activeView === 'elite' ? '精選雷達' : activeView === 'full' ? '市場審查' : '資產帳冊'}
            </h2>
            <p className="text-[11px] text-[#C83232] font-black uppercase tracking-[0.4em]">
              {activeView === 'elite' ? 'Elite Conviction List' : activeView === 'full' ? 'Comprehensive Audit' : 'Asset Management'}
            </p>
          </div>
          <div className="hidden lg:block">
            <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} dataDate={processedData.latestDate} isCurrent={processedData.isCurrent} />
          </div>
        </header>

        {activeView !== 'portfolio' && (
          <MarketBriefing brief={processedData.marketBrief} loading={state.loading} marketRegime={processedData.marketRegime} />
        )}

        <div className="flex gap-2 mb-10 bg-slate-100/50 p-1.5 rounded-2xl w-fit mx-auto lg:mx-0 border border-slate-100 shadow-inner">
          <button onClick={() => setStrategy('short')} className={`px-8 py-3 rounded-xl text-[11px] font-bold transition-all ${strategy === 'short' ? 'bg-[#C83232] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>當沖雷達</button>
          <button onClick={() => setStrategy('long')} className={`px-8 py-3 rounded-xl text-[11px] font-bold transition-all ${strategy === 'long' ? 'bg-[#1A1A1A] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>波段佈局</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeView === 'portfolio' && (
            <div onClick={() => setIsManualAdding(!isManualAdding)} className="group relative rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-3 transition-all hover:bg-white hover:border-[#1A1A1A] cursor-pointer h-full min-h-[220px]">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300 group-hover:text-[#1A1A1A] group-hover:bg-slate-100 transition-all shadow-sm"><Plus size={32} /></div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-[#1A1A1A]">登錄新資產</span>
            </div>
          )}

          {(activeView === 'elite' ? processedData.eliteList : activeView === 'full' ? processedData.fullList : processedData.portfolioList).map(s => (
            <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => { setSelectedStock(s); setStockAiReport(null); }} />
          ))}

          {activeView === 'elite' && processedData.eliteList.length === 0 && !state.loading && (
            <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-slate-100">
              <p className="serif-text text-2xl text-slate-300 italic mb-2">今日市場尚未捕捉到精銳標的</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">等待量能噴發或趨勢成形</p>
            </div>
          )}
        </div>
      </main>

      {/* ── 手動新增庫存彈窗 ── */}
      {isManualAdding && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="w-full max-w-md bg-white shadow-2xl rounded-[3rem] p-10 animate-in zoom-in duration-300 border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="serif-text text-2xl font-bold text-[#1A1A1A]">登錄資產</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Manual Audit Registration</p>
              </div>
              <button onClick={() => setIsManualAdding(false)} className="p-2 hover:bg-slate-50 rounded-full"><X size={24} className="text-slate-400" /></button>
            </div>
            <div className="relative mb-8">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input autoFocus type="text" placeholder="輸入標的代碼或名稱..." className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-5 text-sm font-bold outline-none shadow-inner" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="space-y-3 max-h-[340px] overflow-y-auto scrollbar-hide">
              {processedData.searchResults.map(s => (
                <div key={s.id} onClick={() => { setSelectedStock(s); setIsManualAdding(false); setSearchQuery(''); }} className="flex items-center justify-between p-5 bg-white hover:bg-slate-50 rounded-2xl cursor-pointer transition-all border border-slate-100 hover:border-[#1A1A1A] group">
                  <div>
                    <span className="text-[10px] font-bold text-slate-300 block tracking-widest mb-0.5 group-hover:text-slate-400">{s.stock_code}</span>
                    <span className="text-lg font-bold text-[#1A1A1A]">{s.stock_name}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-[#1A1A1A] group-hover:text-white transition-all">
                    <ArrowUpRight size={18} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedStock && (
        <StockDetailModal
          stock={selectedStock}
          onClose={() => { setSelectedStock(null); setStockAiReport(null); }}
          onRunAi={() => handleRunStockAi(selectedStock)}
          onTogglePortfolio={handleTogglePortfolio}
          aiReport={stockAiReport}
          isAiLoading={isStockAiLoading}
        />
      )}

      {isGlobalReportOpen && (
        <GlobalAiReportModal type={globalReportType} onClose={() => setIsGlobalReportOpen(false)} portfolioStocks={state.portfolio.map(p => p.stock_name)} />
      )}
    </div>
  );
};

export default App;
