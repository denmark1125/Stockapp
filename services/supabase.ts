
import { createClient } from '@supabase/supabase-js';
import { DailyAnalysis, PortfolioItem } from '../types';

const SUPABASE_URL = (process.env as any).NEXT_PUBLIC_SUPABASE_URL || 'https://zfkwzbupyvrrthuowchc.supabase.co';
const SUPABASE_KEY = (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wtSso_NL3o6j69XDmfeyvg_Hqs1w2i5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const fetchDailyAnalysis = async (): Promise<DailyAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('ai_score', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(item => ({
      ...item,
      roe: Number(item.roe || 0),
      revenue_yoy: Number(item.revenue_yoy || 0),
      ai_score: Number(item.ai_score || 0),
      // 確保 updated_at 抓取的是最後一次掃描時間
      updated_at: item.created_at || item.updated_at
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
  if (!user) throw new Error("Authentication Required");
  
  const formattedCode = stockCode.toUpperCase().includes('.TW') ? stockCode.toUpperCase() : `${stockCode.toUpperCase()}.TW`;
  
  const { error } = await supabase.from('portfolio').insert([{ 
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
  const { error } = await supabase.from('portfolio').delete().eq('id', id);
  if (error) throw error;
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};
