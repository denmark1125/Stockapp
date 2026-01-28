
export interface DailyAnalysis {
  id: string;
  stock_code: string;     // 1216.TW
  stock_name: string;     // 統一
  close_price: number;    // 收盤價
  volume?: number;
  turnover_value?: number;
  
  // 核心數據 (與後端對齊)
  ai_score: number;       // AI 總評分
  roe: number | null;     // 股東權益報酬率
  revenue_yoy: number | null; // 營收年增率
  pe_ratio: number | null;    // 本益比
  sector?: string;            // 產業/分類 (如: 🔥 嚴選, 💼 庫存)
  
  // 股神系統風控欄位
  trade_stop?: number;    // 停損價 (DB: trade_stop)
  trade_tp1?: number;     // 目標價 (DB: trade_tp1)
  trade_signal: 'TRADE_BUY' | 'SELL' | 'INVEST_HOLD' | 'TRADE_WATCH' | 'AVOID' | string; // 買賣訊號
  ai_comment?: string;    // AI 一句話短評

  // 庫藏股擴充欄位 (由前端與 portfolio 表關聯生成)
  buy_price?: number;
  quantity?: number;
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

export interface DashboardState {
  data: DailyAnalysis[];
  portfolio: PortfolioItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
