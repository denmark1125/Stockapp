
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
    // 獲取最新 500 筆資料，按日期與分數降序，確保最新一天的完整標的一定會被包含在內
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false })
      .order('ai_score', { ascending: false })
      .limit(500);

    if (error) throw error;
    
    return (data || []).map(item => ({
      ...item,
      close_price: Number(item.close_price || 0),
      ai_score: Number(item.ai_score || 0),
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
      .limit(30);
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
    return data || [];
  } catch (err) {
    console.error('[Supabase] fetchPortfolio Error:', err);
    return [];
  }
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};
