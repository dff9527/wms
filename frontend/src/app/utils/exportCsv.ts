/**
 * 匯出資料為 CSV 檔案
 * @param filename - 檔名（包含 .csv 副檔名）
 * @param headers - 標題列（陣列）
 * @param rows - 資料列（二維陣列）
 */
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  // 產生 CSV 內容，處理逗號和引號的跳脫
  const escapeCsvValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    // 如果包含逗號、引號或換行，需要用引號包起來，並跳脫內部的引號
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // 加上 BOM 讓 Excel 正確顯示中文
  const bom = '\uFEFF';
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  // BOM \u76F4\u63A5\u63A5\u5728\u7B2C\u4E00\u884C\u524D,\u4E0D\u80FD\u7576\u7368\u7ACB\u5143\u7D20 join,\u5426\u5247\u958B\u982D\u591A\u4E00\u500B\u7A7A\u884C
  const csvContent = bom + [headerLine, ...dataLines].join('\n');

  // 使用 Blob 和 URL.createObjectURL 觸發下載
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 清理 URL
  URL.revokeObjectURL(url);
}
