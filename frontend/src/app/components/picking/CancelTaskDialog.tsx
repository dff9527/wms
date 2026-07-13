import { Trash2 } from 'lucide-react';
import type { PickWaveTask } from '../../types/wms-inventory';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface CancelTaskDialogProps {
  cancelTask: PickWaveTask | null;
  setCancelTask: (task: PickWaveTask | null) => void;
  onCancelTask: () => void;
}

export default function CancelTaskDialog({
  cancelTask,
  setCancelTask,
  onCancelTask,
}: CancelTaskDialogProps) {
  return (
    <Dialog open={!!cancelTask} onOpenChange={(open) => !open && setCancelTask(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>取消揀貨任務</DialogTitle>
          <DialogDescription>
            確定要取消任務 #{cancelTask?.taskId} 嗎？此操作僅限管理員。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setCancelTask(null)}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onCancelTask}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="size-4" />
              確認取消
            </span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}