import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Compass, Layout, Wallet, LogOut, Search, Plus, Zap, Cpu,
  ArrowUpRight, ChevronRight, X, AlertTriangle, FileDown, FileSpreadsheet, FileText
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, supabase, signOut, addToPortfolio, removeFromPortfolio, updatePortfolio, fetchHoldingAdvice, fetchRealtimeQuotes, searchStockAcrossHistory, fetchLatestAiReport, repairPortfolioCodes } from './services/supabase';
import { exportToExcel, exportToPdf } from './utils/exportReport';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { MarketBriefing } from './components/MarketBriefing';
import { StockDetailModal } from './components/StockDetailModal';
import { ShibaChat } from './components/ShibaChat';
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
  const [marketSearch, setMarketSearch] = useState(''); // 市場列表快速搜尋（代碼/名稱）
  const [historyResults, setHistoryResults] = useState<DailyAnalysis[]>([]); // 今日沒掃到時的歷史庫搜尋結果（如力積電）

  const [isGlobalReportOpen, setIsGlobalReportOpen] = useState(false);
  const [globalReportType, setGlobalReportType] = useState<'daily' | 'weekly'>('daily');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [stockAiReport, setStockAiReport] = useState<{text: string, links: {title: string, uri: string}[]} | null>(null);
  const [isStockAiLoading, setIsStockAiLoading] = useState(false);
  const [holdingAdvice, setHoldingAdvice] = useState<Record<string, any>>({}); // GBrain 持股建議（純代碼→建議）
  const [realtimeQuotes, setRealtimeQuotes] = useState<Record<string, number>>({}); // 持股即時價（純代碼→現價）

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!session) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const [marketData, portfolioRaw, adviceMap] = await Promise.all([fetchDailyAnalysis(), fetchPortfolio(), fetchHoldingAdvice()]);
      // 🩹 自動修復壞代碼（如舊資料把「集盛」存成代碼）→ 修好後重新抓一次帳冊
      const portfolioData = (await repairPortfolioCodes(portfolioRaw)) ? await fetchPortfolio() : portfolioRaw;
      setHoldingAdvice(adviceMap);
      setState({ data: marketData, portfolio: portfolioData, loading: false, error: null, lastUpdated: new Date() });
      // 持股即時價 fallback（讓未分析/盤中的持股也有現價、損益不開天窗）
      fetchRealtimeQuotes(portfolioData.map(p => p.stock_code)).then(setRealtimeQuotes);
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  // 代碼正規化：去掉 .TW/.TWO 後綴，讓「1455」與「1455.TW」能對得上（持股合併用）
  const normCode = (c?: string) => (c || '').replace(/\.(TW|TWO)$/i, '').trim().toUpperCase();

  // 台股盤中判斷（週一~五 09:00–13:35 台灣時間）——盤中才輪詢即時價，收盤後不浪費請求
  const isTwMarketOpen = () => {
    const tw = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const d = tw.getDay(), t = tw.getHours() * 60 + tw.getMinutes();
    return d >= 1 && d <= 5 && t >= 540 && t <= 815;
  };

  const processedData = useMemo(() => {
    const latestSnapshotMap = new Map<string, DailyAnalysis>();
    const scoreHistoryMap = new Map<string, number[]>();

    state.data.forEach(item => {
      const nk = normCode(item.stock_code);
      if (!latestSnapshotMap.has(nk)) latestSnapshotMap.set(nk, item);
      if (!scoreHistoryMap.has(item.stock_code)) scoreHistoryMap.set(item.stock_code, []);
      const scores = scoreHistoryMap.get(item.stock_code);
      if (scores && scores.length < 5) scores.push(strategy === 'short' ? Number(item.score_short || 0) : Number(item.score_long || 0));
    });

    // ⚠️ 算「最新日期」只看真正的股票列，略過 MARKET_*/SIGNAL_STATS 這些特殊列——
    //    否則回測寫一筆「今天」的 SIGNAL_STATS、但今天選股還沒跑時，latestDate 會指到沒有股票的日期 → 清單變空白
    const SPECIAL_CODES = new Set(['MARKET_BRIEF', 'MARKET_STATE', 'SIGNAL_STATS']);
    const allDates = [...new Set(state.data.filter(s => !SPECIAL_CODES.has(s.stock_code)).map(s => s.analysis_date))].sort().reverse();
    const latestDate = allDates[0] || null;
    const latestData = latestDate ? state.data.filter(s => s.analysis_date === latestDate) : [];
    const marketBrief = latestData.find(s => s.stock_code === 'MARKET_BRIEF') || null;
    // 清單股價套用盤中即時價（TWSE MIS 免費），有即時價的標 rt_live 顯示綠點
    const latestStocks = latestData
      .filter(s => s.stock_code !== 'MARKET_BRIEF' && s.stock_code !== 'MARKET_STATE' && s.stock_code !== 'SIGNAL_STATS')
      .map(s => {
        const rt = realtimeQuotes[normCode(s.stock_code)];
        return rt && rt > 0 && rt !== Number(s.close_price) ? { ...s, close_price: rt, rt_live: true } : s;
      });

    // 📊 訊號歷史命中率（回測寫進 SIGNAL_STATS 列的 ai_comment，JSON）→ 卡片「同類訊號近半年命中 X 成」
    //    量法＝碰TP1先於停損；含近月/前月趨勢；_gbrain＝GBrain 高機會自驗命中率趨勢（真正的進步記分板）
    type WinStat = { wr: number; n: number; wr_recent?: number | null; n_recent?: number; wr_prev?: number | null; n_prev?: number };
    const { signalStats, gbrainTrend } = ((): { signalStats: Record<string, WinStat>; gbrainTrend: WinStat | null } => {
      const row = state.data.find(s => s.stock_code === 'SIGNAL_STATS');
      if (!row?.ai_comment) return { signalStats: {}, gbrainTrend: null };
      try {
        const parsed = JSON.parse(row.ai_comment as string);
        const out: Record<string, WinStat> = {};
        Object.entries(parsed).forEach(([k, v]: [string, any]) => {
          if (!k.startsWith('_') && v && typeof v.wr === 'number') out[k.toUpperCase()] = v;
        });
        const gb = parsed._gbrain && typeof parsed._gbrain.wr === 'number' ? parsed._gbrain : null;
        return { signalStats: out, gbrainTrend: gb };
      } catch { return { signalStats: {}, gbrainTrend: null }; }
    })();

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

    // 追高判定（與卡片一致）：買進訊號且現價比建議買點高 >3% → 追高，排序時往後放
    const isChasing = (s: DailyAnalysis) => {
      const buy = ['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY'].includes((s.trade_signal || '').toUpperCase());
      const entry = Number(s.trade_entry) || 0;
      if (!buy || entry <= 0) return false;
      return (Number(s.close_price) / entry) > 1.03;
    };

    // 🏆 嚴選七盞燈（2026-07-02 回測 7371 筆驗證：亮燈越多勝率越高——0燈34.5%→4燈52.8%，近月同樣一路遞增。
    //    其中「AI題材」是最強單一條件 56.6% vs 基準 48%）。順序照證據強度排，燈名會顯示在卡片上。
    const PICK_CONDS: [string, (s: DailyAnalysis) => boolean][] = [
      ['AI題材',   s => !!s.ai_theme],
      ['高機會',   s => s.opportunity_label === '🔥 高機會'],
      ['均線多頭', s => !!s.trend_bull],
      ['法人同買', s => (Number(s.foreign_net) || 0) > 0 && (Number(s.trust_net) || 0) > 0],
      ['新聞偏多', s => (Number(s.news_score) || 0) > 0],
      ['溫和放量', s => { const v = Number(s.vol_ratio) || 0; return v >= 1.3 && v <= 3.0; }],
      ['MACD金叉', s => !!s.macd_cross],
    ];
    const litMap: Record<string, string[]> = {};
    latestStocks.forEach(s => { litMap[normCode(s.stock_code)] = PICK_CONDS.filter(([, fn]) => fn(s)).map(([n]) => n); });
    const litCount = (s: DailyAnalysis) => (litMap[normCode(s.stock_code)] || []).length;
    // 雷達/市場排序用「不含AI題材」的燈數——雷達要看全台股體質，不因 AI 題材加分而擠掉其他好股；
    // AI 偏好只留在「今日嚴選」（七盞全算）與「AI 特區」
    const litCountNoAI = (s: DailyAnalysis) => (litMap[normCode(s.stock_code)] || []).filter(n => n !== 'AI題材').length;

    // 排序（全清單一致，看得懂）：① 可進場優先於追高 ② 亮燈數多的優先（不含AI燈）③ 再依分數
    let baseList = [...latestStocks].sort((a, b) => {
      const ca = isChasing(a) ? 1 : 0, cb = isChasing(b) ? 1 : 0;
      if (ca !== cb) return ca - cb;
      const la = litCountNoAI(a), lb = litCountNoAI(b);
      if (la !== lb) return lb - la;
      return getEliteScore(b) - getEliteScore(a);
    });

    // 🏆 今日嚴選：可進場＋非地雷＋亮燈≥3 的買進訊號，取前 5。寧缺勿濫（不夠就少列）。
    const isBuySig = (s: DailyAnalysis) => ['STRONG_BUY', 'SWING_BUY', 'DAYTRADE_BUY'].includes((s.trade_signal || '').toUpperCase());
    const pickPool = latestStocks
      .filter(s => isBuySig(s) && !isChasing(s) && !s.risk_flag && litCount(s) >= 3)
      .sort((a, b) => {
        const d = litCount(b) - litCount(a);
        if (d) return d;
        return (Number(b.opportunity_score) || Number(b.ai_score) || 0) - (Number(a.opportunity_score) || Number(a.ai_score) || 0);
      });
    const topPicks = pickPool.slice(0, 5);
    const aiTopPicks = pickPool.filter(s => s.ai_theme).slice(0, 5);
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
      const mkt = latestSnapshotMap.get(normCode(p.stock_code));
      // 現價優先序：即時報價 > 當日分析收盤 > 買入價（讓未分析的持股也有現價）
      const rt = realtimeQuotes[normCode(p.stock_code)];
      const currentPrice = (rt && rt > 0) ? rt : (mkt ? Number(mkt.close_price) : Number(p.buy_price));
      const advice = holdingAdvice[normCode(p.stock_code)] || null; // GBrain 持股建議
      const breakeven = Number(p.buy_price) * 1.00585; // 損益平衡＝成交價＋來回手續費(0.1425%×2)＋證交稅(0.3%)
      return {
        ...(mkt || {
          id: p.id, stock_code: p.stock_code, stock_name: p.stock_name,
          close_price: p.buy_price, analysis_date: 'N/A', trade_signal: 'HOLD',
          ai_score: 0, score_short: 0, score_long: 0, roe: null, revenue_yoy: null, pe_ratio: null,
          vol_ratio: 1, volatility: 0
        }),
        // ⚠️ 用帳冊自己的代碼（不是 daily_analysis 的 .TW 版），編輯/移除才對得上資料庫那筆
        stock_code: p.stock_code,
        buy_price: Number(p.buy_price),
        close_price: currentPrice,
        quantity: p.quantity,
        profit_loss_ratio: ((currentPrice - p.buy_price) / p.buy_price) * 100,
        // quantity 存的是「股數」，實際損益金額 = (現價-成本) × 股數
        profit_loss_amount: (currentPrice - p.buy_price) * Number(p.quantity),
        is_holding_item: true,
        breakeven_price: breakeven,
        gbrain_action: advice?.action_label || null,
        gbrain_reason: advice?.reason || null,
        portfolio_id: p.id,
      } as DailyAnalysis;
    });

    // 找出需要停損的庫存
    const stopLossAlerts = portfolioList.filter(s =>
      s.trade_signal === 'SELL_STOP' ||
      (s.trade_stop && s.close_price < s.trade_stop)
    );

    // 💼 帳冊統計（像三竹：總成本/總市值/總損益）＋ 配置占比（圖表用）
    const totalCost = portfolioList.reduce((s, p) => s + (Number((p as any).buy_price) || 0) * (Number((p as any).quantity) || 0), 0);
    const totalValue = portfolioList.reduce((s, p) => s + (Number(p.close_price) || 0) * (Number((p as any).quantity) || 0), 0);
    const totalPL = totalValue - totalCost;
    const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    const allocation = portfolioList
      .map(p => ({ name: p.stock_name || '', value: (Number(p.close_price) || 0) * (Number((p as any).quantity) || 0), pl: Number((p as any).profit_loss_amount) || 0 }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const portfolioSummary = { totalCost, totalValue, totalPL, totalPLPct, allocation, count: portfolioList.length };

    // 🤖 AI 特區：只收 AI 題材股；排序與全站一致＝① 可進場 ② 亮燈數 ③ 分數
    const aiList = [...latestStocks]
      .filter(s => s.ai_theme)
      .sort((a, b) => {
        const ca = isChasing(a) ? 1 : 0, cb = isChasing(b) ? 1 : 0;
        if (ca !== cb) return ca - cb;
        const la = litCount(a), lb = litCount(b);
        if (la !== lb) return lb - la;
        return (Number(b.opportunity_score) || Number(b.ai_score) || 0) -
               (Number(a.opportunity_score) || Number(a.ai_score) || 0);
      });

    return {
      marketBrief,
      marketRegime,
      marketChangePct,
      marketDayCaution,
      marketCautionMsg,
      signalStats,
      gbrainTrend,
      eliteList,
      aiList,
      topPicks,
      aiTopPicks,
      litMap,
      fullList: baseList,
      portfolioList,
      portfolioSummary,
      stopLossAlerts,
      latestDate,
      isCurrent: latestDate === format(new Date(), 'yyyy-MM-dd'),
      searchResults: searchQuery ? latestStocks.filter(s => s.stock_name.includes(searchQuery) || s.stock_code.includes(searchQuery)).slice(0, 5) : []
    };
  }, [state.data, state.portfolio, strategy, searchQuery, holdingAdvice, realtimeQuotes]);

  // 📡 盤中即時價輪詢（免費：TWSE MIS 經 quote edge function，v2 支援整批分批打）：
  // 涵蓋「今日全部分析股（雷達/AI/市場/嚴選都是它的子集）＋帳冊持股」，
  // 開盤時間每 60 秒更新一次；收盤後、分頁隱藏時不輪詢不浪費。
  const pdRef = useRef(processedData);
  pdRef.current = processedData;
  useEffect(() => {
    if (!session) return;
    const poll = () => {
      if (document.visibilityState === 'hidden') return; // 分頁沒在看就不打
      const pd = pdRef.current;
      const codes = [...new Set([
        ...pd.fullList.map(s => s.stock_code),      // 今日全部（雷達/AI/市場/嚴選皆子集）
        ...pd.portfolioList.map(s => s.stock_code), // 持股（含今天沒被掃到的）
      ])].slice(0, 500);
      if (codes.length) fetchRealtimeQuotes(codes).then(q => {
        if (Object.keys(q).length) setRealtimeQuotes(prev => ({ ...prev, ...q }));
      });
    };
    poll(); // 進頁先抓一次（收盤後 MIS 回昨收，也能補未分析股的現價）
    const id = setInterval(() => { if (isTwMarketOpen()) poll(); }, 60_000);
    const onVis = () => { if (document.visibilityState === 'visible' && isTwMarketOpen()) poll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, processedData.latestDate]);

  // 🔍 市場搜尋歷史庫遞補：今天沒掃到的股（如力積電）自動翻歷史紀錄＋抓即時價
  useEffect(() => {
    const q = marketSearch.trim();
    if (activeView !== 'full' || q.length < 2) { setHistoryResults([]); return; }
    const ql = q.toLowerCase();
    const inToday = pdRef.current.fullList.some(s =>
      (s.stock_code || '').replace('.TW', '').toLowerCase().includes(ql) || (s.stock_name || '').toLowerCase().includes(ql));
    if (inToday) { setHistoryResults([]); return; }
    const t = setTimeout(async () => {
      const rows = await searchStockAcrossHistory(q);
      setHistoryResults(rows.slice(0, 6) as DailyAnalysis[]);
      if (rows.length) fetchRealtimeQuotes(rows.map(r => r.stock_code)).then(qt => {
        if (Object.keys(qt).length) setRealtimeQuotes(prev => ({ ...prev, ...qt }));
      });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketSearch, activeView]);

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

  const handleUpdatePortfolio = async (stock: DailyAnalysis, buyPrice: number, quantity: number) => {
    try {
      if (!Number.isFinite(buyPrice) || !Number.isFinite(quantity)) return;
      await updatePortfolio(stock.stock_code, buyPrice, quantity);
      await loadData();
      setSelectedStock(null); // 關閉彈窗，回帳冊看更新後的數字
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
              <span className={`mono-text font-black ${processedData.marketChangePct >= 0 ? 'text-[#C83232]' : 'text-emerald-600'}`}>
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

        {/* 🧠 GBrain 體檢：高機會預測「自驗命中率」近月 vs 前月趨勢 → 看得出系統有沒有越來越聰明 */}
        {activeView !== 'portfolio' && processedData.gbrainTrend && (() => {
          const g = processedData.gbrainTrend;
          const hasTrend = typeof g.wr_recent === 'number' && typeof g.wr_prev === 'number';
          const up = hasTrend && (g.wr_recent as number) > (g.wr_prev as number);   // 進步＝紅(台灣慣例好＝紅)
          const down = hasTrend && (g.wr_recent as number) < (g.wr_prev as number);
          const arrow = up ? '↗' : down ? '↘' : '→';
          const col = up ? '#C83232' : down ? '#10b981' : '#8B8270';
          return (
            <div className="mb-8 -mt-4 flex items-center gap-3 px-4 py-3 bg-[#FBF6EC] border border-[#E8973A]/30 rounded-2xl">
              <span className="text-[16px]">🧠</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[11px] font-black text-[#1A1A1A] tracking-wide">GBrain 體檢 · 高機會命中率</span>
                  {hasTrend ? (
                    <span className="text-[12px] font-bold" style={{ fontFamily: 'monospace', color: col }}>
                      前月 {g.wr_prev}% {arrow} 近月 {g.wr_recent}%
                    </span>
                  ) : (
                    <span className="text-[12px] font-bold" style={{ fontFamily: 'monospace', color: '#8B8270' }}>累計 {g.wr}%（趨勢待累積）</span>
                  )}
                  <span className="text-[10px] text-[#B8A882]" style={{ fontFamily: 'monospace' }}>· 累計 {g.n} 次驗證</span>
                </div>
                <p className="text-[9px] text-[#8B7E68] mt-0.5 leading-tight">
                  GBrain 自己標的「🔥 高機會」事後對帳命中率。{up ? '近月在進步 📈' : down ? '近月退步，演算法會自動調權修正' : '持平累積中'}。非投資建議。
                </p>
              </div>
            </div>
          );
        })()}

        {/* 💼 帳冊統計（像三竹）：總損益大卡 ＋ 持股配置圓餅 */}
        {activeView === 'portfolio' && processedData.portfolioList.length > 0 && (() => {
          const sm = processedData.portfolioSummary;
          const up = sm.totalPL >= 0; // 台灣慣例：賺=紅、賠=綠
          const plColor = up ? '#C83232' : '#10b981';
          const PIE = ['#E8973A', '#1A1A1A', '#C83232', '#D9A441', '#6B7280', '#C87832', '#8B5E3C', '#A8A29E'];
          const fmt = (n: number) => Math.round(n).toLocaleString();
          return (
            <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-[#F8F4EE] border border-[#DDD5C4] rounded-3xl p-6 lg:p-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-[#B8A882] uppercase tracking-widest">總資產損益</span>
                  <span className="text-[10px] text-[#B8A882] font-bold">{sm.count} 檔持股</span>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-4xl lg:text-5xl font-bold leading-none" style={{ fontFamily: 'monospace', color: plColor }}>
                    {up ? '+' : '−'}{fmt(Math.abs(sm.totalPL))}
                  </span>
                  <span className="text-base font-bold text-[#5A4E3C]">元</span>
                  <span className="text-lg font-bold ml-1" style={{ color: plColor }}>{up ? '▲' : '▼'} {Math.abs(sm.totalPLPct).toFixed(2)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-[#DDD5C4]">
                  <div className="bg-white/70 rounded-2xl py-2.5 px-4">
                    <p className="text-[9px] text-[#B8A882] font-bold uppercase tracking-wider mb-0.5">總成本</p>
                    <p className="text-base font-bold text-[#1A1A1A]" style={{ fontFamily: 'monospace' }}>{fmt(sm.totalCost)}</p>
                  </div>
                  <div className="bg-white/70 rounded-2xl py-2.5 px-4">
                    <p className="text-[9px] text-[#B8A882] font-bold uppercase tracking-wider mb-0.5">總市值</p>
                    <p className="text-base font-bold text-[#1A1A1A]" style={{ fontFamily: 'monospace' }}>{fmt(sm.totalValue)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#F8F4EE] border border-[#DDD5C4] rounded-3xl p-4">
                <p className="text-[11px] font-bold text-[#B8A882] uppercase tracking-widest mb-1 px-2">持股配置 · 市值占比</p>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={sm.allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2}>
                      {sm.allocation.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [`${fmt(v)} 元`, n]} contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}

        {/* 🔍 市場列表快速搜尋：打代碼或名稱即時篩選，不用一筆一筆找 */}
        {activeView === 'full' && (
          <div className="relative mb-6">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="🔍 搜尋代碼或名稱（如 2330、台積電）"
              value={marketSearch}
              onChange={e => setMarketSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-12 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-[#E8973A]/30 focus:border-[#E8973A] transition-all shadow-sm"
            />
            {marketSearch && (
              <button onClick={() => setMarketSearch('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1A1A1A] text-sm font-bold">✕</button>
            )}
          </div>
        )}

        {/* 🏆 今日嚴選：可進場＋亮燈≥3 的前 5 檔（AI 特區只嚴選 AI 股）。下面完整清單照舊保留 */}
        {(activeView === 'elite' || activeView === 'ai') && (() => {
          const picks = activeView === 'ai' ? processedData.aiTopPicks : processedData.topPicks;
          return (
            <div className="mb-12">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
                <h3 className="text-[15px] font-black text-[#1A1A1A] tracking-wide">🏆 今日嚴選</h3>
                <span className="text-[10px] font-bold text-slate-400">可進場＋亮燈≥3 才入選 · 歷史驗證：燈越多越會漲（0燈34%→4燈53%）</span>
              </div>
              {picks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {picks.map((s, i) => (
                    <ActionCard key={`pick-${s.id}`} stock={s} strategyMode={strategy} signalStats={processedData.signalStats}
                      pickInfo={{ rank: i + 1, conds: processedData.litMap[(s.stock_code || '').replace(/\.(TW|TWO)$/i, '').toUpperCase()] || [] }}
                      onSelect={() => { setSelectedStock(s); setStockAiReport(null); }} />
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center bg-white rounded-[2rem] border border-slate-100">
                  <p className="serif-text text-lg text-slate-300 italic mb-1">今日沒有「可進場＋亮燈≥3」的標的</p>
                  <p className="text-[10px] font-bold text-slate-400">寧缺勿濫——條件不夠就先別出手，等好球再揮棒</p>
                </div>
              )}
              <div className="flex items-baseline gap-3 mt-10 mb-2">
                <h3 className="text-[13px] font-black text-slate-500 tracking-wide">完整觀察清單</h3>
                <span className="text-[10px] font-bold text-slate-400">排序：可進場 → 亮燈數 → 分數（追高的排最後）</span>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeView === 'portfolio' && (
            <div onClick={() => setIsManualAdding(!isManualAdding)} className="group relative rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-3 transition-all hover:bg-white hover:border-[#1A1A1A] cursor-pointer h-full min-h-[220px]">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300 group-hover:text-[#1A1A1A] group-hover:bg-slate-100 transition-all shadow-sm"><Plus size={32} /></div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-[#1A1A1A]">登錄新資產</span>
            </div>
          )}

          {(activeView === 'elite' ? processedData.eliteList : activeView === 'ai' ? processedData.aiList : activeView === 'full' ? processedData.fullList : processedData.portfolioList)
            .filter(s => {
              const q = marketSearch.trim().toLowerCase();
              if (!q || activeView !== 'full') return true;
              const code = (s.stock_code || '').replace('.TW', '').toLowerCase();
              const name = (s.stock_name || '').toLowerCase();
              return code.includes(q) || name.includes(q);
            })
            .map((s, i) => (
              <ActionCard key={s.id} stock={s} strategyMode={strategy} signalStats={processedData.signalStats}
                orderNo={activeView !== 'portfolio' ? i + 1 : undefined}
                lit={processedData.litMap[(s.stock_code || '').replace(/\.(TW|TWO)$/i, '').toUpperCase()]}
                onSelect={() => { setSelectedStock(s); setStockAiReport(null); }} />
            ))}

          {activeView === 'full' && marketSearch.trim() && processedData.fullList.filter(s => {
            const q = marketSearch.trim().toLowerCase();
            const code = (s.stock_code || '').replace('.TW', '').toLowerCase();
            const name = (s.stock_name || '').toLowerCase();
            return code.includes(q) || name.includes(q);
          }).length === 0 && (historyResults.length > 0 ? (
            <>
              <div className="col-span-full px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] font-bold text-amber-700">
                📅 「{marketSearch.trim()}」今天雷達沒掃到——以下是最近一次的分析紀錄（分析日期：{historyResults[0]?.analysis_date}），股價已換成最新即時價
              </div>
              {historyResults.map(r => {
                const rt = realtimeQuotes[(r.stock_code || '').replace(/\.(TW|TWO)$/i, '').toUpperCase()];
                return (
                  <ActionCard key={`hist-${r.stock_code}`} stock={rt && rt > 0 ? { ...r, close_price: rt, rt_live: true } : r}
                    strategyMode={strategy} signalStats={processedData.signalStats}
                    onSelect={() => { setSelectedStock(r); setStockAiReport(null); }} />
                );
              })}
            </>
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-slate-100">
              <p className="serif-text text-xl text-slate-300 italic mb-2">找不到「{marketSearch.trim()}」</p>
              <p className="text-[10px] font-bold text-slate-400 leading-relaxed">歷史資料庫也沒有這檔的分析紀錄，<br/>可能代碼/名稱有誤，或系統從未掃到過它。</p>
            </div>
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

              {/* 搜尋不到也能手動登錄（如集盛這類系統未分析的股票）
                  ⚠️ 防呆：只接受「數字代碼」(如 1455)。打名字會擋下來，避免把名字當代碼存→系統永遠分析不到。*/}
              {searchQuery.trim() && (() => {
                const q = searchQuery.trim();
                const digits = q.replace(/\.(TW|TWO)$/i, '').trim();   // 容許輸入 1455 或 1455.TW
                const isValidCode = /^\d{4,6}$/.test(digits);
                if (!isValidCode) {
                  // 打的是名字/非代碼 → 不給登錄，明確提示要打代碼
                  return (
                    <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl">
                      <span className="text-sm font-bold text-rose-600 block mb-1">⚠️ 請輸入「股票代碼」，不是名稱</span>
                      <p className="text-[11px] text-rose-500 leading-relaxed">
                        你打的是「{q}」。請改打<span className="font-bold">數字代碼</span>（例：集盛＝<span className="font-bold">1455</span>、台積電＝<span className="font-bold">2330</span>）。<br/>
                        系統要靠代碼才能分析、抓現價；打名字會變成「資料不足」。
                      </p>
                    </div>
                  );
                }
                const code = `${digits}.TW`;
                return (
                  <div
                    onClick={() => {
                      const stub = {
                        id: 'manual-' + Date.now(),
                        // 名稱先放純代碼當暫名；下次掃描分析到後，App 會自動改顯示真名（合併優先用 daily_analysis 的 stock_name）
                        stock_code: code, stock_name: digits,
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
                      <span className="text-[10px] font-bold text-slate-400 block tracking-widest mb-0.5">找不到？以代碼手動登錄</span>
                      <span className="text-lg font-bold">✏️ 新增代碼「{digits}」</span>
                    </div>
                    <div className="bg-white/15 p-2 rounded-xl"><ArrowUpRight size={18} /></div>
                  </div>
                );
              })()}
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
          onUpdatePortfolio={handleUpdatePortfolio}
          aiReport={stockAiReport}
          isAiLoading={isStockAiLoading}
        />
      )}

      {isGlobalReportOpen && (
        <GlobalAiReportModal type={globalReportType} onClose={() => setIsGlobalReportOpen(false)} portfolioStocks={state.portfolio.map(p => p.stock_name)} />
      )}

      {/* 🐕 汪汪柴犬管家：右下角浮動聊天（丟代碼查個股、問今天買什麼、問持股怎麼辦） */}
      <ShibaChat
        stocks={processedData.fullList}
        holdings={processedData.portfolioList}
        topPicks={processedData.topPicks}
        litMap={processedData.litMap}
        market={{ regime: processedData.marketRegime, changePct: processedData.marketChangePct, msg: processedData.marketCautionMsg }}
      />
    </div>
  );
};

export default App;
