
export interface DailyAnalysis {
  id: string;
  stock_code: string;     
  stock_name: string;     
  close_price: number;    
  volume?: number;
  turnover_value?: number;
  
  // 雙軌評分核心
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

  // Apex Predator Specific Fields
  trade_tp1?: number;     // Target Profit
  trade_stop?: number;    // Stop Loss
  
  trade_signal: string; 
  ai_comment?: string;    

  is_holding_item?: boolean;
  portfolio_id?: string;
  analysis_date: string;

  // Additional fields for Portfolio integration to resolve App.tsx type mismatch
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