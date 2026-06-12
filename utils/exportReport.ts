import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { DailyAnalysis } from '../types';

const SIGNAL_LABEL: Record<string, string> = {
  STRONG_BUY: '🚀 強力買進',
  SWING_BUY: '🌊 波段買進',
  DAYTRADE_BUY: '⚡ 短線候選',
  WATCH: '👀 觀察',
  HOLD: '💼 持有',
  SELL_STOP: '🔴 停損出場',
  AVOID: '❌ 迴避',
};

interface ExportData {
  eliteList: DailyAnalysis[];
  portfolioList: DailyAnalysis[];
  reportText: string | null;
  marketRegime: string;
  latestDate: string | null;
}

const regimeLabel = (r: string) =>
  r === 'BULL' ? '🟢 多頭' : r === 'BEAR' ? '🔴 空頭' : '🟡 盤整';

// ═══════════════════════════════════════════════
// Excel 匯出（三個工作表：今日精選 / 我的持股 / AI 報告）
// ═══════════════════════════════════════════════
export const exportToExcel = (d: ExportData) => {
  const wb = XLSX.utils.book_new();
  const dateStr = d.latestDate || format(new Date(), 'yyyy-MM-dd');

  // ── Sheet 1: 今日精選 ──
  const eliteRows = d.eliteList.map((s, i) => ({
    '排名': i + 1,
    '代號': s.stock_code.replace('.TW', ''),
    '股票名稱': s.stock_name,
    '收盤價': s.close_price,
    '訊號': SIGNAL_LABEL[s.trade_signal] || s.trade_signal,
    '綜合評分': s.ai_score,
    '當沖分': s.score_short,
    '波段分': s.score_long,
    '建議掛單': s.trade_entry ?? '',
    '停損價': s.trade_stop ?? '',
    '目標價': s.trade_tp1 ?? '',
    '量比': s.vol_ratio ?? '',
    'ROE(%)': s.roe ?? '',
    '營收年增(%)': s.revenue_yoy ?? '',
    '本益比': s.pe_ratio ?? '',
    '投信買賣超': s.trust_net ?? 0,
    '外資買賣超': s.foreign_net ?? 0,
    '新聞情緒': s.news_summary ?? '',
  }));
  const ws1 = XLSX.utils.json_to_sheet(eliteRows.length ? eliteRows : [{ '說明': '今日無精選標的' }]);
  ws1['!cols'] = [{ wch: 5 }, { wch: 8 }, { wch: 12 }, { wch: 9 }, { wch: 12 }, { wch: 9 }, { wch: 8 }, { wch: 8 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 7 }, { wch: 8 }, { wch: 11 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws1, '今日精選');

  // ── Sheet 2: 我的持股 ──
  const totalCost = d.portfolioList.reduce((sum, s) => sum + (s.buy_price || 0) * (s.quantity || 0), 0);
  const totalValue = d.portfolioList.reduce((sum, s) => sum + s.close_price * (s.quantity || 0), 0);
  const pfRows = d.portfolioList.map(s => ({
    '代號': s.stock_code.replace('.TW', ''),
    '股票名稱': s.stock_name,
    '買進價': s.buy_price,
    '現價': s.close_price,
    '股數': s.quantity,
    '成本': Math.round((s.buy_price || 0) * (s.quantity || 0)),
    '市值': Math.round(s.close_price * (s.quantity || 0)),
    '損益(%)': s.profit_loss_ratio != null ? Number(s.profit_loss_ratio.toFixed(2)) : '',
    '損益(元)': Math.round((s.close_price - (s.buy_price || 0)) * (s.quantity || 0)),
    '目前訊號': SIGNAL_LABEL[s.trade_signal] || s.trade_signal,
    '停損價': s.trade_stop ?? '',
  }));
  if (pfRows.length) {
    pfRows.push({
      '代號': '', '股票名稱': '── 合計 ──', '買進價': '' as any, '現價': '' as any,
      '股數': '' as any, '成本': Math.round(totalCost), '市值': Math.round(totalValue),
      '損益(%)': totalCost > 0 ? Number((((totalValue - totalCost) / totalCost) * 100).toFixed(2)) : '',
      '損益(元)': Math.round(totalValue - totalCost), '目前訊號': '', '停損價': '',
    } as any);
  }
  const ws2 = XLSX.utils.json_to_sheet(pfRows.length ? pfRows : [{ '說明': '目前沒有持股' }]);
  ws2['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 9 }, { wch: 9 }, { wch: 8 }, { wch: 11 }, { wch: 11 }, { wch: 9 }, { wch: 11 }, { wch: 12 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, ws2, '我的持股');

  // ── Sheet 3: AI 報告 ──
  const reportLines = (d.reportText || '今日報告尚未產生').split('\n').map(line => ({ 'Alpha Ledger 每日 AI 報告': line }));
  const ws3 = XLSX.utils.json_to_sheet([
    { 'Alpha Ledger 每日 AI 報告': `報告日期：${dateStr} | 大盤狀態：${regimeLabel(d.marketRegime)}` },
    { 'Alpha Ledger 每日 AI 報告': '' },
    ...reportLines,
    { 'Alpha Ledger 每日 AI 報告': '' },
    { 'Alpha Ledger 每日 AI 報告': '⚠️ 本報告僅供參考，不構成投資建議，投資人應自行承擔風險。' },
  ]);
  ws3['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'AI報告');

  XLSX.writeFile(wb, `AlphaLedger_投資日報_${dateStr}.xlsx`);
};

// ═══════════════════════════════════════════════
// PDF 匯出（開新視窗 → 專業排版 → 觸發列印/另存 PDF）
// ═══════════════════════════════════════════════
export const exportToPdf = (d: ExportData) => {
  const dateStr = d.latestDate || format(new Date(), 'yyyy-MM-dd');
  const totalCost = d.portfolioList.reduce((sum, s) => sum + (s.buy_price || 0) * (s.quantity || 0), 0);
  const totalValue = d.portfolioList.reduce((sum, s) => sum + s.close_price * (s.quantity || 0), 0);
  const totalPnl = totalValue - totalCost;

  const eliteRows = d.eliteList.map((s, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td><b>${s.stock_name}</b> <span class="dim">${s.stock_code.replace('.TW', '')}</span></td>
      <td class="r">${s.close_price}</td>
      <td class="c">${SIGNAL_LABEL[s.trade_signal] || s.trade_signal}</td>
      <td class="r"><b>${s.ai_score}</b></td>
      <td class="r">${s.trade_entry ?? '—'}</td>
      <td class="r red">${s.trade_stop ?? '—'}</td>
      <td class="r green">${s.trade_tp1 ?? '—'}</td>
      <td class="small">${(s.news_summary || '').slice(0, 18)}</td>
    </tr>`).join('');

  const pfRows = d.portfolioList.map(s => {
    const pnl = (s.close_price - (s.buy_price || 0)) * (s.quantity || 0);
    const cls = pnl >= 0 ? 'green' : 'red';
    return `
    <tr>
      <td><b>${s.stock_name}</b> <span class="dim">${s.stock_code.replace('.TW', '')}</span></td>
      <td class="r">${s.buy_price}</td>
      <td class="r">${s.close_price}</td>
      <td class="r">${s.quantity}</td>
      <td class="r ${cls}">${s.profit_loss_ratio != null ? s.profit_loss_ratio.toFixed(2) + '%' : '—'}</td>
      <td class="r ${cls}">${Math.round(pnl).toLocaleString()}</td>
      <td class="r red">${s.trade_stop ?? '—'}</td>
    </tr>`;
  }).join('');

  const reportHtml = (d.reportText || '今日報告尚未產生')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>Alpha Ledger 投資日報 ${dateStr}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "PingFang TC", "Microsoft JhengHei", sans-serif; color: #1A1A1A; padding: 36px 44px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1A1A1A; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .brand .accent { color: #C83232; }
  .sub { color: #888; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
  .meta { text-align: right; font-size: 11px; color: #555; line-height: 1.7; }
  h2 { font-size: 14px; margin: 26px 0 10px; padding-left: 10px; border-left: 4px solid #C83232; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1A1A1A; color: #fff; padding: 7px 8px; font-size: 10px; text-align: left; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #FAFAF8; }
  .c { text-align: center; } .r { text-align: right; }
  .red { color: #C83232; font-weight: 600; } .green { color: #0A7B50; font-weight: 600; }
  .dim { color: #999; font-size: 10px; } .small { font-size: 10px; color: #666; }
  .summary { display: flex; gap: 14px; margin: 6px 0 4px; }
  .card { flex: 1; background: #FAFAF8; border: 1px solid #eee; border-radius: 10px; padding: 12px 16px; }
  .card .label { font-size: 9px; color: #999; letter-spacing: 1px; }
  .card .val { font-size: 18px; font-weight: 800; margin-top: 3px; }
  .report-box { background: #FAFAF8; border: 1px solid #eee; border-radius: 12px; padding: 18px 20px; line-height: 2; font-size: 12px; }
  .disclaimer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #ddd; color: #999; font-size: 9px; text-align: center; }
  @media print { body { padding: 12px 8px; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Alpha <span class="accent">Ledger</span></div>
      <div class="sub">Daily Intelligence Report · 智慧投資日報</div>
    </div>
    <div class="meta">
      報告日期：<b>${dateStr}</b><br/>
      大盤狀態：<b>${regimeLabel(d.marketRegime)}</b><br/>
      產出時間：${format(new Date(), 'yyyy-MM-dd HH:mm')}
    </div>
  </div>

  <div class="summary">
    <div class="card"><div class="label">持股總成本</div><div class="val">${Math.round(totalCost).toLocaleString()} 元</div></div>
    <div class="card"><div class="label">持股總市值</div><div class="val">${Math.round(totalValue).toLocaleString()} 元</div></div>
    <div class="card"><div class="label">未實現損益</div><div class="val" style="color:${totalPnl >= 0 ? '#0A7B50' : '#C83232'}">${totalPnl >= 0 ? '+' : ''}${Math.round(totalPnl).toLocaleString()} 元</div></div>
    <div class="card"><div class="label">今日精選檔數</div><div class="val">${d.eliteList.length} 檔</div></div>
  </div>

  <h2>📋 每日 AI 報告</h2>
  <div class="report-box">${reportHtml}</div>

  <h2>🎯 今日精選雷達</h2>
  <table>
    <thead><tr><th class="c">#</th><th>股票</th><th class="r">收盤</th><th class="c">訊號</th><th class="r">評分</th><th class="r">建議掛單</th><th class="r">停損</th><th class="r">目標</th><th>新聞情緒</th></tr></thead>
    <tbody>${eliteRows || '<tr><td colspan="9" class="c">今日無精選標的</td></tr>'}</tbody>
  </table>

  <h2>💼 我的持股</h2>
  <table>
    <thead><tr><th>股票</th><th class="r">買進價</th><th class="r">現價</th><th class="r">股數</th><th class="r">損益%</th><th class="r">損益(元)</th><th class="r">停損價</th></tr></thead>
    <tbody>${pfRows || '<tr><td colspan="7" class="c">目前沒有持股</td></tr>'}</tbody>
  </table>

  <div class="disclaimer">
    本報告由 Alpha Ledger 系統自動產生，僅供參考，不構成任何投資建議。投資一定有風險，買賣前請審慎評估，盈虧自負。<br/>
    Generated by Alpha Ledger · Apex Predator Engine
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};
