
import { createClient } from '@supabase/supabase-js';
import { DailyAnalysis, PortfolioItem } from '../types';

const getSupabaseConfig = () => {
  const url = (window as any).process?.env?.NEXT_PUBLIC_SUPABASE_URL || 'https://zfkwzbupyvrrthuowchc.supabase.co';
  const key = (window as any).process?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return { url, key };
};

const config = getSupabaseConfig();

// 初始化客戶端，並增加重試與網路超時處理
export const supabase = createClient(config.url, config.key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    // Fix: Explicitly define fetch parameters instead of using rest spread to avoid "spread argument must either have a tuple type" error
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init).catch(err => {
      console.error("Network Error in Supabase Client:", err);
      throw new Error("無法連接至資料庫，請檢查網路或 API 金鑰配置。");
    })
  }
});

export const fetchDailyAnalysis = async (): Promise<DailyAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(item => ({
      ...item,
      close_price: Number(item.close_price || 0),
      ai_score: Number(item.ai_score || 0),
      roe: item.roe ? Number(item.roe) : 0,
      revenue_yoy: item.revenue_yoy ? Number(item.revenue_yoy) : 0,
      trade_signal: (item.trade_signal || 'AVOID').trim().toUpperCase(),
    })) as DailyAnalysis[];
  } catch (err) {
    console.error('[Supabase] fetchDailyAnalysis Error:', err);
    throw err;
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
    throw err;
  }
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};
