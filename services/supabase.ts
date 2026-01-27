
import { createClient } from '@supabase/supabase-js';
import { DailyAnalysis, PortfolioItem } from '../types';

const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string;
  }
  if (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  return '';
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL') || 'https://zfkwzbupyvrrthuowchc.supabase.co';
const SUPABASE_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_KEY') || 'sb_publishable_wtSso_NL3o6j69XDmfeyvg_Hqs1w2i5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * 核心解析函數：處理多種日期格式
 * 優先序：ISO 格式 > YYYYMMDD 格式 > 其他
 */
const parseBusinessDate = (dateVal: any): string => {
  if (!dateVal) return new Date().toISOString();
  
  const dateStr = String(dateVal).trim();
  
  // 處理 YYYYMMDD 格式 (例如 20250127)
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}T12:00:00`).toISOString();
  }
  
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};

export const fetchDailyAnalysis = async (): Promise<DailyAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('ai_score', { ascending: false });

    if (error) throw error;
    
    return (data as any[] || []).map(item => {
      let meta: any = {};
      try {
        meta = item.tech_meta ? JSON.parse(item.tech_meta) : {};
      } catch (e) {
        console.error("Meta parse error", e);
      }

      return {
        ...item,
        roe: item.roe !== null ? Number(item.roe) : null,
        revenue_growth: Number(item.revenue_yoy ?? item.revenue_growth ?? 0),
        ai_score: Number(item.ai_score ?? 0),
        // 提取風控價格
        trade_stop: meta.trade_stop || null,
        trade_tp1: meta.trade_tp1 || null,
        trade_tp2: meta.trade_tp2 || null,
        atr_proxy: meta.atr_proxy || null,
        // 關鍵：優先使用 Python 腳本插入的 created_at 欄位，這包含精確的完成時間
        updated_at: parseBusinessDate(item.created_at || item.analysis_date || item.updated_at)
      };
    }) as DailyAnalysis[];
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
  const { error } = await supabase.from('portfolio').insert([{ 
    stock_code: formattedCode, stock_name: stockName, buy_price: price, quantity: qty, status: 'holding', user_id: user.id
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
