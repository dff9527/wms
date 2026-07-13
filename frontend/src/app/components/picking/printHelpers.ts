import type { PickWaveTask } from '../../types/wms-inventory';
import { printHtml } from '../../utils/printWindow';
import type { PackingList } from './types';

export function printPickWaveDocument(
  pickWave: PickWaveTask[],
  selectedSo: string | null,
  totalTasks: number
) {
  if (pickWave.length === 0) return;

  const now = new Date();
  const DateTimeString = now.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const headerHtml = `
      <div class="print-title">揀貨單 Pick Wave</div>
      <div class="print-subtitle">列印日期: ${DateTimeString}</div>
      <div class="info-row"><span class="info-label">訂單編號:</span><span class="info-value">${selectedSo || 'N/A'}</span></div>
      <div class="info-row"><span class="info-label">總任務數:</span><span class="info-value">${totalTasks}</span></div>
      <hr style="border: 1px solid #000; margin: 15px 0;">
    `;

  let tableHtml = `
      <table>
        <thead>
          <tr>
            <th>序號</th>
            <th>儲位</th>
            <th>料號</th>
            <th>內部批號</th>
            <th>內部條碼</th>
            <th>供應商批號</th>
            <th>揀貨量</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
    `;

  pickWave.forEach((task) => {
    const statusText = String(task.status || '—').toLowerCase();
    let statusLabel = task.status || '—';
    if (statusText.includes('pending')) statusLabel = '待配貨';
    else if (statusText.includes('allocated')) statusLabel = '已配貨';
    else if (statusText.includes('picking')) statusLabel = '揀貨中';
    else if (statusText.includes('completed')) statusLabel = '已完成';
    else if (statusText.includes('picked')) statusLabel = '已揀貨';
    else if (statusText.includes('confirmed')) statusLabel = '已確認';
    else if (statusText.includes('cancelled')) statusLabel = '已取消';
    else if (statusText.includes('shipped')) statusLabel = '已出貨';
    else if (statusText.includes('closed')) statusLabel = '已關閉';

    tableHtml += `
        <tr>
          <td>${task.sequence}</td>
          <td>${task.location || '—'}</td>
          <td>${task.internalSku}</td>
          <td>${task.internalLotNumber || '—'}</td>
          <td>${task.internalBarcode || '—'}</td>
          <td>${task.vendorLotCode || '—'}</td>
          <td>${task.pickQty}</td>
          <td>${statusLabel}</td>
        </tr>
      `;
  });

  tableHtml += `</tbody></table>`;

  printHtml(`揀貨單 - ${selectedSo || 'N/A'}`, headerHtml + tableHtml);
}

export function printPackingListDocument(packingList: PackingList) {
  if (!packingList.items.length) return;

  const now = new Date();
  const DateTimeString = now.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const headerHtml = `
      <div class="print-title">裝箱單 Packing List</div>
      <div class="print-subtitle">訂單編號: ${packingList.soNumber} · 列印日期: ${DateTimeString}</div>
      <hr style="border: 1px solid #000; margin: 15px 0;">
    `;

  let contentHtml = '';

  packingList.items.forEach((item) => {
    let itemTableHtml = `
        <h2>料號: ${item.sku}</h2>
        <table>
          <thead>
            <tr>
              <th>內部批號</th>
              <th>數量</th>
              <th>收貨日期</th>
              <th>儲位</th>
            </tr>
          </thead>
          <tbody>
      `;

    item.lots.forEach((lot) => {
      itemTableHtml += `
          <tr>
            <td>${lot.internalLotNumber || '—'}</td>
            <td>${lot.qty}</td>
            <td>${lot.receiveDate || '—'}</td>
            <td>${lot.location || '—'}</td>
          </tr>
        `;
    });

    itemTableHtml += `</tbody></table>`;
    contentHtml += itemTableHtml;
  });

  printHtml(`裝箱單 - ${packingList.soNumber}`, headerHtml + contentHtml);
}
