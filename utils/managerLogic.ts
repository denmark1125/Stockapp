
import { DailyAnalysis } from '../types';

export interface ManagerAdvice {
  mode: 'short' | 'long';
  modeLabel: string;
  conviction: number; // 0-100 信心指數
  status: 'ENTRY' | 'HOLD' | 'EXIT' | 'WATCH';
  statusLabel: string;
  action: string;
  entry: { price: string };
  exit: { price: string };
  stop: { price: string };
  riskLevel: 'LOW' | 'MED' | 'HIGH';
}

/**
 * 超級經理人核心邏輯：將數據轉化為獲利指令
 */
export const getManagerAdvice = (stock: DailyAnalysis, strategy: 'short' | 'long'): ManagerAdvice => {
  const score = strategy === 'short' ? (Number(stock.score_short) || 0) : (Number(stock.score_long) || 0);
  const volRatio = Number(stock.vol_ratio) || 0;
  const volatility = Number(stock.volatility) || 0;
  const close = Number(stock.close_price) || 0;

  // 計算信心指數 (Conviction)
  // 當沖看重：量比與波動；波段看重：ROE 與 分數穩定度
  let conviction = score;
  if (strategy === 'short') {
    conviction += (volRatio > 1.8 ? 10 : 0) + (volatility > 3 ? 5 : 0);
  } else {
    conviction += (Number(stock.roe || 0) > 15 ? 10 : 0);
  }
  conviction = Math.min(100, conviction);

  // 決定狀態與指令
  let status: ManagerAdvice['status'] = 'WATCH';
  let statusLabel = '密切觀察';
  let action = '等待量能確認';

  if (score >= 85) {
    status = 'ENTRY';
    statusLabel = strategy === 'short' ? '⚡ 強力進擊' : '💎 絕佳佈局';
    action = strategy === 'short' ? '市價跟進，抓取日內爆發' : '支撐區間分批建倉，長期持有';
  } else if (stock.is_holding_item) {
    status = 'HOLD';
    statusLabel = '🛡️ 穩定持股';
    action = '趨勢未破，守住利潤空間';
    if (close < Number(stock.trade_stop)) {
      status = 'EXIT';
      statusLabel = '⚠️ 破位減碼';
      action = '觸及防守位，保護本金安全';
    }
  }

  return {
    mode: strategy,
    modeLabel: strategy === 'short' ? '當沖/隔日' : '波段/價值',
    conviction,
    status,
    statusLabel,
    action,
    entry: { price: `${(close * 0.99).toFixed(1)}` },
    exit: { price: `${stock.trade_tp1 || (close * 1.1).toFixed(1)}` },
    stop: { price: `${stock.trade_stop || (close * 0.95).toFixed(1)}` },
    riskLevel: volatility > 5 ? 'HIGH' : volatility > 2.5 ? 'MED' : 'LOW'
  };
};
