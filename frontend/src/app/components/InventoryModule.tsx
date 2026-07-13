import { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Download,
  Loader2,
  MapPin,
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
  useSplitLotMutation,
  useUpdateLotMutation,
  useVoidLotMutation,
} from '../api/inventory';
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
  const [selectedLot, setSelectedLot] = useState<InventoryLotRow | null>(null);
  const [actionForm, setActionForm] = useState<'adjust' | 'split' | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [splitQty, setSplitQty] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editLot, setEditLot] = useState<InventoryLotRow | null>(null);
  const [editLocationCode, setEditLocationCode] = useState('');
  const [editQualityNotes, setEditQualityNotes] = useState('');
  const [voidLotTarget, setVoidLotTarget] = useState<InventoryLotRow | null>(null);

  const adjustMutation = useAdjustLotMutation();
  const splitMutation = useSplitLotMutation();
  const updateLotMutation = useUpdateLotMutation();
  const voidLotMutation = useVoidLotMutation();
  const { data: lotsData, isPending, isError, error } = useInventoryLots({});

  const inventoryData: InventoryLotRow[] = lotsData ?? [];
  const term = searchTerm.trim().toLowerCase();
  const filteredData = term
    ? inventoryData.filter((lot) =>
        [lot.internalSku, lot.internalLotNumber, lot.internalBarcode, lot.vendorLotCode, lot.location].some(
          (value) =>
            String(value ?? '')
              .toLowerCase()
              .includes(term)
        )
      )
    : inventoryData;

  const handleExport = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate()
    ).padStart(2, '0')}`;
    exportCsv(
      `inventory_${ymd}.csv`,
      ['料號', '內部批號', '內部條碼', '供應商批號', '儲位', '可用量', '預留量', '收貨日期', 'MSL', '狀態'],
      filteredData.map((lot) => [
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
        setSelectedLot({ ...selectedLot, location: editLocationCode.trim() || selectedLot.location });
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
          <Button type="button" variant="outline" onClick={handleExport} disabled={filteredData.length === 0}>
            <Download className="size-4" />
            匯出 CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">庫存明細 (Lot 級別)</h2>
          <p className="mt-1 text-sm text-slate-500">
            總計 {filteredData.length} 個批次{term ? `(已過濾，全部 ${inventoryData.length})` : ''}
          </p>
        </div>

        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <MapPin className="mb-2 size-12" />
            <p className="text-sm">暫無符合條件的庫存批次</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">料號</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">內部批號</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">內部條碼</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">供應商批號</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">儲位</th>
                  <th className="px-3 py-3 text-right text-sm font-medium text-slate-600">可用量</th>
                  <th className="px-3 py-3 text-right text-sm font-medium text-slate-600">預留量</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-600">收貨日期</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-slate-600">MSL</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-slate-600">狀態</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((lot) => (
                  <tr
                    key={lot.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => setSelectedLot(lot)}
                  >
                    <td className="px-3 py-3">
                      <div className="text-sm font-mono font-medium text-slate-900">{lot.internalSku}</div>
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
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700">{lot.receiveDate}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex size-6 items-center justify-center rounded bg-slate-100 text-xs font-medium text-slate-700">
                        {lot.mslLevel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">{getStatusBadge(lot.status)}</td>
                    <td className="px-3 py-3 text-center">
                      <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        詳情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <button type="button" onClick={closeDetailDialog} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600">料號</label>
                  <p className="text-lg font-mono font-semibold text-slate-900">{selectedLot.internalSku}</p>
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
                  <p className="text-base font-mono font-medium text-slate-900">{selectedLot.internalLotNumber}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">內部條碼</label>
                  <p className="text-base font-mono font-medium text-slate-900">{selectedLot.internalBarcode}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">供應商批號</label>
                  <p className="text-base font-mono font-medium text-slate-900">{selectedLot.vendorLotCode}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="text-sm text-slate-600">可用量</label>
                  <p className="text-xl font-bold text-green-600">{selectedLot.qtyOnHand.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">預留量</label>
                  <p className="text-xl font-bold text-blue-600">{selectedLot.qtyReserved.toLocaleString()}</p>
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
                    <p className="text-base font-medium text-slate-900">{selectedLot.receiveDate}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-600">到期日期</label>
                  <p className="text-base font-medium text-slate-900">{selectedLot.expiryDate || 'N/A'}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <MapPin className="size-4 text-blue-600" />
                  <label className="text-sm text-slate-600">儲位</label>
                </div>
                <p className="text-xl font-mono font-bold text-blue-600">{selectedLot.location || '—'}</p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="mb-2 block text-sm text-slate-600">狀態</label>
                {getStatusBadge(selectedLot.status)}
              </div>

              {isAdmin && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => openEditLotDialog(selectedLot)}>
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
                  </div>

                  {actionForm === 'adjust' && (
                    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-slate-600">調整量(正數加、負數減)</label>
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
                      <Button type="button" onClick={handleAdjust} disabled={adjustMutation.isPending}>
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
                      <Button type="button" onClick={handleSplit} disabled={splitMutation.isPending}>
                        {splitMutation.isPending ? '處理中…' : '確認拆帶'}
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
