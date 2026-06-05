import { useMemo, useState } from 'react';
import { ScanBarcode, Package, CheckCircle2, Printer, Upload, AlertTriangle } from 'lucide-react';
import ReceivingList from './receiving/ReceivingList';
import ReceivingDetail from './receiving/ReceivingDetail';
import { useReceivingList, useScanBarcode, useProcessReceipt, useCompleteIQC } from '../hooks/useReceivingQueries';
import type { ReceivingItem } from '../types/receiving';

/**
 * 收貨管理頁（串接 CURSOR_INSTRUCTIONS.md 元件與 GET /api/v1/receiving/list）
 */
export default function ReceivingModule() {
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [parsedData, setParsedData] = useState<{
    vendorPn: string;
    qty: number | null;
    lotCode: string;
    dateCode?: string;
      } | null>(null);
  const [detailItem, setDetailItem] = useState<ReceivingItem | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // State for receive/iqc flow
  const [poNumber, setPoNumber] = useState('PO-2024-0501');
  const [vendorId, setVendorId] = useState<number | null>(1);
  const [receivedLotId, setReceivedLotId] = useState<number | null>(null);
  const [suggestedLocation, setSuggestedLocation] = useState<string | null>(null);

  const { data, isError, isPending } = useReceivingList();
  
      // Mutations for real backend calls
  const scanMutation = useScanBarcode();
  const receiveMutation = useProcessReceipt();
  const iqcMutation = useCompleteIQC();

  const rows = useMemo(() => {
    if (!isPending && data?.items && data.items.length > 0) return data.items;
    return [];
       }, [data?.items, isPending]);

  const showDemoBanner = isError || (!isPending && !!data?.items && data.items.length === 0);

  const handleScanBarcode = async () => {
    if (!scannedBarcode) return;
    
    setScanError(null);
    try {
      const response = await scanMutation.mutateAsync({ barcode: scannedBarcode, vendorId: vendorId ?? undefined });
      
      if (response.success && response.parsed) {
        setParsedData({
          vendorPn: response.parsed.vendorPn,
          qty: response.parsed.qty,
          lotCode: response.parsed.lotCode,
          dateCode: response.parsed.dateCode,
            });
          } else {
        setScanError("無法解析條碼，請確認格式正確");
          }
        } catch (error) {
      setScanError(error instanceof Error ? error.message : "掃描失敗，請稍後再試");
        }
      };

  const handleReceive = async () => {
    if (!parsedData) return;
    
    try {
      const response = await receiveMutation.mutateAsync({
        poNumber: poNumber,
        barcode: parsedData.lotCode || scannedBarcode,
        vendorId: vendorId ?? 1,
        qty: parsedData.qty ?? 1,
      });

      if (response.success) {
        setReceivedLotId(response.lotId);
        setParsedData(null);
        setScannedBarcode('');
      }
        } catch (error) {
          // Show error feedback instead of alert for PO mismatch etc.
      console.error("Receive failed:", error);
          // Could add toast notification here
        }
      };

  const handleCompleteIQC = async (result: 'PASS' | 'FAIL', inspector: string, notes?: string) => {
    if (!receivedLotId) return;

    try {
      const response = await iqcMutation.mutateAsync({
        lotId: receivedLotId,
        result,
        inspector,
        notes,
      });

      if (response.success && result === 'PASS') {
        setSuggestedLocation(response.suggestedLocation ?? null);
      } else {
        setSuggestedLocation(null);
      }
      
      // Reset flow state after IQC completion
      setReceivedLotId(null);
    } catch (error) {
      console.error("IQC failed:", error);
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

           {/* IQC Suggested Location Feedback */}
           {suggestedLocation && (
             <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
               <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
               <div>
                 <p className="font-medium">IQC 檢驗通過</p>
                 <p className="mt-1 text-emerald-800/90">建議儲位: {suggestedLocation}</p>
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
                  disabled={scanMutation.isPending || !scannedBarcode}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                     >
                      {scanMutation.isPending ? "解析中..." : "解析"}
                     </button>
                   </div>
               
                   {scanError && (
                     <p className="mt-2 text-sm text-red-600">{scanError}</p>
                   )}
               
                   <p className="text-xs text-slate-500 mt-2">
                正式環境將呼叫 POST `/api/v1/receiving/scan`。確認收貨由 POST `/receive` 產生 internal 批號／條碼。
                   </p>
                 </div>

                 <div className="pt-4 border-t border-slate-200">
                   <p className="text-sm font-medium text-slate-700 mb-3">手動輸入</p>
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="block text-xs text-slate-600 mb-1">採購單號</label>
                       <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="PO-2024-XXXX"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                       />
                     </div>
                     <div>
                       <label className="block text-xs text-slate-600 mb-1">供應商</label>
                       <select 
                         value={vendorId ?? ''} 
                         onChange={(e) => setVendorId(Number(e.target.value))}
                         className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                       >
                         <option value="">選擇供應商…</option>
                         <option value="1">Texas Instruments</option>
                         <option value="2">STMicroelectronics</option>
                         <option value="3">ON Semiconductor</option>
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
                       <span className="text-sm text-slate-600">供應商料號 (vendor_pn)</span>
                       <span className="text-sm font-mono font-medium text-slate-900">{parsedData.vendorPn}</span>
                     </div>
                     <div className="flex justify-between py-2 border-b border-slate-200">
                       <span className="text-sm text-slate-600">數量</span>
                       <span className="text-sm font-medium text-slate-900">{parsedData.qty ?? '—'} PCS</span>
                     </div>
                     <div className="flex justify-between py-2 border-b border-slate-200">
                       <span className="text-sm text-slate-600">批號 (lot_code)</span>
                       <span className="text-sm font-mono font-medium text-slate-900">{parsedData.lotCode}</span>
                     </div>
                     <div className="flex justify-between py-2 border-b border-slate-200">
                       <span className="text-sm text-slate-600">日期碼</span>
                       <span className="text-sm font-medium text-slate-900">{parsedData.dateCode || 'N/A'}</span>
                     </div>

                     <div className="pt-4 flex gap-2">
                       <button
                    type="button"
                    onClick={handleReceive}
                    disabled={receiveMutation.isPending}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         {receiveMutation.isPending ? "處理中..." : <>
                           <CheckCircle2 className="size-4" />
                       確認收貨
                         </>}
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
                 ) : receivedLotId ? (
                   <div className="space-y-3">
                     <p className="text-sm text-emerald-700 font-medium">已接收批次 #{receivedLotId}</p>
                     
                     {/* IQC Form */}
                     <div className="pt-4 border-t border-slate-200">
                       <label className="block text-xs text-slate-600 mb-1">檢驗結果</label>
                       <select 
                         id="iqc-result"
                         className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 mb-3"
                       >
                         <option value="PASS">合格 (PASS)</option>
                         <option value="FAIL">不合格 (FAIL)</option>
                       </select>

                       <label className="block text-xs text-slate-600 mb-1">檢驗員</label>
                       <input
                         type="text"
                         id="iqc-inspector"
                         placeholder="輸入檢驗員姓名"
                         className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 mb-3"
                       />

                       <label className="block text-xs text-slate-600 mb-1">備註</label>
                       <textarea
                         id="iqc-notes"
                         placeholder="檢驗備註（可選）"
                         className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 mb-3"
                         rows={2}
                       />

                       <button
                         type="button"
                         onClick={() => {
                           const resultEl = document.getElementById('iqc-result') as HTMLSelectElement;
                           const inspectorEl = document.getElementById('iqc-inspector') as HTMLInputElement;
                           const notesEl = document.getElementById('iqc-notes') as HTMLTextAreaElement;
                           
                           if (!resultEl || !inspectorEl) return;
                           
                           handleCompleteIQC(
                             resultEl.value as 'PASS' | 'FAIL',
                             inspectorEl.value,
                             notesEl?.value || undefined
                           );
                         }}
                         disabled={iqcMutation.isPending}
                         className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         {iqcMutation.isPending ? "提交中..." : <>
                           <CheckCircle2 className="size-4" />
                           完成 IQC
                         </>}
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
