import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  Pencil,
  Plus,
  Printer,
  ScanBarcode,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import ReceivingList from './receiving/ReceivingList';
import ReceivingDetail from './receiving/ReceivingDetail';
import {
  useCancelPO,
  useCompleteIQC,
  useCreatePO,
  useOpenPOs,
  usePOs,
  usePrintLabel,
  useProcessReceipt,
  useReceivingList,
  useScanBarcode,
  useUpdatePO,
  useVendors,
  useItems,
} from '../hooks/useReceivingQueries';
import { getRole } from '../api/auth';
import type { POItem } from '../api/receiving';
import type { ReceivingItem } from '../types/receiving';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

function getPOStatusBadge(status: string) {
  const key = String(status ?? '').toUpperCase();
  const statusConfig: Record<string, { label: string; className: string }> = {
    OPEN: { label: '開啟', className: 'bg-slate-100 text-slate-700' },
    PARTIAL: { label: '部分收貨', className: 'bg-amber-100 text-amber-800' },
    RECEIVED: { label: '已收貨', className: 'bg-emerald-100 text-emerald-800' },
    CANCELLED: { label: '已作廢', className: 'bg-red-100 text-red-700' },
    CLOSED: { label: '已結案', className: 'bg-slate-200 text-slate-700' },
  };
  const config = statusConfig[key] ?? {
    label: key || '—',
    className: 'bg-slate-100 text-slate-700',
  };
  return (
    <span
      title={status || undefined}
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-TW');
}

export default function ReceivingModule() {
  const role = getRole();
  const isAdmin = role === 'admin';
  const canCompleteIQC = ['admin', 'qc'].includes(role);

  const [scannedBarcode, setScannedBarcode] = useState('');
  const [parsedData, setParsedData] = useState<{
    vendorPn: string;
    qty: number | null;
    lotCode: string;
    dateCode?: string;
  } | null>(null);
  const [detailItem, setDetailItem] = useState<ReceivingItem | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [receivedLotId, setReceivedLotId] = useState<number | null>(null);
  const [suggestedLocation, setSuggestedLocation] = useState<string | null>(null);
  const [isLabelPrinted, setIsLabelPrinted] = useState(false);
  const [iqcResult, setIqcResult] = useState<'PASS' | 'FAIL'>('PASS');
  const [iqcInspector, setIqcInspector] = useState('');
  const [iqcNotes, setIqcNotes] = useState('');

  const [showNewPODialog, setShowNewPODialog] = useState(false);
  const [showCancelledPOs, setShowCancelledPOs] = useState(false);
  const [editPO, setEditPO] = useState<POItem | null>(null);
  const [editPOVendorId, setEditPOVendorId] = useState<number | ''>('');
  const [editPOExpectedDate, setEditPOExpectedDate] = useState('');
  const [cancelPOItem, setCancelPOItem] = useState<POItem | null>(null);
  const [newPOForm, setNewPOForm] = useState({
    poNumber: '',
    vendorId: 0,
    lines: [{ lineNumber: 1, internalSku: '', vendorPn: '', orderedQty: 1 }],
  });

  const { data, isError, isPending } = useReceivingList();
  const { data: vendorsData } = useVendors();
  const { data: openPOsData } = useOpenPOs();
  const { data: itemsData } = useItems();
  const { data: poData, isPending: isPOPending } = usePOs(showCancelledPOs);

  const scanMutation = useScanBarcode();
  const receiveMutation = useProcessReceipt();
  const iqcMutation = useCompleteIQC();
  const printLabelMutation = usePrintLabel();
  const createPOMutation = useCreatePO();
  const updatePOMutation = useUpdatePO();
  const cancelPOMutation = useCancelPO();

  const rows = useMemo(() => (isPending || !data?.items ? [] : data.items), [data?.items, isPending]);

  const resetNewPOForm = () => {
    setNewPOForm({
      poNumber: '',
      vendorId: vendorsData?.[0]?.vendorId ?? 0,
      lines: [{ lineNumber: 1, internalSku: '', vendorPn: '', orderedQty: 1 }],
    });
  };

  const handleScanBarcode = async () => {
    if (!scannedBarcode.trim()) return;
    setScanError(null);
    try {
      const response = await scanMutation.mutateAsync({
        barcode: scannedBarcode.trim(),
        vendorId: vendorId ?? undefined,
      });
      if (!response.success || !response.parsed) {
        setParsedData(null);
        setScanError('無法解析條碼，請確認格式正確');
        return;
      }
      setParsedData({
        vendorPn: response.parsed.vendorPn,
        qty: response.parsed.qty,
        lotCode: response.parsed.lotCode,
        dateCode: response.parsed.dateCode,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '掃描失敗，請稍後再試';
      setParsedData(null);
      setScanError(message);
      toast.error(message);
    }
  };

  const handleReceive = async () => {
    if (!parsedData) return;
    if (!poNumber.trim()) {
      toast.error('請先輸入採購單號');
      return;
    }
    if (!vendorId) {
      toast.error('請先選擇供應商');
      return;
    }
    try {
      const response = await receiveMutation.mutateAsync({
        poNumber: poNumber.trim(),
        barcode: scannedBarcode.trim(),
        vendorId,
        qty: parsedData.qty ?? 1,
      });
      if (response.success) {
        setReceivedLotId(response.lotId);
        setParsedData(null);
        setScannedBarcode('');
        setScanError(null);
        toast.success(`收貨成功，批次 #${response.lotId}`);
      }
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || '收貨失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handleCompleteIQC = async () => {
    if (!receivedLotId) return;
    if (!iqcInspector.trim()) {
      toast.error('請輸入檢驗員');
      return;
    }
    try {
      const response = await iqcMutation.mutateAsync({
        lotId: receivedLotId,
        result: iqcResult,
        inspector: iqcInspector.trim(),
        notes: iqcNotes.trim() || undefined,
      });
      setSuggestedLocation(iqcResult === 'PASS' ? response.suggestedLocation ?? null : null);
      setReceivedLotId(null);
      setIsLabelPrinted(false);
      setIqcResult('PASS');
      setIqcInspector('');
      setIqcNotes('');
      printLabelMutation.reset();
      toast.success(iqcResult === 'PASS' ? 'IQC 已完成並放行' : 'IQC 已完成並判定不合格');
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'IQC 提交失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handlePrintLabel = async () => {
    if (!receivedLotId) {
      toast.error('請先完成收貨');
      return;
    }
    try {
      const response = await printLabelMutation.mutateAsync(receivedLotId);
      if (response.success) {
        setIsLabelPrinted(true);
        toast.success(response.printed ? '標籤已送出至標籤機' : '標籤已產生');
      }
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || '列印失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handleBrowserPrint = () => {
    if (!receivedLotId) return;
    const labelData = printLabelMutation.data;
    const internalBarcode = parsedData?.vendorPn
      ? `${parsedData.vendorPn}-${parsedData.lotCode}`
      : `BARCODE-${receivedLotId}`;
    const quantity = parsedData?.qty ?? 1;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
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
          pre { background: #f5f5f5; padding: 15px; border: 1px solid #ddd; border-radius: 4px; max-height: 400px; overflow: auto; font-size: 12px; }
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
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const openDetail = (lotId: number) => {
    const found = rows.find((row) => row.lotId === lotId);
    if (found) setDetailItem(found);
  };

  const handleNewPOSubmit = async () => {
    if (!newPOForm.poNumber.trim()) {
      toast.error('請輸入採購單號');
      return;
    }
    if (!newPOForm.vendorId) {
      toast.error('請選擇供應商');
      return;
    }
    const validLines = newPOForm.lines.filter((line) => line.internalSku && line.orderedQty > 0);
    if (validLines.length === 0) {
      toast.error('請至少填寫一筆有效的明細');
      return;
    }
    try {
      await createPOMutation.mutateAsync({
        poNumber: newPOForm.poNumber.trim(),
        vendorId: newPOForm.vendorId,
        lines: validLines.map((line) => ({
          internalSku: line.internalSku,
          vendorPn: line.vendorPn.trim(),
          orderedQty: line.orderedQty,
        })),
      });
      toast.success('採購單建立成功');
      setShowNewPODialog(false);
      resetNewPOForm();
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || '建立採購單失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handleAddLine = () => {
    const maxLine = Math.max(...newPOForm.lines.map((line) => line.lineNumber), 0);
    setNewPOForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { lineNumber: maxLine + 1, internalSku: '', vendorPn: '', orderedQty: 1 },
      ],
    }));
  };

  const handleRemoveLine = (lineNumber: number) => {
    setNewPOForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((line) => line.lineNumber !== lineNumber),
    }));
  };

  const handleLineChange = (
    lineNumber: number,
    field: keyof (typeof newPOForm.lines)[number],
    value: string | number
  ) => {
    setNewPOForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.lineNumber === lineNumber ? { ...line, [field]: value } : line
      ),
    }));
  };

  const openEditPO = (po: POItem) => {
    setEditPO(po);
    setEditPOVendorId(po.vendorId || '');
    setEditPOExpectedDate(po.expectedDeliveryDate ? String(po.expectedDeliveryDate).slice(0, 10) : '');
  };

  const handleUpdatePO = async () => {
    if (!editPO) return;
    if (!editPOVendorId) {
      toast.error('請選擇供應商');
      return;
    }
    try {
      await updatePOMutation.mutateAsync({
        poId: editPO.poId,
        payload: {
          vendorId: Number(editPOVendorId),
          expectedDeliveryDate: editPOExpectedDate || null,
        },
      });
      toast.success('採購單已更新');
      setEditPO(null);
      setEditPOVendorId('');
      setEditPOExpectedDate('');
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || '更新採購單失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handleCancelPO = async () => {
    if (!cancelPOItem) return;
    try {
      await cancelPOMutation.mutateAsync(cancelPOItem.poId);
      toast.success(`採購單 ${cancelPOItem.poNumber} 已作廢`);
      setCancelPOItem(null);
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || '作廢採購單失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  return (
    <div className="space-y-6 p-6">
      {isError && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">收貨清單載入失敗</p>
            <p className="mt-1 text-amber-800/90">無法連線伺服器，請確認後端服務狀態後重新整理。</p>
          </div>
        </div>
      )}

      {suggestedLocation && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">IQC 檢驗通過</p>
            <p className="mt-1 text-emerald-800/90">建議儲位: {suggestedLocation}</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <ScanBarcode className="size-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">條碼掃描與解析</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">掃描供應商條碼</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanBarcode()}
                  placeholder="請掃描或輸入條碼…"
                />
                <Button
                  type="button"
                  onClick={handleScanBarcode}
                  disabled={scanMutation.isPending || !scannedBarcode.trim()}
                >
                  {scanMutation.isPending ? '解析中...' : '解析'}
                </Button>
              </div>
              {scanError && <p className="mt-2 text-sm text-red-600">{scanError}</p>}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="mb-3 text-sm font-medium text-slate-700">手動輸入</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-600">採購單號</label>
                  <Input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="PO-2024-XXXX"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600">供應商</label>
                  <select
                    value={vendorId ?? ''}
                    onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : null)}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選擇供應商…</option>
                    {vendorsData?.map((vendor) => (
                      <option key={vendor.vendorId} value={vendor.vendorId}>
                        {vendor.vendorName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-medium text-slate-700">解析結果（供應商條碼）</p>
            {parsedData ? (
              <div className="space-y-3">
                <div className="flex justify-between border-b border-slate-200 py-2">
                  <span className="text-sm text-slate-600">供應商料號</span>
                  <span className="text-sm font-mono font-medium text-slate-900">
                    {parsedData.vendorPn}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-2">
                  <span className="text-sm text-slate-600">數量</span>
                  <span className="text-sm font-medium text-slate-900">
                    {parsedData.qty ?? '—'} PCS
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-2">
                  <span className="text-sm text-slate-600">批號</span>
                  <span className="text-sm font-mono font-medium text-slate-900">
                    {parsedData.lotCode}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-2">
                  <span className="text-sm text-slate-600">日期碼</span>
                  <span className="text-sm font-medium text-slate-900">
                    {parsedData.dateCode || 'N/A'}
                  </span>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleReceive}
                    disabled={receiveMutation.isPending}
                  >
                    {receiveMutation.isPending ? '處理中...' : '確認收貨'}
                  </Button>
                </div>
              </div>
            ) : receivedLotId ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-emerald-700">已接收批次 #{receivedLotId}</p>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">內部標籤</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePrintLabel}
                        disabled={printLabelMutation.isPending}
                      >
                        {printLabelMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Printer className="size-4" />
                        )}
                        列印標籤
                      </Button>
                      {printLabelMutation.data?.success && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleBrowserPrint}
                        >
                          瀏覽器列印
                        </Button>
                      )}
                    </div>
                  </div>
                  {printLabelMutation.data?.zpl && (
                    <pre className="max-h-40 overflow-auto rounded border border-slate-300 bg-slate-50 p-2 text-xs text-slate-800">
                      {printLabelMutation.data.zpl}
                    </pre>
                  )}
                </div>

                {canCompleteIQC ? (
                  <div className="border-t border-slate-200 pt-4">
                    <label className="mb-1 block text-xs text-slate-600">檢驗結果</label>
                    <select
                      value={iqcResult}
                      onChange={(e) => setIqcResult(e.target.value as 'PASS' | 'FAIL')}
                      className="mb-3 h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PASS">合格</option>
                      <option value="FAIL">不合格</option>
                    </select>

                    <label className="mb-1 block text-xs text-slate-600">檢驗員</label>
                    <Input
                      type="text"
                      value={iqcInspector}
                      onChange={(e) => setIqcInspector(e.target.value)}
                      placeholder="輸入檢驗員姓名"
                      className="mb-3"
                    />

                    <label className="mb-1 block text-xs text-slate-600">備註</label>
                    <textarea
                      value={iqcNotes}
                      onChange={(e) => setIqcNotes(e.target.value)}
                      placeholder="檢驗備註（可選）"
                      rows={2}
                      className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleCompleteIQC}
                      disabled={iqcMutation.isPending || !isLabelPrinted}
                    >
                      {iqcMutation.isPending ? '提交中...' : '完成 IQC'}
                    </Button>
                    {!isLabelPrinted && (
                      <p className="mt-2 text-xs text-amber-600">此供應商要求換標，請先列印內部標籤</p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    IQC 檢驗需要品管或管理員權限
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Package className="mb-2 size-12" />
                <p className="text-sm">等待掃描條碼…</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">收貨清單</h2>
          <Button
            type="button"
            onClick={() => {
              resetNewPOForm();
              setShowNewPODialog(true);
            }}
          >
            <Plus className="size-4" />
            新增採購單
          </Button>
        </div>
        <ReceivingList items={rows} onViewDetails={openDetail} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">採購單清單</h2>
            <p className="mt-1 text-sm text-slate-500">查看並維護收貨相關採購單</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showCancelledPOs}
              onChange={(e) => setShowCancelledPOs(e.target.checked)}
              className="rounded border-slate-300"
            />
            顯示已作廢
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">PO#</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">供應商</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">日期</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">預計到貨</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">狀態</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {poData?.map((po) => (
                <tr key={po.poId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-slate-900">
                    {po.poNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{po.vendorName}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(po.poDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {formatDate(po.expectedDeliveryDate)}
                  </td>
                  <td className="px-4 py-3">{getPOStatusBadge(po.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditPO(po)}
                        >
                          <Pencil className="size-3" />
                          編輯
                        </Button>
                        {String(po.status).toUpperCase() !== 'CANCELLED' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setCancelPOItem(po)}
                          >
                            <Trash2 className="size-3" />
                            作廢
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isPOPending && (!poData || poData.length === 0) && (
          <div className="py-8 text-center text-sm text-slate-500">目前沒有採購單資料</div>
        )}
      </div>

      <Dialog open={showNewPODialog} onOpenChange={setShowNewPODialog}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>建立採購單</DialogTitle>
            <DialogDescription>建立新的採購單與採購明細。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="new-po-number">採購單號</Label>
                <Input
                  id="new-po-number"
                  type="text"
                  value={newPOForm.poNumber}
                  onChange={(e) => setNewPOForm((prev) => ({ ...prev, poNumber: e.target.value }))}
                  list="open-po-list"
                />
                <datalist id="open-po-list">
                  {openPOsData?.map((poNum) => (
                    <option key={poNum} value={poNum} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label htmlFor="new-po-vendor">供應商</Label>
                <select
                  id="new-po-vendor"
                  value={newPOForm.vendorId || ''}
                  onChange={(e) =>
                    setNewPOForm((prev) => ({
                      ...prev,
                      vendorId: e.target.value ? Number(e.target.value) : 0,
                    }))
                  }
                  className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選擇供應商...</option>
                  {vendorsData?.map((vendor) => (
                    <option key={vendor.vendorId} value={vendor.vendorId}>
                      {vendor.vendorName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>明細列</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="size-4" />
                  加入明細
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">料號</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">
                        供應商料號
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">數量</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {newPOForm.lines.map((line) => (
                      <tr key={line.lineNumber}>
                        <td className="px-3 py-2">
                          <select
                            value={line.internalSku}
                            onChange={(e) =>
                              handleLineChange(line.lineNumber, 'internalSku', e.target.value)
                            }
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">選擇料號...</option>
                            {itemsData?.map((item) => (
                              <option key={item.internalSku} value={item.internalSku}>
                                {item.internalSku} - {item.description}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="text"
                            value={line.vendorPn}
                            onChange={(e) =>
                              handleLineChange(line.lineNumber, 'vendorPn', e.target.value)
                            }
                            placeholder="供應商料號"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={line.orderedQty}
                            onChange={(e) =>
                              handleLineChange(
                                line.lineNumber,
                                'orderedQty',
                                Number(e.target.value)
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {newPOForm.lines.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleRemoveLine(line.lineNumber)}
                            >
                              刪除
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowNewPODialog(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleNewPOSubmit} disabled={createPOMutation.isPending}>
              {createPOMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  建立中...
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  送出
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPO} onOpenChange={(open) => !open && setEditPO(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯採購單</DialogTitle>
            <DialogDescription>更新採購單的供應商與預計到貨日。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-po-vendor">供應商</Label>
              <select
                id="edit-po-vendor"
                value={editPOVendorId}
                onChange={(e) => setEditPOVendorId(e.target.value ? Number(e.target.value) : '')}
                className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">選擇供應商...</option>
                {vendorsData?.map((vendor) => (
                  <option key={vendor.vendorId} value={vendor.vendorId}>
                    {vendor.vendorName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-po-date">預計到貨日</Label>
              <Input
                id="edit-po-date"
                type="date"
                value={editPOExpectedDate}
                onChange={(e) => setEditPOExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditPO(null)}>
              取消
            </Button>
            <Button type="button" onClick={handleUpdatePO} disabled={updatePOMutation.isPending}>
              {updatePOMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  儲存中...
                </>
              ) : (
                '儲存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelPOItem} onOpenChange={(open) => !open && setCancelPOItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作廢採購單</DialogTitle>
            <DialogDescription>
              確定要作廢「{cancelPOItem?.poNumber}」嗎？此操作會將狀態改為已作廢。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelPOItem(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelPO}
              disabled={cancelPOMutation.isPending}
            >
              {cancelPOMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  確認作廢
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="relative max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-slate-100 p-4 shadow-xl md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="absolute right-4 top-4 z-10 text-lg font-semibold text-slate-500 hover:text-slate-700"
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
