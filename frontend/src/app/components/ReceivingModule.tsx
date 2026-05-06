import { useMemo, useState } from 'react';
import { ScanBarcode, Package, CheckCircle2, Printer, Upload, AlertTriangle } from 'lucide-react';
import ReceivingList from './receiving/ReceivingList';
import ReceivingDetail from './receiving/ReceivingDetail';
import { useReceivingList } from '../hooks/useReceivingQueries';
import { RECEIVING_FALLBACK_ITEMS } from '../data/receivingFallback';
import type { ReceivingItem } from '../types/receiving';

/**
 * 收貨管理頁（串接 CURSOR_INSTRUCTIONS.md 元件與 GET /api/v1/receiving/list）
 */
export default function ReceivingModule() {
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [parsedData, setParsedData] = useState<{
    vendor: string;
    partNumber: string;
    vendorLotCode: string;
    quantity: string;
    dateCode: string;
    mslLevel: string;
    poNumber: string;
  } | null>(null);
  const [detailItem, setDetailItem] = useState<ReceivingItem | null>(null);

  const { data, isError, isPending } = useReceivingList();

  const rows = useMemo(() => {
    if (!isPending && data?.items && data.items.length > 0) return data.items;
    return RECEIVING_FALLBACK_ITEMS;
  }, [data?.items, isPending]);

  const showDemoBanner = isError || (!isPending && !!data?.items && data.items.length === 0);

  const handleScanBarcode = () => {
    if (!scannedBarcode) return;

    const parsed = {
      vendor: 'Texas Instruments',
      partNumber: 'TI-7805',
      vendorLotCode: 'TI2024W15A',
      quantity: '5000',
      dateCode: '2024W15',
      mslLevel: '3',
      poNumber: 'PO-2024-0501',
    };
    setParsedData(parsed);
  };

  const handleReceive = () => {
    if (parsedData) {
      alert(
        `收貨成功!\n供應商料號(P/N): ${parsedData.partNumber}\n供應商批號: ${parsedData.vendorLotCode}\n數量: ${parsedData.quantity} PCS\n（後端將產生 internal_lot_number / internal_barcode 並寫入 inventory_lots；POST /receiving/receive 尚為 stub）`
      );
      setParsedData(null);
      setScannedBarcode('');
    }
  };

  const openDetail = (lotId: number) => {
    const found = rows.find((r) => r.lotId === lotId);
    if (found) setDetailItem(found);
  };

  return (
    <div className="p-6 space-y-6">
      {showDemoBanner && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">使用演示資料載入清單</p>
            <p className="mt-1 text-amber-800/90">
              {isError ? '無法連線後端 `/api/v1/receiving/list`，已改顯示本地 fallback。' : null}
              {!isError && data?.items && data.items.length === 0 ? '後端回傳空白清單，已改顯示演示列。' : null}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <ScanBarcode className="size-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">條碼掃描與解析</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">掃描供應商條碼</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanBarcode()}
                  placeholder="請掃描或輸入條碼…"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleScanBarcode}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  解析
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                正式環境將呼叫 POST `/api/v1/receiving/scan`（後端為 501 stub）。確認收貨由 POST `/receive` 產生 internal 批號／條碼。
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-3">手動輸入</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">採購單號</label>
                  <input
                    type="text"
                    placeholder="PO-2024-XXXX"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">供應商</label>
                  <select className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500">
                    <option>選擇供應商…</option>
                    <option>Texas Instruments</option>
                    <option>STMicroelectronics</option>
                    <option>ON Semiconductor</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-3">解析結果（供應商條碼）</p>
            {parsedData ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">供應商</span>
                  <span className="text-sm font-medium text-slate-900">{parsedData.vendor}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">供應商料號 (vendor_pn)</span>
                  <span className="text-sm font-mono font-medium text-slate-900">{parsedData.partNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">供應商批號 (vendor_lot_code)</span>
                  <span className="text-sm font-mono font-medium text-slate-900">{parsedData.vendorLotCode}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">數量</span>
                  <span className="text-sm font-medium text-slate-900">{parsedData.quantity} PCS</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">日期碼</span>
                  <span className="text-sm font-medium text-slate-900">{parsedData.dateCode}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm text-slate-600">MSL 等級</span>
                  <span className="text-sm font-medium text-slate-900">Level {parsedData.mslLevel}</span>
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleReceive}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="size-4" />
                    確認收貨
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    <Printer className="size-4" />
                    列印標籤
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Package className="size-12 mb-2" />
                <p className="text-sm">等待掃描條碼…</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">收貨清單</h2>
            <p className="text-xs text-slate-500 mt-1">
              internal_sku → internal_lot_number → internal_barcode · vendor_pn / vendor_lot_code / vendor_date_code（原廠追溯）
            </p>
          </div>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0"
          >
            <Upload className="size-4" />
            匯入採購單
          </button>
        </div>

        <ReceivingList items={rows} onViewDetails={openDetail} />
      </div>

      {detailItem ? (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="relative w-full max-w-6xl bg-slate-100 rounded-xl p-4 md:p-6 shadow-xl max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-700 text-lg font-semibold z-10"
              aria-label="關閉"
            >
              ✕
            </button>
            <ReceivingDetail item={detailItem} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
