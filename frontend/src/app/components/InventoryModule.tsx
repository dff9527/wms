import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  Download,
  Loader2,
  MapPin,
  MoveRight,
  Pencil,
  Scissors,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryLotRow, InventoryLotRowStatus } from '../types/wms-inventory';
import {
  useAdjustLotMutation,
  useInventoryLots,
  useMoveLotMutation,
  useMslBagMutation,
  useSplitLotMutation,
  useUpdateLotMutation,
  useVoidLotMutation,
} from '../api/inventory';
import type { InventorySortBy } from '../api/inventory';
import { getRole } from '../api/auth';
import { exportCsv } from '../utils/exportCsv';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';

function getStatusBadge(status: InventoryLotRowStatus | string | undefined | null) {
  const rawStatus = String(status ?? '');
  const statusConfig: Record<string, { label: string; className: string }> = {
    available: { label: '可用', className: 'bg-green-100 text-green-700' },
    reserved: { label: '已預留', className: 'bg-blue-100 text-blue-700' },
    expiring_soon: { label: '即將到期', className: 'bg-yellow-100 text-yellow-700' },
    quarantine: { label: '隔離', className: 'bg-red-100 text-red-700' },
    qc_hold: { label: '待檢', className: 'bg-amber-100 text-amber-700' },
    expired: { label: '已過期', className: 'bg-red-100 text-red-700' },
    shipped: { label: '已出貨', className: 'bg-slate-100 text-slate-600' },
    void: { label: '作廢', className: 'bg-slate-200 text-slate-700' },
  };
  const config = statusConfig[rawStatus.toLowerCase()] ?? {
    label: rawStatus || '—',
    className: 'bg-slate-100 text-slate-700',
  };
  return (
    <span
      title={rawStatus || undefined}
      className={`rounded px-2 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export default function InventoryModule() {
  const role = getRole();
  const isAdmin = role === 'admin';
  const canOperateLots = ['admin', 'supervisor'].includes(role);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<InventorySortBy>('receive_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLot, setSelectedLot] = useState<InventoryLotRow | null>(null);
  const [actionForm, setActionForm] = useState<'adjust' | 'split' | 'move' | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [splitQty, setSplitQty] = useState('');
  const [moveLocation, setMoveLocation] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editLot, setEditLot] = useState<InventoryLotRow | null>(null);
  const [editLocationCode, setEditLocationCode] = useState('');
  const [editQualityNotes, setEditQualityNotes] = useState('');
  const [voidLotTarget, setVoidLotTarget] = useState<InventoryLotRow | null>(null);

  const adjustMutation = useAdjustLotMutation();
  const splitMutation = useSplitLotMutation();
  const moveMutation = useMoveLotMutation();
  const mslMutation = useMslBagMutation();
  const updateLotMutation = useUpdateLotMutation();
  const voidLotMutation = useVoidLotMutation();
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const {
    data: lotsData,
    isPending,
    isError,
    error,
  } = useInventoryLots({
    page,
    pageSize,
    sortBy,
    order: sortOrder,
    search: debouncedSearch || undefined,
  });

  const inventoryData: InventoryLotRow[] = lotsData?.items ?? [];
  const total = lotsData?.total ?? 0;
  const totalPages = lotsData?.totalPages ?? 0;

  const handleSort = (column: InventorySortBy) => {
    if (sortBy === column) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleExport = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate()
    ).padStart(2, '0')}`;
    exportCsv(
      `inventory_${ymd}.csv`,
      [
        '料號',
        '內部批號',
        '內部條碼',
        '供應商批號',
        '儲位',
        '可用量',
        '預留量',
        '收貨日期',
        'MSL',
        '狀態',
      ],
      inventoryData.map((lot) => [
        lot.internalSku,
        lot.internalLotNumber,
        lot.internalBarcode,
        lot.vendorLotCode ?? '',
        lot.location ?? '',
        lot.qtyOnHand,
        lot.qtyReserved,
        lot.receiveDate ?? '',
        lot.mslLevel ?? '',
        String(lot.status ?? ''),
      ])
    );
  };

  const closeDetailDialog = () => {
    setSelectedLot(null);
    setActionForm(null);
    setAdjustQty('');
    setAdjustReason('');
    setSplitQty('');
    setMoveLocation('');
    setMoveReason('');
    setActionError(null);
  };

  const errDetail = (err: unknown): string => {
    const detail = (err as any)?.response?.data?.detail;
    const status = (err as any)?.response?.status;
    if (status === 403) return '權限不足:庫存調整/拆帶需要主管或管理員權限';
    return typeof detail === 'string' ? detail : '操作失敗，請稍後再試';
  };

  const handleAdjust = async () => {
    if (!selectedLot) return;
    const qty = parseInt(adjustQty, 10);
    if (!qty) {
      setActionError('調整量必須為非零整數');
      return;
    }
    setActionError(null);
    try {
      await adjustMutation.mutateAsync({
        lotId: selectedLot.id,
        quantityChange: qty,
        reason: adjustReason || undefined,
      });
      toast.success('庫存調整成功');
      closeDetailDialog();
    } catch (err) {
      const message = errDetail(err);
      setActionError(message);
      toast.error(message);
    }
  };

  const handleSplit = async () => {
    if (!selectedLot) return;
    const qty = parseInt(splitQty, 10);
    if (!qty || qty <= 0) {
      setActionError('拆出數量必須為正整數');
      return;
    }
    setActionError(null);
    try {
      await splitMutation.mutateAsync({ parentLotId: selectedLot.id, quantityToSplit: qty });
      toast.success('拆帶成功');
      closeDetailDialog();
    } catch (err) {
      const message = errDetail(err);
      setActionError(message);
      toast.error(message);
    }
  };

  const handleMove = async () => {
    if (!selectedLot || !moveLocation.trim()) {
      setActionError('請輸入目標儲位');
      return;
    }
    try {
      await moveMutation.mutateAsync({
        lotId: selectedLot.id,
        targetLocationCode: moveLocation.trim(),
        reason: moveReason.trim() || undefined,
      });
      toast.success('儲位調撥成功');
      closeDetailDialog();
    } catch (err) {
      const message = errDetail(err);
      setActionError(message);
      toast.error(message);
    }
  };

  const handleMslAction = async (action: 'open-bag' | 'bake') => {
    if (!selectedLot) return;
    try {
      await mslMutation.mutateAsync({ lotId: selectedLot.id, action });
      toast.success(action === 'open-bag' ? '已開始計算 MSL floor life' : '烘烤完成，floor life 已重置');
      closeDetailDialog();
    } catch (err) {
      toast.error(errDetail(err));
    }
  };

  const openEditLotDialog = (lot: InventoryLotRow) => {
    setEditLot(lot);
    setEditLocationCode(lot.location ?? '');
    setEditQualityNotes('');
  };

  const handleUpdateLot = async () => {
    if (!editLot) return;
    try {
      await updateLotMutation.mutateAsync({
        lotId: editLot.id,
        locationCode: editLocationCode.trim() || undefined,
        qualityNotes: editQualityNotes.trim() || undefined,
      });
      toast.success('批次資料已更新');
      setEditLot(null);
      if (selectedLot?.id === editLot.id) {
        setSelectedLot({
          ...selectedLot,
          location: editLocationCode.trim() || selectedLot.location,
        });
      }
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || '更新批次資料失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handleVoidLot = async () => {
    if (!voidLotTarget) return;
    try {
      await voidLotMutation.mutateAsync(voidLotTarget.id);
      toast.success(`批次 ${voidLotTarget.internalLotNumber} 已作廢`);
      setVoidLotTarget(null);
      if (selectedLot?.id === voidLotTarget.id) {
        closeDetailDialog();
      }
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || '作廢批次失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center p-6">
        <Loader2 className="size-8 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-500">載入庫存資料中...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">無法載入庫存資料</p>
            <p className="mt-1 text-amber-800/90">
              {error instanceof Error ? error.message : '發生未知錯誤'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋料號、批號、條碼或儲位…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label="每頁筆數"
          >
            <option value={10}>每頁 10 筆</option>
            <option value={20}>每頁 20 筆</option>
            <option value={50}>每頁 50 筆</option>
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={inventoryData.length === 0}
          >
            <Download className="size-4" />
            匯出 CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">庫存明細 (Lot 級別)</h2>
          <p className="mt-1 text-sm text-slate-500">
            共 {total} 個批次{debouncedSearch ? `（搜尋「${debouncedSearch}」）` : ''}
          </p>
        </div>

        {inventoryData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <MapPin className="mb-2 size-12" />
            <p className="text-sm">暫無符合條件的庫存批次</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('internal_sku')}
                      className="flex items-center gap-1"
                    >
                      料號 <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('internal_lot_number')}
                      className="flex items-center gap-1"
                    >
                      內部批號 <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">
                    內部條碼
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">
                    供應商批號
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('location_code')}
                      className="flex items-center gap-1"
                    >
                      儲位 <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right text-sm font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('quantity_on_hand')}
                      className="ml-auto flex items-center gap-1"
                    >
                      可用量 <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right text-sm font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('quantity_reserved')}
                      className="ml-auto flex items-center gap-1"
                    >
                      預留量 <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('receive_date')}
                      className="flex items-center gap-1"
                    >
                      收貨日期 <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-slate-600">MSL</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-slate-600">狀態</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {inventoryData.map((lot) => (
                  <tr
                    key={lot.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => setSelectedLot(lot)}
                  >
                    <td className="px-3 py-3">
                      <div className="text-sm font-mono font-medium text-slate-900">
                        {lot.internalSku}
                      </div>
                      <div className="text-xs text-slate-500">{lot.description}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm font-mono text-slate-900">
                      {lot.internalLotNumber}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm font-mono text-slate-800">
                      {lot.internalBarcode}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-mono text-slate-700">{lot.vendorLotCode}</div>
                      <div className="text-xs text-slate-500">{lot.vendor}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 text-sm font-mono text-blue-600">
                        <MapPin className="size-3" />
                        {lot.location || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-medium text-slate-900">
                      {lot.qtyOnHand.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-slate-600">
                      {lot.qtyReserved.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700">
                      {lot.receiveDate}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex size-6 items-center justify-center rounded bg-slate-100 text-xs font-medium text-slate-700">
                        {lot.mslLevel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">{getStatusBadge(lot.status)}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        詳情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page <= 1}
                    className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(1, current - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter((pageNumber) => Math.abs(pageNumber - page) <= 2)
                  .map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(event) => {
                          event.preventDefault();
                          setPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.min(totalPages, current + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {selectedLot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeDetailDialog}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">批次詳情</h3>
              <button
                type="button"
                onClick={closeDetailDialog}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600">料號</label>
                  <p className="text-lg font-mono font-semibold text-slate-900">
                    {selectedLot.internalSku}
                  </p>
                  <p className="text-sm text-slate-500">{selectedLot.description}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">供應商</label>
                  <p className="text-lg font-semibold text-slate-900">{selectedLot.vendor}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4">
                <div>
                  <label className="text-sm text-slate-600">內部批號</label>
                  <p className="text-base font-mono font-medium text-slate-900">
                    {selectedLot.internalLotNumber}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">內部條碼</label>
                  <p className="text-base font-mono font-medium text-slate-900">
                    {selectedLot.internalBarcode}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">供應商批號</label>
                  <p className="text-base font-mono font-medium text-slate-900">
                    {selectedLot.vendorLotCode}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="text-sm text-slate-600">可用量</label>
                  <p className="text-xl font-bold text-green-600">
                    {selectedLot.qtyOnHand.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">預留量</label>
                  <p className="text-xl font-bold text-blue-600">
                    {selectedLot.qtyReserved.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">MSL 等級</label>
                  <p className="text-xl font-bold text-slate-900">Level {selectedLot.mslLevel}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-slate-500" />
                  <div>
                    <label className="text-sm text-slate-600">收貨日期</label>
                    <p className="text-base font-medium text-slate-900">
                      {selectedLot.receiveDate}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-600">到期日期</label>
                  <p className="text-base font-medium text-slate-900">
                    {selectedLot.expiryDate || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <MapPin className="size-4 text-blue-600" />
                  <label className="text-sm text-slate-600">儲位</label>
                </div>
                <p className="text-xl font-mono font-bold text-blue-600">
                  {selectedLot.location || '—'}
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="mb-2 block text-sm text-slate-600">狀態</label>
                {getStatusBadge(selectedLot.status)}
              </div>

              {selectedLot.mslLevel > 1 && ['admin', 'supervisor', 'qc'].includes(role) && (
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-2 text-sm text-slate-600">
                    MSL 包裝：{selectedLot.bagOpenedAt ? `已拆封 ${selectedLot.bagOpenedAt}` : '密封'}
                  </p>
                  <div className="flex gap-2">
                    {!selectedLot.bagOpenedAt && <Button type="button" variant="outline" disabled={mslMutation.isPending} onClick={() => handleMslAction('open-bag')}>拆封</Button>}
                    {selectedLot.bagOpenedAt && <Button type="button" variant="outline" disabled={mslMutation.isPending} onClick={() => handleMslAction('bake')}>烘烤重置</Button>}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openEditLotDialog(selectedLot)}
                    >
                      <Pencil className="size-4" />
                      編輯批次
                    </Button>
                    {String(selectedLot.status).toUpperCase() !== 'VOID' && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setVoidLotTarget(selectedLot)}
                      >
                        <Trash2 className="size-4" />
                        作廢批次
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {canOperateLots && (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActionForm(actionForm === 'adjust' ? null : 'adjust');
                        setActionError(null);
                      }}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${actionForm === 'adjust' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      <SlidersHorizontal className="size-4" />
                      數量調整
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionForm(actionForm === 'split' ? null : 'split');
                        setActionError(null);
                      }}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${actionForm === 'split' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      <Scissors className="size-4" />
                      拆帶
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionForm(actionForm === 'move' ? null : 'move');
                        setActionError(null);
                      }}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${actionForm === 'move' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      <MoveRight className="size-4" />
                      調撥
                    </button>
                  </div>

                  {actionForm === 'adjust' && (
                    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-slate-600">
                            調整量(正數加、負數減)
                          </label>
                          <Input
                            type="number"
                            value={adjustQty}
                            onChange={(e) => setAdjustQty(e.target.value)}
                            placeholder="-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-600">原因</label>
                          <Input
                            type="text"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            placeholder="盤點差異 / 報廢…"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={handleAdjust}
                        disabled={adjustMutation.isPending}
                      >
                        {adjustMutation.isPending ? '處理中…' : '確認調整'}
                      </Button>
                    </div>
                  )}

                  {actionForm === 'split' && (
                    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">
                          拆出數量(須小於可用量 {selectedLot.qtyOnHand.toLocaleString()})
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={splitQty}
                          onChange={(e) => setSplitQty(e.target.value)}
                          placeholder="500"
                          className="w-48"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleSplit}
                        disabled={splitMutation.isPending}
                      >
                        {splitMutation.isPending ? '處理中…' : '確認拆帶'}
                      </Button>
                    </div>
                  )}

                  {actionForm === 'move' && (
                    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-slate-600">目標儲位</label>
                          <Input value={moveLocation} onChange={(e) => setMoveLocation(e.target.value)} placeholder="A-01-R1" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-600">原因</label>
                          <Input value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="補貨 / 儲位整理" />
                        </div>
                      </div>
                      <Button type="button" onClick={handleMove} disabled={moveMutation.isPending}>
                        {moveMutation.isPending ? '處理中…' : '確認調撥'}
                      </Button>
                    </div>
                  )}

                  {actionError && <p className="text-sm text-red-600">{actionError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!editLot} onOpenChange={(open) => !open && setEditLot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯批次</DialogTitle>
            <DialogDescription>更新批次儲位與品質備註。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-location-code">儲位</Label>
              <Input
                id="edit-location-code"
                type="text"
                value={editLocationCode}
                onChange={(e) => setEditLocationCode(e.target.value)}
                placeholder="例如 A01-01-01"
              />
            </div>
            <div>
              <Label htmlFor="edit-quality-notes">品質備註</Label>
              <textarea
                id="edit-quality-notes"
                rows={3}
                value={editQualityNotes}
                onChange={(e) => setEditQualityNotes(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="可選填"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditLot(null)}>
              取消
            </Button>
            <Button type="button" onClick={handleUpdateLot} disabled={updateLotMutation.isPending}>
              {updateLotMutation.isPending ? (
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

      <Dialog open={!!voidLotTarget} onOpenChange={(open) => !open && setVoidLotTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作廢批次</DialogTitle>
            <DialogDescription>
              確定要作廢「{voidLotTarget?.internalLotNumber}」嗎？作廢後將從預設清單中排除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVoidLotTarget(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleVoidLot}
              disabled={voidLotMutation.isPending}
            >
              {voidLotMutation.isPending ? (
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
    </div>
  );
}
