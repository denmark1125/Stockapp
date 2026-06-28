import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Compass, Layout, Wallet, LogOut, Search, Plus, Zap, Cpu,
  ArrowUpRight, ChevronRight, X, AlertTriangle, FileDown, FileSpreadsheet, FileText
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, supabase, signOut, addToPortfolio, removeFromPortfolio, searchStockAcrossHistory, fetchLatestAiReport } from './services/supabase';
import { exportToExcel, exportToPdf } from './utils/exportReport';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { MarketBriefing } from './components/MarketBriefing';
import { StockDetailModal } from './components/StockDetailModal';
import { GlobalAiReportModal } from './components/GlobalAiReportModal';
import { format } from 'date-fns';

type StrategyMode = 'short' | 'long';
type ViewMode = 'elite' | 'ai' | 'portfolio' | 'full';
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
  const [manualSearchResults, setManualSearchResults] = useState<DailyAnalysis[]>([]);

  const [isGlobalReportOpen, setIsGlobalReportOpen] = useState(false);
  const [globalReportType, setGlobalReportType] = useState<'daily' | 'weekly'>('daily');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
    // 今日盤勢（爬蟲把當日漲跌存在 volatility、白話警示存在 ai_comment、等級存在 trade_label）
    const marketChangePct = marketStateRow?.volatility != null ? Number(marketStateRow.volatility) : null;
    const marketDayCaution = (marketStateRow?.trade_label as string) || 'CALM';  // CRASH/WEAK/STRONG/CALM
    const marketCautionMsg = (marketStateRow?.ai_comment as string) || '';

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
    // 只保留真正精銳的標的：分數 ≥ 70 且 trade_signal 不是 AVOID
    const eliteList = baseList.filter(s => {
      const score = strategy === 'short' ? (Number(s.score_short) || 0) : (Number(s.score_long) || 0);
      const sig = s.trade_signal?.toUpperCase() || '';
      // 有明確買進或觀察訊號
      const hasBuySignal = ['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY', 'WATCH'].includes(sig);
      // 或者分數夠高（處理舊資料 signal 不準確的情況）
      const highScore = score >= 70;
      // 排除純粹的 AVOID（同時分數也低）
      const isAvoid = sig === 'AVOID' && score < 65;
      return highScore && !isAvoid;
    }).slice(0, 12);

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
        // quantity 存的是「股數」，實際損益金額 = (現價-成本) × 股數
        profit_loss_amount: (currentPrice - p.buy_price) * Number(p.quantity),
        is_holding_item: true,
      } as DailyAnalysis;
    });

    // 找出需要停損的庫存
    const stopLossAlerts = portfolioList.filter(s =>
      s.trade_signal === 'SELL_STOP' ||
      (s.trade_stop && s.close_price < s.trade_stop)
    );

    // 🤖 AI 特區：只收 AI 題材股，依高機會分數/AI評分排序（好股排前面）
    const aiList = [...latestStocks]
      .filter(s => s.ai_theme)
      .sort((a, b) =>
        (Number(b.opportunity_score) || Number(b.ai_score) || 0) -
        (Number(a.opportunity_score) || Number(a.ai_score) || 0)
      );

    return {
      marketBrief,
      marketRegime,
      marketChangePct,
      marketDayCaution,
      marketCautionMsg,
      eliteList,
      aiList,
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
      const prompt = `你是 Alpha Ledger 首席分析師，服務對象是完全不懂股票的投資新手，回答必須讓新手照著做就好。

股票：${stock.stock_name}（${stock.stock_code}）
現價：${stock.close_price}
策略：${strategy === 'short' ? '當沖短線' : '波段佈局'}
系統評分：${strategy === 'short' ? stock.score_short : stock.score_long} 分
建議掛單價：${stock.trade_entry || '未設定'}
停損價：${stock.trade_stop || '未設定'}
目標價：${stock.trade_tp1 || '未設定'}
法人動向：投信 ${stock.trust_net || 0}、外資 ${stock.foreign_net || 0}
新聞情緒：${stock.news_summary || '無'}
系統評語：${stock.ai_comment || '無'}

請依照以下格式回答（不要用 markdown 符號，每段空一行）：

🚦 結論
（只能三選一：✅ 可以買 / ⏸ 再等等 / ❌ 不要碰，後面加一句白話理由）

💰 怎麼買
（用限價單掛多少元。以 10 萬元資金為例建議買幾股——可以是零股，並換算大約要花多少錢）

🛡️ 保命規則
（跌到多少元「一定」要全部賣掉，這條不能凹單。建議在券商 App 設好到價提醒）

🎯 獲利目標
（漲到多少元先賣一半、漲到多少元全部出場）

⚠️ 最大風險
（一句話講這檔最可能讓你賠錢的情境）

語氣像懂股票的好朋友，直接、務實。全部繁體中文，250 字以內。`;

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch(
        "https://zfkwzbupyvrrthuowchc.supabase.co/functions/v1/claude-proxy",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authSession?.access_token || ''}`
          },
          body: JSON.stringify({ prompt, max_tokens: 800 })
        }
      );
      const data = await response.json();
      const text = data.content?.[0]?.text || data.error || "⚠️ 情報解碼失敗";
      setStockAiReport({ text, links: [] });
    } catch (e) {
      setStockAiReport({ text: "⚠️ 情報解碼失敗，請稍後再試。", links: [] });
    } finally {
      setIsStockAiLoading(false);
    }
  };

  const handleExport = async (type: 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      const reportText = await fetchLatestAiReport();
      const exportData = {
        eliteList: processedData.eliteList,
        portfolioList: processedData.portfolioList,
        reportText,
        marketRegime: processedData.marketRegime,
        latestDate: processedData.latestDate,
      };
      if (type === 'excel') exportToExcel(exportData);
      else exportToPdf(exportData);
    } catch (e) { console.error(e); }
    finally { setIsExporting(false); setIsExportOpen(false); }
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
          <img src="/logo.png" alt="Shiba Analyst" className="w-20 h-20 rounded-2xl mb-4 mx-auto shadow-md ring-1 ring-slate-100" />
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
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E8973A]/30 focus:border-[#E8973A] transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">
              {authMode === 'login' ? 'Access Key' : '設定密碼'}
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder={authMode === 'login' ? '請輸入密碼' : '至少 6 個字元'}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E8973A]/30 focus:border-[#E8973A] transition-all"
            />
          </div>

          {/* 註冊專用：確認密碼 */}
          {authMode === 'register' && (
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">確認密碼</label>
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                placeholder="再次輸入密碼"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E8973A]/30 focus:border-[#E8973A] transition-all"
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
            className="w-full bg-[#1A1A1A] text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#E8973A] transition-all mt-2 disabled:opacity-50"
          >
            {authLoading ? '處理中...' : authMode === 'login' ? '進入指揮部' : '建立帳號'}
          </button>
        </form>

        {/* 切換提示 */}
        <p className="text-center text-[11px] text-slate-400 mt-6">
          {authMode === 'login' ? (
            <>還沒有帳號？<button onClick={() => { setAuthMode('register'); setAuthError(''); }} className="text-[#E8973A] font-bold hover:underline">立即註冊</button></>
          ) : (
            <>已有帳號？<button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-[#E8973A] font-bold hover:underline">直接登入</button></>
          )}
        </p>
      </div>
    </div>
  );

  const isBearMarket = processedData.marketRegime === 'BEAR';
  // 今日大盤急跌警示（即使中期趨勢多頭，單日重挫也要擋住新手追高）
  const dayCaution = processedData.marketDayCaution;
  const showCrashBanner = !isBearMarket && (dayCaution === 'CRASH' || dayCaution === 'WEAK');

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#1A1A1A] pb-32">

      {/* ── 問題5：大盤空頭全寬警告橫幅 ── */}
      {isBearMarket && (
        <div className="w-full bg-[#E8973A] text-white px-6 py-3 flex items-center justify-center gap-3 text-center">
          <AlertTriangle size={16} className="shrink-0 animate-pulse" />
          <p className="text-xs font-bold tracking-wide">
            🔴 大盤空頭警戒中 — 系統已封鎖新買進訊號，請專注管理現有庫存停損
          </p>
          <AlertTriangle size={16} className="shrink-0 animate-pulse" />
        </div>
      )}

      {/* ── 今日大盤急跌警示（趨勢多頭但單日重挫，保護新手別追高）── */}
      {showCrashBanner && (
        <div className={`w-full px-6 py-3 flex items-center justify-center gap-3 text-center ${dayCaution === 'CRASH' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>
          <AlertTriangle size={16} className="shrink-0 animate-pulse" />
          <p className="text-xs font-bold tracking-wide">
            {processedData.marketCautionMsg || `大盤今日下跌 ${processedData.marketChangePct?.toFixed(1)}%，雖然中期仍是多頭，但今天先別追高`}
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
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Shiba Analyst" className="w-9 h-9 rounded-xl ring-1 ring-slate-100" />
            <h1 className="serif-text text-xl font-bold tracking-tighter">Alpha Ledger</h1>
          </div>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex gap-8">
            {[
              { id: 'elite', label: '獲利雷達', icon: Compass },
              { id: 'ai', label: '🤖 AI 特區', icon: Cpu },
              { id: 'full', label: '全市場審查', icon: Layout },
              { id: 'portfolio', label: `資產帳冊${processedData.stopLossAlerts.length > 0 ? ` 🔴${processedData.stopLossAlerts.length}` : ''}`, icon: Wallet }
            ].map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id as ViewMode)}
                className={`flex items-center gap-2 text-[11px] font-bold transition-all ${activeView === v.id ? 'text-[#E8973A]' : 'text-slate-400 hover:text-slate-600'}`}>
                <v.icon size={14} /> {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* 大盤狀態 badge：趨勢 + 今日漲跌（兩層資訊一眼看懂）*/}
          <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
            isBearMarket ? 'bg-red-50 text-red-600 border-red-200' :
            processedData.marketRegime === 'BULL' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
            'bg-yellow-50 text-yellow-600 border-yellow-200'
          }`}>
            <span>{isBearMarket ? '🔴 空頭' : processedData.marketRegime === 'BULL' ? '🟢 多頭' : '🟡 盤整'}</span>
            {processedData.marketChangePct != null && (
              <span className={`mono-text font-black ${processedData.marketChangePct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {processedData.marketChangePct >= 0 ? '▲' : '▼'}{Math.abs(processedData.marketChangePct).toFixed(1)}%
              </span>
            )}
          </div>
          <button onClick={() => setIsGlobalReportOpen(true)} className="bg-[#E8973A] text-white px-5 py-2.5 rounded-full text-[10px] font-bold flex items-center gap-2 hover:bg-[#cf8429] transition-all shadow-lg shadow-amber-900/10">
            <Cpu size={14} /> AI 深度獲利報告
          </button>
          {/* 匯出報表 */}
          <div className="relative">
            <button onClick={() => setIsExportOpen(!isExportOpen)} className="bg-[#1A1A1A] text-white px-5 py-2.5 rounded-full text-[10px] font-bold flex items-center gap-2 hover:bg-slate-700 transition-all">
              <FileDown size={14} /> 匯出報表
            </button>
            {isExportOpen && (
              <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 w-52 z-[300]">
                <button onClick={() => handleExport('pdf')} disabled={isExporting} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-left disabled:opacity-50">
                  <FileText size={16} className="text-[#E8973A]" />
                  <div>
                    <p className="text-xs font-bold">專業投資日報 PDF</p>
                    <p className="text-[9px] text-slate-400">完整排版，適合存檔/分享</p>
                  </div>
                </button>
                <button onClick={() => handleExport('excel')} disabled={isExporting} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-left disabled:opacity-50">
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold">Excel 完整數據</p>
                    <p className="text-[9px] text-slate-400">精選/持股/AI報告 三張工作表</p>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button onClick={() => signOut()} className="text-slate-400 hover:text-[#E8973A] transition-colors"><LogOut size={16} /></button>
        </div>
      </nav>

      {/* ── 手機底部導覽 ── */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[92%] max-w-[420px]">
        <div className="bg-[#1A1A1A] text-white rounded-[2rem] px-2 py-3 flex items-center justify-around shadow-2xl border border-white/5">
          {[
            { id: 'elite', label: '雷達', icon: Compass },
            { id: 'ai', label: 'AI', icon: Cpu },
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
          <button onClick={() => { setGlobalReportType('daily'); setIsGlobalReportOpen(true); }} className="flex-1 flex flex-col items-center gap-1 text-[#E8973A] active:scale-90">
            <Zap size={22} fill="currentColor" />
            <span className="text-[9px] font-bold tracking-tighter">AI 報告</span>
          </button>
        </div>
      </div>

      {/* ── 主內容 ── */}
      <main className="max-w-[1200px] mx-auto px-4 lg:px-8 py-6">
        <header className="mb-10 lg:flex items-end justify-between border-b border-slate-100 pb-8">
          <div className="lg:hidden flex items-center gap-2.5 mb-5">
            <img src="/logo.png" alt="Shiba Analyst" className="w-9 h-9 rounded-xl ring-1 ring-slate-100" />
            <span className="serif-text text-lg font-bold tracking-tight text-[#1A1A1A]">Alpha Ledger</span>
          </div>
          <div>
            <h2 className="serif-text text-4xl lg:text-5xl font-bold tracking-tight mb-2">
              {activeView === 'elite' ? '精選雷達' : activeView === 'ai' ? 'AI 特區' : activeView === 'full' ? '市場審查' : '資產帳冊'}
            </h2>
            <p className="text-[11px] text-[#E8973A] font-black uppercase tracking-[0.4em]">
              {activeView === 'elite' ? 'Elite Conviction List' : activeView === 'ai' ? 'AI Sector Radar' : activeView === 'full' ? 'Comprehensive Audit' : 'Asset Management'}
            </p>
          </div>
          <div className="hidden lg:block">
            <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} dataDate={processedData.latestDate} isCurrent={processedData.isCurrent} />
          </div>
          {/* 手機版匯出按鈕 */}
          <div className="lg:hidden flex gap-2 mt-4">
            <button onClick={() => handleExport('pdf')} disabled={isExporting} className="flex-1 bg-[#1A1A1A] text-white py-3 rounded-2xl text-[10px] font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <FileText size={14} /> 匯出 PDF 日報
            </button>
            <button onClick={() => handleExport('excel')} disabled={isExporting} className="flex-1 bg-white border border-slate-200 text-[#1A1A1A] py-3 rounded-2xl text-[10px] font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <FileSpreadsheet size={14} className="text-emerald-600" /> 匯出 Excel
            </button>
          </div>
        </header>

        {activeView !== 'portfolio' && (
          <MarketBriefing brief={processedData.marketBrief} loading={state.loading} marketRegime={processedData.marketRegime} />
        )}

        <div className="flex gap-2 mb-10 bg-slate-100/50 p-1.5 rounded-2xl w-fit mx-auto lg:mx-0 border border-slate-100 shadow-inner">
          <button onClick={() => setStrategy('short')} className={`px-8 py-3 rounded-xl text-[11px] font-bold transition-all ${strategy === 'short' ? 'bg-[#E8973A] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>當沖雷達</button>
          <button onClick={() => setStrategy('long')} className={`px-8 py-3 rounded-xl text-[11px] font-bold transition-all ${strategy === 'long' ? 'bg-[#1A1A1A] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>波段佈局</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeView === 'portfolio' && (
            <div onClick={() => setIsManualAdding(!isManualAdding)} className="group relative rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-3 transition-all hover:bg-white hover:border-[#1A1A1A] cursor-pointer h-full min-h-[220px]">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300 group-hover:text-[#1A1A1A] group-hover:bg-slate-100 transition-all shadow-sm"><Plus size={32} /></div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-[#1A1A1A]">登錄新資產</span>
            </div>
          )}

          {(activeView === 'elite' ? processedData.eliteList : activeView === 'ai' ? processedData.aiList : activeView === 'full' ? processedData.fullList : processedData.portfolioList).map(s => (
            <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => { setSelectedStock(s); setStockAiReport(null); }} />
          ))}

          {activeView === 'ai' && processedData.aiList.length === 0 && !state.loading && (
            <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-slate-100">
              <p className="serif-text text-2xl text-slate-300 italic mb-2">今日 AI 題材股整理中</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">每日掃描後更新</p>
            </div>
          )}

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
              <input autoFocus type="text" placeholder="輸入標的代碼或名稱..." className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-5 text-sm font-bold outline-none shadow-inner" value={searchQuery} onChange={async e => { setSearchQuery(e.target.value); if (e.target.value.length >= 1) { const results = await searchStockAcrossHistory(e.target.value); setManualSearchResults(results); } else { setManualSearchResults([]); } }} />
            </div>
            <div className="space-y-3 max-h-[340px] overflow-y-auto scrollbar-hide">
              {(manualSearchResults.length > 0 ? manualSearchResults : processedData.searchResults).map(s => (
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

              {/* 搜尋不到也能手動登錄（如集盛這類系統未分析的股票）*/}
              {searchQuery.trim() && (
                <div
                  onClick={() => {
                    const q = searchQuery.trim();
                    const stub = {
                      id: 'manual-' + Date.now(),
                      stock_code: q, stock_name: q,
                      close_price: 0, analysis_date: 'N/A', trade_signal: 'HOLD',
                      ai_score: 0, score_short: 0, score_long: 0,
                      roe: null, revenue_yoy: null, pe_ratio: null, vol_ratio: 1, volatility: 0,
                    } as unknown as DailyAnalysis;
                    setSelectedStock(stub);
                    setIsManualAdding(false);
                    setManualSearchResults([]);
                    setSearchQuery('');
                  }}
                  className="flex items-center justify-between p-5 bg-[#1A1A1A] text-white rounded-2xl cursor-pointer transition-all hover:opacity-90"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block tracking-widest mb-0.5">找不到？直接手動登錄</span>
                    <span className="text-lg font-bold">✏️ 新增「{searchQuery.trim()}」</span>
                  </div>
                  <div className="bg-white/15 p-2 rounded-xl"><ArrowUpRight size={18} /></div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-4 text-center leading-relaxed">輸入股票代碼（如 <span className="font-bold">1455</span>）系統較能抓到現價；找不到時可手動登錄追蹤</p>
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
