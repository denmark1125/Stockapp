
export interface DailyAnalysis {
  id: string;
  stock_code: string;
  stock_name: string;
  close_price: number;
  volume: number;
  technical_signal: string;
  ai_suggestion: string; // "Green" or "Red" keywords included here
  created_at: string;
  roe?: number;
  revenue_growth?: number;
  sector?: string;
  ai_summary?: string;
  ai_score?: number; // 新增分數欄位
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

export interface User {
  username: string;
  name: string;
}

export interface DashboardState {
  data: DailyAnalysis[];
  portfolio: PortfolioItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  topPickCode: string | null;
}
