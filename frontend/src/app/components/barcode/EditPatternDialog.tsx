import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface EditPatternDialogProps {
  editTarget: BarcodePattern | null;
  editPatternName: string;
  setEditPatternName: (value: string) => void;
  editRegex: string;
  setEditRegex: (value: string) => void;
  editFieldMapping: string;
  setEditFieldMapping: (value: string) => void;
  editPriority: number;
  setEditPriority: (value: number) => void;
  editError: string | null;
  isEditing: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditPatternDialog({
  editTarget,
  editPatternName,
  setEditPatternName,
  editRegex,
  setEditRegex,
  editFieldMapping,
  setEditFieldMapping,
  editPriority,
  setEditPriority,
  editError,
  isEditing,
  onClose,
  onUpdate,
}: EditPatternDialogProps) {
  return (
    <Dialog
      open={!!editTarget}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯條碼規則</DialogTitle>
          <DialogDescription>
            修改「{editTarget?.pattern_name}」的規則設定。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-pattern-name">規則名稱</Label>
            <Input
              id="edit-pattern-name"
              type="text"
              value={editPatternName}
              onChange={(e) => setEditPatternName(e.target.value)}
              placeholder="輸入規則名稱"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-regex">正則表達式</Label>
            <Input
              id="edit-regex"
              type="text"
              value={editRegex}
              onChange={(e) => setEditRegex(e.target.value)}
              placeholder="^([A-Z]{2})(\\d{4})$"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-field-mapping">欄位對應 (JSON)</Label>
            <textarea
              id="edit-field-mapping"
              rows={4}
              value={editFieldMapping}
              onChange={(e) => setEditFieldMapping(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder='{"pn": "vendor_pn", "q": "qty"}'
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-priority">優先級</Label>
            <Input
              id="edit-priority"
              type="number"
              min="1"
              max="100"
              value={editPriority}
              onChange={(e) => setEditPriority(Number(e.target.value))}
              className="w-32"
            />
          </div>

          {editError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            onClick={onUpdate}
            disabled={isEditing}
          >
            {isEditing ? (
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
  );
}
