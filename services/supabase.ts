
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
      .limit(1000);

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
    const { data, error } = await supabase
      .from('portfolio')
      .select('*')
      .eq('status', 'holding');
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
  const { error } = await supabase
    .from('portfolio')
    .insert([{
      stock_code: stock.stock_code,
      stock_name: stock.stock_name,
      buy_price: buyPrice,
      quantity: quantity,
      status: 'holding'
    }]);
  if (error) throw error;
};

export const removeFromPortfolio = async (stockCode: string): Promise<void> => {
  const { error } = await supabase
    .from('portfolio')
    .delete()
    .eq('stock_code', stockCode);
  if (error) throw error;
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};
