export interface DailyAnalysis {
  id: string;
  stock_code: string;
  stock_name: string;
  close_price: number;
  volume?: number;
  turnover_value?: number;

  ai_score: number;
  score_short: number;
  score_long: number;

  roe: number | null;
  revenue_yoy: number | null;
  pe_ratio: number | null;
  sector?: string;

  vol_ratio?: number;
  volatility?: number;
  trust_buying?: number;

  trade_tp1?: number;
  trade_stop?: number;
  trade_signal: string;
  trade_label?: string;
  ai_comment?: string;

  // v3 新欄位
  k_val?: number;
  d_val?: number;
  trend_bull?: boolean;
  macd_cross?: boolean;
  trust_net?: number;
  foreign_net?: number;
  dealer_net?: number;
  market_regime?: string;
  news_sentiment?: string;
  news_score?: number;
  news_summary?: string;

  is_holding_item?: boolean;
  portfolio_id?: string;
  analysis_date: string;

  buy_price?: number;
  quantity?: number;
  profit_loss_ratio?: number;
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

export interface DashboardState {
  data: DailyAnalysis[];
  portfolio: PortfolioItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
