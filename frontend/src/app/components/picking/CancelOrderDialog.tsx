import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { SalesOrderItem } from './types';

interface CancelOrderDialogProps {
  cancelOrder: SalesOrderItem | null;
  setCancelOrder: (order: SalesOrderItem | null) => void;
  onCancelOrder: () => void;
}

export default function CancelOrderDialog({
  cancelOrder,
  setCancelOrder,
  onCancelOrder,
}: CancelOrderDialogProps) {
  return (
    <Dialog open={!!cancelOrder} onOpenChange={(open) => !open && setCancelOrder(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>作廢銷售訂單</DialogTitle>
          <DialogDescription>
            確定要作廢「{cancelOrder?.soNumber}」嗎？此操作會將訂單狀態改為已取消。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setCancelOrder(null)}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onCancelOrder}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="size-4" />
              確認作廢
            </span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
