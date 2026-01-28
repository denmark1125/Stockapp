
import { DailyAnalysis } from '../types';

export interface ManagerAdvice {
  mode: 'short' | 'long';
  modeLabel: string;
  entry: {
    text: string;
    price: string;
  };
  exit: {
    text: string;
    price: string;
  };
  stop: {
    text: string;
    price: string;
  };
  riskWarning: string | null;
  themeColor: 'rose' | 'blue';
}

/**
 * 核心戰略判斷邏輯 - 強化分類精確度
 * 針對「當沖」與「波段」進行排他性判斷
 */
export const getManagerAdvice = (stock: DailyAnalysis, forcedMode?: 'short' | 'long'): ManagerAdvice => {
  const volRatio = Number(stock.vol_ratio) || 0;
  const volatility = Number(stock.volatility) || 0;
  const sScore = Number(stock.score_short) || 0;
  const lScore = Number(stock.score_long) || 0;
  const close = Number(stock.close_price) || 0;

  // 動態戰略權重計算 (Dynamic Strategic Weighting)
  // 針對辛耘這類高週轉、高動能標的，增加當沖權重偏置
  const shortWeight = sScore + (volRatio * 5) + (volatility * 2);
  const longWeight = lScore + (Number(stock.roe || 0) / 2);

  // 如果沒有強制指定，則依據計算後的權重進行分類
  const isShort = forcedMode ? forcedMode === 'short' : shortWeight >= longWeight;
  
  const advice: ManagerAdvice = {
    mode: isShort ? 'short' : 'long',
    modeLabel: isShort ? '⚡ 當沖特快 (Day)' : '🌊 波段價值 (Swing)',
    themeColor: isShort ? 'rose' : 'blue',
    entry: { text: '', price: '' },
    exit: { text: '獲利目標', price: `${stock.trade_tp1 || (close * (isShort ? 1.03 : 1.1)).toFixed(1)}` },
    stop: { text: '防守底線', price: `${stock.trade_stop || (close * (isShort ? 0.97 : 0.93)).toFixed(1)}` },
    riskWarning: volatility > 4.5 ? '⚠️ 極高波動' : (volRatio > 2.5 ? '🔥 量能噴發' : null),
  };

  if (isShort) {
    if (volRatio > 1.8) {
      advice.entry.text = '🔥 動能確認，市價強攻';
      advice.entry.price = `${close}`;
    } else {
      advice.entry.text = '⏳ 尋求平盤附近低接';
      advice.entry.price = `${(close * 0.995).toFixed(1)}`;
    }
  } else {
    advice.entry.text = '💎 支撐區間分批佈局';
    advice.entry.price = `${(close * 0.985).toFixed(1)}`;
  }

  return advice;
};
