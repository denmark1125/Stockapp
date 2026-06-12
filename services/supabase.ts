
import { createClient } from '@supabase/supabase-js';
import { DailyAnalysis, PortfolioItem } from '../types';

const getSupabaseConfig = () => {
  const url = (window as any).process?.env?.NEXT_PUBLIC_SUPABASE_URL || 'https://zfkwzbupyvrrthuowchc.supabase.co';
  const key = (window as any).process?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wtSso_NL3o6j69XDmfeyvg_Hqs1w2i5';
  return { url, key };
};

const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { headers: { 'x-application-name': 'alpha-ledger' } }
});

export const fetchDailyAnalysis = async (): Promise<DailyAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false })
      .order('ai_score', { ascending: false })
      .limit(3000);

    if (error) throw error;
    
    return (data || []).map(item => ({
      ...item,
      close_price: Number(item.close_price || 0),
      ai_score: Number(item.ai_score || 0),
      score_short: Number(item.score_short || 0),
      score_long: Number(item.score_long || 0),
      roe: item.roe !== null ? Number(item.roe) : null,
      pe_ratio: item.pe_ratio !== null ? Number(item.pe_ratio) : null,
      vol_ratio: item.vol_ratio !== null ? Number(item.vol_ratio) : 1,
      volatility: item.volatility !== null ? Number(item.volatility) : 0,
      trade_signal: (item.trade_signal || 'AVOID').trim().toUpperCase(),
    })) as DailyAnalysis[];
  } catch (err) {
    console.error('[Supabase] fetchDailyAnalysis Error:', err);
    return [];
  }
};

// 跨日期搜尋（手動新增庫存用，不限今天）
export const searchStockAcrossHistory = async (query: string): Promise<DailyAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('stock_code, stock_name, close_price, trade_signal, ai_score, analysis_date, trade_entry, trade_stop, trade_tp1')
      .or(`stock_name.ilike.%${query}%,stock_code.ilike.%${query}%`)
      .neq('stock_code', 'MARKET_STATE')
      .neq('stock_code', 'MARKET_BRIEF')
      .order('analysis_date', { ascending: false })
      .limit(50);
    if (error) throw error;
    // 每個代碼只留最新一筆
    const seen = new Set<string>();
    const deduped = (data || []).filter(item => {
      if (seen.has(item.stock_code)) return false;
      seen.add(item.stock_code);
      return true;
    });
    return deduped.map(item => ({
      ...item,
      close_price: Number(item.close_price || 0),
      ai_score: Number(item.ai_score || 0),
      trade_signal: (item.trade_signal || 'AVOID').trim().toUpperCase(),
    })) as DailyAnalysis[];
  } catch (err) {
    console.error('[Supabase] searchStockAcrossHistory Error:', err);
    return [];
  }
};

export const fetchStockHistory = async (stockCode: string): Promise<DailyAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('stock_code', stockCode)
      .order('analysis_date', { ascending: true })
      .limit(50);
    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      close_price: Number(item.close_price || 0),
      ai_score: Number(item.ai_score || 0)
    })) as DailyAnalysis[];
  } catch (err) {
    console.error('[Supabase] fetchStockHistory Error:', err);
    return [];
  }
};

export const fetchPortfolio = async (): Promise<PortfolioItem[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    let { data, error } = await supabase
      .from('portfolio')
      .select('*')
      .eq('status', 'holding')
      .eq('user_id', user.id);
    if (error) {
      // 向下相容：user_id 欄位還沒建立（SQL 遷移未執行）時退回舊查詢
      const fallback = await supabase
        .from('portfolio')
        .select('*')
        .eq('status', 'holding');
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      buy_price: Number(item.buy_price || 0),
      quantity: Number(item.quantity || 0)
    }));
  } catch (err) {
    console.error('[Supabase] fetchPortfolio Error:', err);
    return [];
  }
};

export const addToPortfolio = async (stock: DailyAnalysis, buyPrice: number, quantity: number): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');
  const row: Record<string, unknown> = {
    stock_code: stock.stock_code,
    stock_name: stock.stock_name,
    buy_price: buyPrice,
    quantity: quantity,
    status: 'holding',
    user_id: user.id
  };
  let { error } = await supabase.from('portfolio').insert([row]);
  if (error) {
    // 向下相容：user_id 欄位還沒建立時退回舊寫法
    delete row.user_id;
    const retry = await supabase.from('portfolio').insert([row]);
    error = retry.error;
  }
  if (error) throw error;
};

export const removeFromPortfolio = async (stockCode: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');
  let { error } = await supabase
    .from('portfolio')
    .delete()
    .eq('stock_code', stockCode)
    .eq('user_id', user.id);
  if (error) {
    const retry = await supabase.from('portfolio').delete().eq('stock_code', stockCode);
    error = retry.error;
  }
  if (error) throw error;
};

export const fetchLatestAiReport = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('ai_reports')
      .select('content, report_date')
      .eq('report_type', 'daily')
      .order('report_date', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return data.content;
  } catch {
    return null;
  }
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};
