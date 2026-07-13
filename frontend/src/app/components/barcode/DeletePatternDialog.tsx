import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import type { BarcodePattern } from '../../api/barcodes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

interface DeletePatternDialogProps {
  deleteTarget: BarcodePattern | null;
  deleteError: string | null;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export default function DeletePatternDialog({
  deleteTarget,
  deleteError,
  isDeleting,
  onClose,
  onDelete,
}: DeletePatternDialogProps) {
  return (
    <Dialog
      open={!!deleteTarget}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除條碼規則</DialogTitle>
          <DialogDescription>
            確定要停用「{deleteTarget?.pattern_name}」嗎？此操作會將規則設為停用狀態，可在「顯示已停用」中重新啟用。
          </DialogDescription>
        </DialogHeader>

        {deleteError && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{deleteError}</span>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                處理中...
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                確認停用
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
