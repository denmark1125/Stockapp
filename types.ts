
export interface DailyAnalysis {
  id: string;
  stock_code: string;
  stock_name: string;
  close_price: number;
  volume: number;
  turnover_value?: number;
  technical_signal?: string;
  
  // 核心數據 (與後端對齊)
  ai_score: number;
  roe: number;
  revenue_yoy: number; 
  pe_ratio: number;
  sector?: string;        
  
  // 風控數據
  trade_stop?: number;
  trade_tp1?: number;
  trade_tp2?: number;
  atr_proxy?: number;
  trade_signal: 'TRADE_BUY' | 'TRADE_WATCH' | 'AVOID' | 'INVEST_HOLD' | string;
  ai_comment?: string;

  // 庫藏股擴充欄位 (用於 UI 呈現與績效計算)
  buy_price?: number;
  is_holding_item?: boolean;
  portfolio_id?: string;

  // 系統欄位
  created_at: string;
  updated_at: string;
  analysis_date: string;
}

export interface PortfolioItem {
  id: string;
  stock_code: string;
  stock_name: string;
  buy_price: number;
  quantity: number;
  status: 'holding';
  created_at: string;
}

export interface TradeSignal {
  label: string;
  color: 'emerald' | 'rose' | 'amber' | 'slate';
  reason: string;
  trend: 'up' | 'down' | 'stable';
}

export interface DashboardState {
  data: DailyAnalysis[];
  portfolio: PortfolioItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
