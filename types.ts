
export interface DailyAnalysis {
  id: string;
  stock_code: string;
  stock_name: string;
  close_price: number;
  volume: number;
  turnover_value?: number; // 成交金額
  technical_signal?: string;
  ai_suggestion?: string;
  created_at: string;
  updated_at: string;
  roe?: number;
  revenue_yoy?: number; // 資料庫原始欄位
  revenue_growth?: number; // 前端映射欄位
  pe_ratio?: number;
  sector?: string;
  ai_summary?: string;
  ai_score?: number;
  previous_ai_score?: number; // 歷史分數對比
}

export interface PortfolioItem {
  id: string;
  stock_code: string;
  stock_name: string;
  buy_price: number;
  quantity: number;
  status: 'holding';
  created_at?: string;
}

export interface DashboardState {
  data: DailyAnalysis[];
  portfolio: PortfolioItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  topPickCode: string | null;
}
