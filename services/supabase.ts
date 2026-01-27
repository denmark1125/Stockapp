
import { createClient } from '@supabase/supabase-js';
import { DailyAnalysis, PortfolioItem } from '../types';

const getEnv = (key: string): string => {
  if (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && (process as any).env?.[key]) {
    return (process as any).env[key];
  }
  return '';
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://zfkwzbupyvrrthuowchc.supabase.co';
const SUPABASE_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'sb_publishable_wtSso_NL3o6j69XDmfeyvg_Hqs1w2i5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const fetchDailyAnalysis = async (): Promise<DailyAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      // 核心修復：擴張至 2000 筆，確保「資產金庫」中的所有標的都能對應到現價
      .order('ai_score', { ascending: false })
      .limit(2000); 

    if (error) throw error;
    
    const result = (data as any[]) || [];
    
    return result.map(item => ({
      ...item,
      // 確保數值型態正確且處理空值
      roe: item.roe !== null ? Number(item.roe) : null, 
      revenue_growth: Number(item.revenue_yoy ?? item.revenue_growth ?? 0), 
      pe_ratio: item.pe_ratio !== null && item.pe_ratio !== 0 ? Number(item.pe_ratio) : null,
      ai_score: Number(item.ai_score ?? 0),
      turnover_value: Number(item.turnover_value ?? (item.volume * item.close_price * 1000) ?? 0),
      // 修復：優先顯示資料庫內的掃描日期 (analysis_date)，而非寫入時間 (updated_at)
      updated_at: item.analysis_date || item.updated_at || new Date().toISOString()
    })) as DailyAnalysis[];

  } catch (err) {
    console.error('[Supabase] fetchDailyAnalysis Error:', err);
    return [];
  }
};

export const fetchPortfolio = async (): Promise<PortfolioItem[]> => {
  try {
    const { data, error } = await supabase
      .from('portfolio')
      .select('*')
      .eq('status', 'holding')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PortfolioItem[];
  } catch (err) {
    console.error('[Supabase] fetchPortfolio Error:', err);
    return [];
  }
};

export const addToPortfolio = async (stockCode: string, stockName: string, price: number, qty: number): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // 自動處理台股後綴
  const formattedCode = stockCode.toUpperCase().includes('.TW') ? stockCode.toUpperCase() : `${stockCode.toUpperCase()}.TW`;
  
  const { error } = await supabase
    .from('portfolio')
    .insert([{ 
      stock_code: formattedCode, 
      stock_name: stockName,
      buy_price: price, 
      quantity: qty,
      status: 'holding',
      user_id: user.id
    }]);

  if (error) throw error;
};

export const deleteFromPortfolio = async (id: string | number): Promise<void> => {
  const { error } = await supabase
    .from('portfolio')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
