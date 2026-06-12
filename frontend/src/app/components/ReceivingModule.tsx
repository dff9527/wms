import { useMemo, useState } from 'react';
import { ScanBarcode, Package, CheckCircle2, Printer, AlertTriangle, Loader2, Plus } from 'lucide-react';
import ReceivingList from './receiving/ReceivingList';
import ReceivingDetail from './receiving/ReceivingDetail';
import { useReceivingList, useScanBarcode, useProcessReceipt, useCompleteIQC, usePrintLabel, useVendors, useCreatePO, useOpenPOs } from '../hooks/useReceivingQueries';
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
  const [poNumber, setPoNumber] = useState('');
  const [vendorId, setVendorId] = useState<number | null>(1);
  const [receivedLotId, setReceivedLotId] = useState<number | null>(null);
  const [suggestedLocation, setSuggestedLocation] = useState<string | null>(null);
  const [isLabelPrinted, setIsLabelPrinted] = useState(false);

  const { data, isError, isPending } = useReceivingList();
  
      // Mutations for real backend calls
  const scanMutation = useScanBarcode();
  const receiveMutation = useProcessReceipt();
  const iqcMutation = useCompleteIQC();
  const printLabelMutation = usePrintLabel();

  const rows = useMemo(() => {
    if (!isPending && data?.items && data.items.length > 0) return data.items;
    return [];
       }, [data?.items, isPending]);

  // 只在 API 連線失敗時顯示警示;空清單是正常狀態
  const showErrorBanner = isError;

  // New PO dialog state
  const [showNewPODialog, setShowNewPODialog] = useState(false);
  const [newPOForm, setNewPOForm] = useState({
    poNumber: '',
    vendorId: 1,
    lines: [{ lineNumber: 1, internalSku: '', vendorPn: '', orderedQty: 1 }],
  });
  const [newPOError, setNewPOError] = useState<string | null>(null);
  const [newPOSuccess, setNewPOSuccess] = useState(false);

  const createPOMutation = useCreatePO();
  const { data: vendorsData } = useVendors();
  const { data: openPOsData } = useOpenPOs();

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
      setIsLabelPrinted(false);
      printLabelMutation.reset();
    } catch (error) {
      console.error("IQC failed:", error);
    }
  };

  const handlePrintLabel = async () => {
    if (!receivedLotId) return;
    
    try {
      const response = await printLabelMutation.mutateAsync(receivedLotId);
      
      if (response.success) {
        setIsLabelPrinted(true);
      }
    } catch (error) {
      console.error("Print label failed:", error);
    }
  };

  const handleBrowserPrint = () => {
    if (!receivedLotId) return;
    
    // Get the label data from mutation cache or state
    const labelData = printLabelMutation.data;
    
    // Get internal data from parsedData or use a default format
    const internalBarcode = parsedData?.vendorPn ? `${parsedData.vendorPn}-${parsedData.lotCode}` : `BARCODE-${receivedLotId}`;
    const quantity = parsedData?.qty ?? 1;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>內部標籤 - 批次 ${receivedLotId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .info { margin-bottom: 15px; }
            .label { font-weight: bold; color: #666; }
            .value { font-family: 'Courier New', monospace; font-size: 18px; }
            pre { 
              background: #f5f5f5; 
              padding: 15px; 
              border: 1px solid #ddd; 
              border-radius: 4px; 
              max-height: 400px; 
              overflow: auto;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">內部標籤</div>
          <div class="info">
            <div><span class="label">批次號:</span> <span class="value">${receivedLotId}</span></div>
            <div><span class="label">內部條碼:</span> <span class="value">${internalBarcode}</span></div>
            <div><span class="label">數量:</span> <span class="value">${quantity} PCS</span></div>
          </div>
          <div>
            <span class="label">ZPL 原文:</span>
            <pre>${labelData?.zpl || ''}</pre>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const openDetail = (lotId: number) => {
    const found = rows.find((r) => r.lotId === lotId);
    if (found) setDetailItem(found);
       };

  const handleNewPOSubmit = async () => {
    setNewPOError(null);
    
    // Basic validation
    if (!newPOForm.poNumber.trim()) {
      setNewPOError("請輸入採購單號");
      return;
    }
    if (!newPOForm.vendorId) {
      setNewPOError("請選擇供應商");
      return;
    }
    const validLines = newPOForm.lines.filter(l => l.internalSku && l.orderedQty > 0);
    if (validLines.length === 0) {
      setNewPOError("請至少填寫一筆有效的明細");
      return;
    }

    try {
      await createPOMutation.mutateAsync({
        poNumber: newPOForm.poNumber.trim(),
        vendorId: newPOForm.vendorId,
        lines: validLines.map(l => ({
          internalSku: l.internalSku,
          vendorPn: l.vendorPn,
          orderedQty: l.orderedQty,
        })),
      });
      setNewPOSuccess(true);
      // Reset form after successful creation
      setTimeout(() => {
        setShowNewPODialog(false);
        setNewPOForm({
          poNumber: '',
          vendorId: 1,
          lines: [{ lineNumber: 1, internalSku: '', vendorPn: '', orderedQty: 1 }],
        });
        setNewPOSuccess(false);
      }, 1500);
    } catch (error: any) {
      if (error.response?.data?.detail) {
        setNewPOError(error.response.data.detail);
      } else if (error.message) {
        setNewPOError(error.message);
      } else {
        setNewPOError("建立失敗，請稍後再試");
      }
    }
  };

  const handleAddLine = () => {
    const maxLine = Math.max(...newPOForm.lines.map(l => l.lineNumber), 0);
    setNewPOForm({
      ...newPOForm,
      lines: [...newPOForm.lines, { lineNumber: maxLine + 1, internalSku: '', vendorPn: '', orderedQty: 1 }],
    });
  };

  const handleRemoveLine = (lineNumber: number) => {
    setNewPOForm({
      ...newPOForm,
      lines: newPOForm.lines.filter(l => l.lineNumber !== lineNumber),
    });
  };

  const handleLineChange = (lineNumber: number, field: keyof typeof newPOForm.lines[0], value: string | number) => {
    setNewPOForm({
      ...newPOForm,
      lines: newPOForm.lines.map(l => 
        l.lineNumber === lineNumber ? { ...l, [field]: value } : l
      ),
    });
  };

  return (
         <div className="p-6 space-y-6">
           {showErrorBanner && (
             <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
               <AlertTriangle className="size-5 shrink-0 mt-0.5" />
               <div>
                 <p className="font-medium">收貨清單載入失敗</p>
                 <p className="mt-1 text-amber-800/90">無法連線伺服器，請確認後端服務狀態後重新整理。</p>
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
                    onClick={handlePrintLabel}
                    disabled={receiveMutation.isPending}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         {receiveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                    列印標籤
                       </button>
                     </div>
                   </div>
                 ) : receivedLotId ? (
                   <div className="space-y-3">
                     <p className="text-sm text-emerald-700 font-medium">已接收批次 #{receivedLotId}</p>
                     
                     {/* Print Label Result */}
                     {printLabelMutation.data?.success && (
                       <div className="space-y-3">
                         <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                           <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
                           <div>
                             <p className="font-medium">標籤已產生</p>
                             {printLabelMutation.data.printed && (
                               <p className="text-emerald-700/90">已送出至標籤機</p>
                             )}
                           </div>
                         </div>
                         
                         <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-medium text-slate-700">ZPL 內容</span>
                             <button
                               type="button"
                               onClick={handleBrowserPrint}
                               disabled={printLabelMutation.isPending}
                               className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                             >
                               瀏覽器列印
                             </button>
                           </div>
                           <pre className="text-xs font-mono max-h-40 overflow-auto bg-slate-100 p-2 rounded border border-slate-300 text-slate-800">
                             {printLabelMutation.data.zpl}
                           </pre>
                         </div>
                       </div>
                     )}

                     {printLabelMutation.error && (
                       <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                         <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                         <div>
                           <p className="font-medium">列印失敗</p>
                           <p className="text-red-700/90">{printLabelMutation.error instanceof Error ? printLabelMutation.error.message : '未知錯誤'}</p>
                         </div>
                       </div>
                     )}

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
                         disabled={iqcMutation.isPending || !isLabelPrinted}
                         className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         {iqcMutation.isPending ? "提交中..." : <>
                           <CheckCircle2 className="size-4" />
                           完成 IQC
                         </>}
                       </button>
                       
                       {!isLabelPrinted && (
                         <p className="text-xs text-amber-600 mt-2">
                           此供應商要求換標，請先列印內部標籤
                         </p>
                       )}
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
               </div>
               <button
                 type="button"
                 onClick={() => {
                   setShowNewPODialog(true);
                   setNewPOError(null);
                   setNewPOSuccess(false);
                 }}
                 className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
               >
                 <Plus className="size-4" />
                 新增採購單
               </button>
             </div>

             <ReceivingList items={rows} onViewDetails={openDetail} />
           </div>

           {/* New PO Dialog */}
           {showNewPODialog && (
             <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
               <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
                 <button
                   type="button"
                   onClick={() => setShowNewPODialog(false)}
                   className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 text-2xl font-semibold z-10"
                   aria-label="關閉"
                 >
                   ✕
                 </button>
                 
                 <div className="p-6">
                   <h2 className="text-xl font-semibold text-slate-900 mb-4">建立採購單</h2>
                   
                   {/* Success Message */}
                   {newPOSuccess && (
                     <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                       <CheckCircle2 className="size-5 shrink-0" />
                       <span className="font-medium">採購單建立成功！</span>
                     </div>
                   )}
                   
                   {/* Error Message */}
                   {newPOError && (
                     <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                       <AlertTriangle className="size-5 mb-1" />
                       <p>{newPOError}</p>
                     </div>
                   )}
                   
                   <div className="space-y-4">
                     {/* PO Number and Vendor */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">採購單號</label>
                         <input
                           type="text"
                           value={newPOForm.poNumber}
                           onChange={(e) => setNewPOForm({...newPOForm, poNumber: e.target.value})}
                           placeholder="輸入採購單號"
                           className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                           list="open-po-list"
                         />
                         <datalist id="open-po-list">
                           {openPOsData?.map((poNum) => (
                             <option key={poNum} value={poNum} />
                           ))}
                         </datalist>
                         <p className="text-xs text-slate-500 mt-1">可手動輸入或從下拉選取 (OPEN/PARTIAL 單號)</p>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">供應商</label>
                         <select
                           value={newPOForm.vendorId}
                           onChange={(e) => setNewPOForm({...newPOForm, vendorId: Number(e.target.value)})}
                           className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                         >
                           <option value="">選擇供應商...</option>
                           {vendorsData?.map(v => (
                             <option key={v.vendorId} value={v.vendorId}>{v.vendorName}</option>
                           ))}
                         </select>
                       </div>
                     </div>

                     {/* PO Lines */}
                     <div>
                       <div className="flex items-center justify-between mb-2">
                         <label className="block text-sm font-medium text-slate-700">明細列</label>
                         <button
                           type="button"
                           onClick={handleAddLine}
                           className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                         >
                           + 加入明細
                         </button>
                       </div>
                       
                       <div className="border border-slate-200 rounded-lg overflow-hidden">
                         <table className="w-full text-sm">
                           <thead className="bg-slate-50 border-b border-slate-200">
                             <tr>
                               <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">料號 (SKU)</th>
                               <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">供應商料號</th>
                               <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">數量</th>
                               <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">操作</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-200">
                             {newPOForm.lines.map((line) => (
                               <tr key={line.lineNumber} className="hover:bg-slate-50">
                                 <td className="px-3 py-2">
                                   <select
                                     value={line.internalSku}
                                     onChange={(e) => handleLineChange(line.lineNumber, 'internalSku', e.target.value)}
                                     className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                   >
                                     <option value="">選擇料號...</option>
                                     {/* Items will be loaded via items hook */}
                                     <option value="SKU-001">SKU-001 - Test Item</option>
                                   </select>
                                 </td>
                                 <td className="px-3 py-2">
                                   <input
                                     type="text"
                                     value={line.vendorPn}
                                     onChange={(e) => handleLineChange(line.lineNumber, 'vendorPn', e.target.value)}
                                     placeholder="供應商料號"
                                     className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                   />
                                 </td>
                                 <td className="px-3 py-2">
                                   <input
                                     type="number"
                                     min="1"
                                     value={line.orderedQty}
                                     onChange={(e) => handleLineChange(line.lineNumber, 'orderedQty', Number(e.target.value))}
                                     className="w-24 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                   />
                                 </td>
                                 <td className="px-3 py-2 text-right">
                                   {newPOForm.lines.length > 1 && (
                                     <button
                                       type="button"
                                       onClick={() => handleRemoveLine(line.lineNumber)}
                                       className="text-red-600 hover:text-red-800 text-xs px-2 py-1"
                                     >
                                       刪除
                                     </button>
                                   )}
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   </div>

                   {/* Action Buttons */}
                   <div className="mt-6 flex justify-end gap-3">
                     <button
                       type="button"
                       onClick={() => setShowNewPODialog(false)}
                       className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                     >
                       取消
                     </button>
                     <button
                       type="button"
                       onClick={handleNewPOSubmit}
                       disabled={createPOMutation.isPending}
                       className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                     >
                       {createPOMutation.isPending ? (
                         <>
                           <Loader2 className="size-4 animate-spin" />
                           建立中...
                         </>
                       ) : (
                         '送出'
                       )}
                     </button>
                   </div>
                 </div>
               </div>
             </div>
           )}

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