import { Pencil, Plus, Trash2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { SalesOrderItem } from './types';

interface SalesOrdersSectionProps {
  salesOrders: SalesOrderItem[];
  selectedSo: string | null;
  showCancelledOrders: boolean;
  setShowCancelledOrders: (value: boolean) => void;
  isAdmin: boolean;
  onSelectOrder: (soNumber: string) => void;
  onOpenCreate: () => void;
  onEditOrder: (order: SalesOrderItem) => void;
  onCancelOrder: (order: SalesOrderItem) => void;
}

export default function SalesOrdersSection({
  salesOrders,
  selectedSo,
  showCancelledOrders,
  setShowCancelledOrders,
  isAdmin,
  onSelectOrder,
  onOpenCreate,
  onEditOrder,
  onCancelOrder,
}: SalesOrdersSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">銷售訂單</h2>
          <p className="text-sm text-slate-500 mt-1">等待配貨與揀貨的訂單</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showCancelledOrders}
              onChange={(e) => setShowCancelledOrders(e.target.checked)}
              className="rounded border-slate-300"
            />
            顯示已作廢
          </label>
          <button
            type="button"
            onClick={onOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="size-4" />
            新增訂單
          </button>
        </div>
      </div>

      {salesOrders.length === 0 && (
        <p className="text-sm text-slate-400 py-6 text-center">目前沒有訂單</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {salesOrders.map((order) => (
          <div
            key={order.soNumber}
            onClick={() => {
              if (String(order.status).toUpperCase() === 'CANCELLED') return;
              onSelectOrder(order.soNumber);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (String(order.status).toUpperCase() === 'CANCELLED') return;
                onSelectOrder(order.soNumber);
              }
            }}
            className={`border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${selectedSo === order.soNumber ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold text-slate-900">
                  {order.soNumber}
                </span>
                <StatusBadge status={order.status} />
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditOrder(order);
                    }}
                    className="rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    aria-label={`編輯 ${order.soNumber}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  {String(order.status).toUpperCase() !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelOrder(order);
                      }}
                      className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label={`作廢 ${order.soNumber}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">客戶</span>
                <span className="font-medium text-slate-900">{order.customer || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">訂購日期</span>
                <span className="text-slate-700">{order.orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">行項數</span>
                <span className="text-slate-700">{order.totalLines} 項</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">總數量</span>
                <span className="font-semibold text-slate-900">
                  {order.totalQty.toLocaleString()} PCS
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">配貨策略</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                {order.strategy}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
