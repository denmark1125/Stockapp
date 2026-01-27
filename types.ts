
export interface DailyAnalysis {
  id: string;
  stock_code: string;
  stock_name: string;
  close_price: number;
  volume: number;
  turnover_value?: number;
  technical_signal?: string;
  
  // 核心數據
  ai_score: number;
  roe: number;
  revenue_growth: number; 
  pe_ratio: number;
  sector?: string;        
  
  // 系統欄位
  created_at?: string;
  updated_at: string;
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

export interface TradeSignal {
  signal: string;
  color: 'emerald' | 'rose' | 'amber' | 'slate';
  reason: string;
  isAlert: boolean;
  trend: 'up' | 'down' | 'stable';
  tags: string[]; 
}

export interface DashboardState {
  data: DailyAnalysis[];
  portfolio: PortfolioItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  topPickCode: string | null;
}
