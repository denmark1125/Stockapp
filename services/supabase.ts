import { createClient } from '@supabase/supabase-js';
import { DailyAnalysis, PortfolioItem } from '../types';

/**
 * 安全地從環境中獲取變數，支援 Vite (import.meta.env) 與標準 process.env
 */
const getEnvVar = (key: string): string => {
  try {
    // 優先從 import.meta.env 讀取 (Vite 模式)
    const viteEnv = (import.meta as any)?.env?.[key];
    if (viteEnv) return viteEnv;

    // 回退到 process.env (標準 Node/CI 模式)
    const procEnv = (process as any)?.env?.[key];
    if (procEnv) return procEnv;
  } catch (e) {
    // 忽略錯誤，回退到空字串
  }
  return '';
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ [Supabase] 檢測到環境變數缺失。請確保 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY 已正確設定。");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export const fetchDailyAnalysis = async (): Promise<DailyAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false }) 
      .order('ai_score', { ascending: false });

    if (error) throw error;
    
    const result = (data as any[]) || [];
    
    return result.map(item => ({
      ...item,
      roe: Number(item.roe ?? 0), 
      revenue_growth: Number(item.revenue_yoy ?? item.revenue_growth ?? 0), 
      pe_ratio: Number(item.pe_ratio ?? 0),
      ai_score: Number(item.ai_score ?? 0),
      previous_ai_score: Number(item.previous_ai_score ?? item.ai_score ?? 0),
      turnover_value: Number(item.turnover_value ?? (item.volume * item.close_price * 1000) ?? 0),
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