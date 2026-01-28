
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Zap, LayoutGrid, Briefcase, Loader2, Target, Crown, LogOut, Flame, Rocket, Gem, Sparkles, Clock
} from 'lucide-react';
import { DashboardState, DailyAnalysis } from './types';
import { fetchDailyAnalysis, fetchPortfolio, supabase, signOut } from './services/supabase';
import { ActionCard } from './components/StockCard';
import { SystemStatus } from './components/SystemStatus';
import { MarketBriefing } from './components/MarketBriefing';
import { StockDetailModal } from './components/StockDetailModal';
import { GoogleGenAI } from "@google/genai";

type StrategyMode = 'short' | 'long';
type ViewMode = 'elite' | 'portfolio' | 'full';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [state, setState] = useState<DashboardState>({
    data: [], portfolio: [], loading: true, error: null, lastUpdated: null
  });

  const [activeView, setActiveView] = useState<ViewMode>('elite');
  const [strategy, setStrategy] = useState<StrategyMode>('short'); 
  const [filterTag, setFilterTag] = useState<string>('ALL');
  const [selectedStock, setSelectedStock] = useState<DailyAnalysis | null>(null);
  const [stockAiReport, setStockAiReport] = useState<string | null>(null);
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
      setState({ 
        data: marketData, portfolio: portfolioData, loading: false, error: null, 
        lastUpdated: new Date()
      });
    } catch (err: any) { 
      setState(prev => ({ ...prev, loading: false, error: err.message })); 
    }
  }, [session]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const processedData = useMemo(() => {
    const allDates = state.data.map(s => s.analysis_date);
    const latestDate = allDates.length > 0 ? [...new Set(allDates)].sort().reverse()[0] : null;
    const latestData = latestDate ? state.data.filter(s => s.analysis_date === latestDate) : [];

    const marketBrief = latestData.find(s => s.stock_code === 'MARKET_BRIEF') || null;
    const latestStocks = latestData.filter(s => s.stock_code !== 'MARKET_BRIEF');

    const getScore = (s: DailyAnalysis) => strategy === 'short' ? (Number(s.score_short) || 0) : (Number(s.score_long) || 0);

    // 強化的精確分類篩選邏輯
    let filteredByStrategy = latestStocks.filter(s => {
      const volRatio = Number(s.vol_ratio) || 0;
      const volatility = Number(s.volatility) || 0;
      const sScore = Number(s.score_short) || 0;
      const lScore = Number(s.score_long) || 0;

      // 使用權重計算決定標的歸屬，確保辛耘等高動能標的正確歸位
      const shortWeight = sScore + (volRatio * 5) + (volatility * 2);
      const longWeight = lScore + (Number(s.roe || 0) / 2);

      if (strategy === 'short') {
        return shortWeight >= longWeight;
      } else {
        return longWeight > shortWeight;
      }
    });

    let baseList = [...filteredByStrategy].sort((a, b) => getScore(b) - getScore(a));
    
    const filteredByTag = (list: DailyAnalysis[]) => {
      if (filterTag === 'ALL') return list;
      return list.filter(s => {
        if (filterTag === 'VOL_BURST') return (s.vol_ratio || 0) > 2.5;
        if (filterTag === 'ROE_STAR') return (s.roe || 0) > 18;
        if (filterTag === 'MOMENTUM') return (s.volatility || 0) > 4.5;
        if (filterTag === 'VALUE_GEM') return (s.score_long || 0) > 85 && (s.pe_ratio || 0) < 16;
        return true;
      });
    };

    // 資產金庫資料合成
    const portfolioList = state.portfolio.map(p => {
      const mkt = latestStocks.find(q => q.stock_code === p.stock_code);
      const currentPrice = mkt?.close_price || p.buy_price;
      const profitLossRatio = ((currentPrice - p.buy_price) / p.buy_price) * 100;
      
      // Fix type conversion error (App.tsx:109): Provide a complete fallback object that satisfies DailyAnalysis requirements
      return {
        ...(mkt || { 
          id: p.id, 
          stock_code: p.stock_code, 
          stock_name: p.stock_name, 
          close_price: p.buy_price, 
          analysis_date: 'N/A', 
          trade_signal: 'HOLD',
          ai_score: 0,
          score_short: 0,
          score_long: 0,
          roe: null,
          revenue_yoy: null,
          pe_ratio: null
        }),
        buy_price: p.buy_price,
        quantity: p.quantity,
        profit_loss_ratio: profitLossRatio,
        is_holding_item: true
      } as DailyAnalysis;
    });

    return { 
      marketBrief,
      eliteList: filteredByTag(baseList.slice(0, 15)),
      fullList: filteredByTag(baseList),
      portfolioList,
      latestDate 
    };
  }, [state.data, state.portfolio, strategy, filterTag]);

  const handleRunStockAi = async (stock: DailyAnalysis) => {
    setIsStockAiLoading(true);
    setStockAiReport(null);
    try {
      // Initialize AI instance right before call using required named parameter and environment variable
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // 強化 AI 總表健檢 Prompt
      const prompt = `你現在是 Alpha Ledger AI 總表健檢系統。
      請針對股票：${stock.stock_name}(${stock.stock_code}) 進行全維度健康檢查。
      數據指標：現價 ${stock.close_price}, ROE ${stock.roe}%, 量比 ${stock.vol_ratio}, 波動度 ${stock.volatility}。
      戰略評分：當沖分數 ${stock.score_short}, 波段分數 ${stock.score_long}。
      
      請嚴格按照以下繁體中文格式回覆：
      1. 【總體健檢評分】：(0-100)
      2. 【戰術強項】：(分析該標的最強因子)
      3. 【關鍵風險】：(當前操作最需防範的陷阱)
      4. 【最佳執行路徑】：(針對當前策略給予一句冷酷指令)`;
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: prompt 
      });
      // Correctly extract text using the .text property (not a method)
      setStockAiReport(response.text);
    } catch (e) { 
      setStockAiReport("⚠️ AI 健檢模組連線異常，請稍後再試。"); 
    }
    finally { setIsStockAiLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("金鑰無效");
    setAuthLoading(false);
  };

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <div className="w-full max-w-[340px] bg-[#0F0F0F] p-8 rounded-[2rem] border border-white/5 text-center shadow-2xl relative overflow-hidden">
        <div className="bg-rose-600 w-10 h-10 rounded-xl flex items-center justify-center text-white mx-auto mb-6">
          <Zap size={20} fill="currentColor" />
        </div>
        <h1 className="text-white text-xl font-black italic tracking-tighter uppercase mb-8">Alpha Ledger.</h1>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="操作員 ID" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-rose-500 text-sm" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="授權金鑰" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-rose-500 text-sm" />
          <button type="submit" disabled={authLoading} className="w-full bg-white text-black font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-rose-600 hover:text-white transition-all">
            {authLoading ? '驗證中...' : '解鎖終端'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F7F6] pb-24 lg:pb-8">
      {/* 桌面導航 */}
      <nav className="hidden lg:flex sticky top-0 z-[100] bg-white border-b border-slate-200 px-6 py-3 justify-between items-center backdrop-blur-md bg-opacity-95 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-1.5 rounded-lg text-white"><Zap size={14} fill="currentColor" /></div>
          <h1 className="text-lg font-black italic tracking-tighter uppercase">Alpha Ledger.</h1>
        </div>
        <div className="flex items-center gap-6">
           {[
             { id: 'elite', label: '精英雷達', icon: Target },
             { id: 'full', label: '全市場清單', icon: LayoutGrid },
             { id: 'portfolio', label: '資產金庫', icon: Briefcase }
           ].map((v) => (
             <button key={v.id} onClick={() => setActiveView(v.id as ViewMode)} className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${activeView === v.id ? 'text-slate-950 border-b-2 border-slate-950 pb-0.5' : 'text-slate-300 hover:text-slate-500'}`}>
               <v.icon size={12} /> {v.label}
             </button>
           ))}
           <button onClick={() => signOut()} className="text-slate-300 hover:text-rose-600 transition-colors ml-4"><LogOut size={14}/></button>
        </div>
      </nav>

      <main className="max-w-[1000px] mx-auto px-4 lg:px-6 py-4 lg:py-6">
        <SystemStatus lastUpdated={state.lastUpdated} isSyncing={state.loading} dataDate={processedData.latestDate} isCurrent={true} />
        
        {activeView !== 'portfolio' && <MarketBriefing brief={processedData.marketBrief} loading={state.loading} />}

        {/* 策略切換 */}
        <div className="flex justify-center mb-6">
          <div className="bg-slate-200/50 p-1 rounded-2xl flex gap-1">
            <button onClick={() => setStrategy('short')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${strategy === 'short' ? 'bg-slate-950 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              ⚡ 當沖特快
            </button>
            <button onClick={() => setStrategy('long')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${strategy === 'long' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              🌊 波段價值
            </button>
          </div>
        </div>

        {/* 標籤過濾 */}
        {activeView !== 'portfolio' && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
            {[
              { id: 'ALL', label: '全部', icon: LayoutGrid },
              { id: 'VOL_BURST', label: '量能爆發', icon: Flame },
              { id: 'ROE_STAR', label: '高 ROE', icon: Sparkles },
              { id: 'MOMENTUM', label: '強勢動能', icon: Rocket },
              { id: 'VALUE_GEM', label: '價值珍珠', icon: Gem }
            ].map(t => (
              <button key={t.id} onClick={() => setFilterTag(t.id)} className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${filterTag === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>
                <t.icon size={10} /> {t.label}
              </button>
            ))}
          </div>
        )}

        {/* 標的清單 */}
        <div className="grid grid-cols-1 gap-3">
          {activeView === 'elite' && processedData.eliteList.map(s => <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => setSelectedStock(s)} />)}
          {activeView === 'full' && processedData.fullList.map(s => <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => setSelectedStock(s)} />)}
          {activeView === 'portfolio' && processedData.portfolioList.map(s => <ActionCard key={s.id} stock={s} strategyMode={strategy} onSelect={() => setSelectedStock(s)} />)}
          
          {!state.loading && activeView === 'portfolio' && processedData.portfolioList.length === 0 && (
            <div className="py-24 text-center">
               <Briefcase size={32} className="mx-auto mb-4 text-slate-200" />
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">目前金庫中無資產</h3>
            </div>
          )}
        </div>
      </main>

      {/* 手機底部導航 */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[85%] bg-slate-950/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex justify-between shadow-2xl">
        {[
          { id: 'elite', label: '精英', icon: Target },
          { id: 'full', label: '全表', icon: LayoutGrid },
          { id: 'portfolio', label: '金庫', icon: Briefcase }
        ].map(item => (
          <button key={item.id} onClick={() => setActiveView(item.id as ViewMode)} className={`flex-1 flex flex-col items-center py-2.5 gap-1 rounded-xl transition-all ${activeView === item.id ? 'bg-white text-black shadow-lg' : 'text-white/20'}`}>
            <item.icon size={16} />
            <span className="text-[8px] font-black uppercase">{item.label}</span>
          </button>
        ))}
      </div>

      {selectedStock && (
        <StockDetailModal 
          stock={selectedStock} 
          onClose={() => { setSelectedStock(null); setStockAiReport(null); }} 
          onRunAi={() => handleRunStockAi(selectedStock)}
          aiReport={stockAiReport}
          isAiLoading={isStockAiLoading}
        />
      )}
    </div>
  );
};

export default App;