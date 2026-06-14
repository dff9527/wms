import { useState } from 'react';
// FIX: [fix_2] — Remove unused import 'Package2' to resolve TS6133 error.
import {
  Search,
  MapPin,
  Calendar,
  AlertCircle,
  Loader2,
  Download,
  SlidersHorizontal,
  Scissors,
} from 'lucide-react';
import type { InventoryLotRow, InventoryLotRowStatus } from '../types/wms-inventory';
import { useInventoryLots, useAdjustLotMutation, useSplitLotMutation } from '../api/inventory';
import { exportCsv } from '../utils/exportCsv';

export default function InventoryModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLot, setSelectedLot] = useState<InventoryLotRow | null>(null);

  // 調整 / 拆帶表單狀態
  const [actionForm, setActionForm] = useState<'adjust' | 'split' | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [splitQty, setSplitQty] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const adjustMutation = useAdjustLotMutation();
  const splitMutation = useSplitLotMutation();

  // Fetch real inventory data via React Query
  const { data: lotsData, isPending, isError, error } = useInventoryLots({});

  // FIX: [fix_2] — Remove .lots property access since lotsData is already InventoryLotRow[]
  const inventoryData: InventoryLotRow[] = lotsData ?? [];

  // 搜尋過濾(料號 / 批號 / 條碼 / 供應商批號 / 儲位)
  const term = searchTerm.trim().toLowerCase();
  const filteredData = term
    ? inventoryData.filter((l) =>
        [l.internalSku, l.internalLotNumber, l.internalBarcode, l.vendorLotCode, l.location].some(
          (v) =>
            String(v ?? '')
              .toLowerCase()
              .includes(term)
        )
      )
    : inventoryData;

  const handleExport = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
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
      filteredData.map((l) => [
        l.internalSku,
        l.internalLotNumber,
        l.internalBarcode,
        l.vendorLotCode ?? '',
        l.location ?? '',
        l.qtyOnHand,
        l.qtyReserved,
        l.receiveDate ?? '',
        l.mslLevel ?? '',
        String(l.status ?? ''),
      ])
    );
  };

  const closeDialog = () => {
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
    return typeof detail === 'string' ? detail : '操作失敗,請稍後再試';
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
      closeDialog();
    } catch (err) {
      setActionError(errDetail(err));
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
      closeDialog();
    } catch (err) {
      setActionError(errDetail(err));
    }
  };

  const getStatusBadge = (status: InventoryLotRowStatus) => {
    // backend lot_status is UPPERCASE (AVAILABLE/RESERVED/QC_HOLD/QUARANTINE/EXPIRED/SHIPPED);
    // normalize and fall back for any status not in the map so the row never crashes.
    const statusConfig: Record<string, { label: string; className: string }> = {
      available: { label: '可用', className: 'bg-green-100 text-green-700' },
      reserved: { label: '已預留', className: 'bg-blue-100 text-blue-700' },
      expiring_soon: { label: '即將到期', className: 'bg-yellow-100 text-yellow-700' },
      quarantine: { label: '隔離', className: 'bg-red-100 text-red-700' },
      qc_hold: { label: '待檢', className: 'bg-amber-100 text-amber-700' },
      expired: { label: '已過期', className: 'bg-red-100 text-red-700' },
      shipped: { label: '已出貨', className: 'bg-slate-100 text-slate-600' },
    };
    const config = statusConfig[String(status ?? '').toLowerCase()] ?? {
      label: String(status ?? '—'),
      className: 'bg-slate-100 text-slate-700',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  // Loading state
  if (isPending) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-500">載入庫存資料中...</span>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
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
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋料號、批號、條碼或儲位…"
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredData.length === 0}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="size-4" />
            匯出 CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">庫存明細 (Lot 級別)</h2>
          <p className="text-sm text-slate-500 mt-1">
            總計 {filteredData.length} 個批次{term ? `(已過濾,全部 ${inventoryData.length})` : ''}
          </p>
        </div>

        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <MapPin className="size-12 mb-2" />
            <p className="text-sm">暫無符合條件的庫存批次</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    料號
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    內部批號
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    內部條碼
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    供應商批號
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    儲位
                  </th>
                  <th className="text-right py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    可用量
                  </th>
                  <th className="text-right py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    預留量
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    收貨日期
                  </th>
                  <th className="text-center py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    MSL
                  </th>
                  <th className="text-center py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    狀態
                  </th>
                  <th className="text-center py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((lot) => (
                  <tr
                    key={lot.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedLot(lot)}
                  >
                    <td className="py-3 px-3">
                      <div className="text-sm font-mono font-medium text-slate-900">
                        {lot.internalSku}
                      </div>
                      <div className="text-xs text-slate-500">{lot.description}</div>
                    </td>
                    <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">
                      {lot.internalLotNumber}
                    </td>
                    <td className="py-3 px-3 text-sm font-mono text-slate-800 whitespace-nowrap">
                      {lot.internalBarcode}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm font-mono text-slate-700">{lot.vendorLotCode}</div>
                      <div className="text-xs text-slate-500">{lot.vendor}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 text-sm font-mono text-blue-600">
                        <MapPin className="size-3" />
                        {lot.location}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-right font-medium text-slate-900">
                      {lot.qtyOnHand.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-slate-600">
                      {lot.qtyReserved.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-sm text-slate-700 whitespace-nowrap">
                      {lot.receiveDate}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center justify-center size-6 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                        {lot.mslLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(lot.status)}</td>
                    <td className="py-3 px-3 text-center">
                      <button type="button" className="text-sm text-blue-600 hover:text-blue-800">
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeDialog}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">批次詳情</h3>
              <button
                type="button"
                onClick={closeDialog}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
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

              <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-200">
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

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
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

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-slate-500" />
                  <div>
                    <label className="text-sm text-slate-600">收貨日期</label>
                    <p className="text-base font-medium text-slate-900">
                      {selectedLot.receiveDate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedLot.expiryDate && <AlertCircle className="size-4 text-yellow-500" />}
                  <div>
                    <label className="text-sm text-slate-600">到期日期</label>
                    <p className="text-base font-medium text-slate-900">
                      {selectedLot.expiryDate || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="size-4 text-blue-600" />
                  <label className="text-sm text-slate-600">儲位</label>
                </div>
                <p className="text-xl font-mono font-bold text-blue-600">{selectedLot.location}</p>
              </div>

              {/* 調整 / 拆帶(後端限 supervisor/admin)*/}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionForm(actionForm === 'adjust' ? null : 'adjust');
                      setActionError(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${actionForm === 'adjust' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${actionForm === 'split' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    <Scissors className="size-4" />
                    拆帶
                  </button>
                </div>

                {actionForm === 'adjust' && (
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          調整量(正數加、負數減)
                        </label>
                        <input
                          type="number"
                          value={adjustQty}
                          onChange={(e) => setAdjustQty(e.target.value)}
                          placeholder="-100"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">原因</label>
                        <input
                          type="text"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          placeholder="盤點差異 / 報廢…"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAdjust}
                      disabled={adjustMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {adjustMutation.isPending ? '處理中…' : '確認調整'}
                    </button>
                  </div>
                )}

                {actionForm === 'split' && (
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        拆出數量(須小於可用量 {selectedLot.qtyOnHand.toLocaleString()})
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={splitQty}
                        onChange={(e) => setSplitQty(e.target.value)}
                        placeholder="500"
                        className="w-48 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSplit}
                      disabled={splitMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {splitMutation.isPending ? '處理中…' : '確認拆帶'}
                    </button>
                  </div>
                )}

                {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
