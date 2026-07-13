import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { Customer, SalesOrderItem } from './types';

interface EditOrderDialogProps {
  editOrder: SalesOrderItem | null;
  setEditOrder: (order: SalesOrderItem | null) => void;
  editOrderCustomerId: number | '';
  setEditOrderCustomerId: (value: number | '') => void;
  editOrderStrategy: 'FIFO' | 'FEFO';
  setEditOrderStrategy: (value: 'FIFO' | 'FEFO') => void;
  customers: Customer[];
  onUpdateOrder: () => void;
}

export default function EditOrderDialog({
  editOrder,
  setEditOrder,
  editOrderCustomerId,
  setEditOrderCustomerId,
  editOrderStrategy,
  setEditOrderStrategy,
  customers,
  onUpdateOrder,
}: EditOrderDialogProps) {
  return (
    <Dialog open={!!editOrder} onOpenChange={(open) => !open && setEditOrder(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯銷售訂單</DialogTitle>
          <DialogDescription>更新客戶與配貨策略。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">客戶</label>
            <select
              value={editOrderCustomerId}
              onChange={(e) => setEditOrderCustomerId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">請選擇客戶</option>
              {customers.map((customer) => (
                <option key={customer.customer_id} value={customer.customer_id}>
                  {customer.customer_name} ({customer.customer_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">配貨策略</label>
            <select
              value={editOrderStrategy}
              onChange={(e) => setEditOrderStrategy(e.target.value as 'FIFO' | 'FEFO')}
              disabled={String(editOrder?.status).toUpperCase() !== 'OPEN'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="FIFO">FIFO (先進先出)</option>
              <option value="FEFO">FEFO (先到期先出)</option>
            </select>
            {String(editOrder?.status).toUpperCase() !== 'OPEN' && (
              <p className="mt-1 text-xs text-slate-500">只有 OPEN 訂單可修改策略。</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setEditOrder(null)}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onUpdateOrder}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            儲存
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
