import { useEffect, useState } from 'react';
import { Loader2, PackagePlus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { getRole } from '../api/auth';
import {
  completeReplenishmentTask,
  generateReplenishmentTasks,
  listItemsForDropdown,
  listReplenishmentTasks,
  listStorageLocations,
  updateReplenishmentRule,
  type ReplenishmentTask,
} from '../api/replenishment';
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

function statusBadge(status: string) {
  const upper = status.toUpperCase();
  if (upper === 'COMPLETED') {
    return (
      <span className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
        COMPLETED
      </span>
    );
  }
  if (upper === 'OPEN') {
    return (
      <span className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">OPEN</span>
    );
  }
  return (
    <span className="rounded px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700">
      {status}
    </span>
  );
}

export default function ReplenishmentModule() {
  const role = getRole();
  const canGenerate = ['admin', 'supervisor'].includes(role);
  const isAdmin = role === 'admin';
  const canComplete = ['admin', 'supervisor', 'operator'].includes(role);

  const [tasks, setTasks] = useState<ReplenishmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [locations, setLocations] = useState<
    Array<{ locationId: number; locationCode: string }>
  >([]);
  const [items, setItems] = useState<Array<{ internalSku: string; description: string }>>([]);
  const [ruleLocationId, setRuleLocationId] = useState<number | ''>('');
  const [ruleSku, setRuleSku] = useState('');
  const [ruleMin, setRuleMin] = useState('');
  const [ruleMax, setRuleMax] = useState('');
  const [ruleSaving, setRuleSaving] = useState(false);

  const reload = async () => {
    const next = await listReplenishmentTasks();
    setTasks(next);
  };

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => toast.error('無法載入補貨任務'))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const created = await generateReplenishmentTasks();
      await reload();
      toast.success(created.length ? `已產生 ${created.length} 筆補貨任務` : '目前無需補貨');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? '產生補貨任務失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async (taskId: number) => {
    setBusy(true);
    try {
      await completeReplenishmentTask(taskId);
      await reload();
      toast.success('補貨任務已完成');
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? '完成補貨任務失敗';
      const message = typeof detail === 'string' ? detail : '完成補貨任務失敗';
      if (err?.response?.status === 409 || /inventory changed/i.test(message)) {
        toast.error(`${message}。請重新產生補貨任務。`);
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const openRuleDialog = async () => {
    setShowRuleDialog(true);
    try {
      const [nextLocations, nextItems] = await Promise.all([
        listStorageLocations(),
        listItemsForDropdown(),
      ]);
      setLocations(nextLocations);
      setItems(nextItems);
    } catch {
      toast.error('無法載入儲位或料號');
    }
  };

  const handleSaveRule = async () => {
    if (ruleLocationId === '' || !ruleSku.trim()) {
      toast.error('請選擇儲位與料號');
      return;
    }
    const minimumQty = Number(ruleMin);
    const maximumQty = Number(ruleMax);
    if (!Number.isInteger(minimumQty) || minimumQty < 0) {
      toast.error('最低量須為非負整數');
      return;
    }
    if (!Number.isInteger(maximumQty) || maximumQty <= 0) {
      toast.error('最高量須為正整數');
      return;
    }
    if (maximumQty <= minimumQty) {
      toast.error('最高量必須大於最低量');
      return;
    }
    setRuleSaving(true);
    try {
      await updateReplenishmentRule(ruleLocationId, {
        internalSku: ruleSku.trim(),
        minimumQty,
        maximumQty,
      });
      toast.success('儲位補貨規則已更新');
      setShowRuleDialog(false);
      setRuleLocationId('');
      setRuleSku('');
      setRuleMin('');
      setRuleMax('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? '更新規則失敗');
    } finally {
      setRuleSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <PackagePlus className="size-6" /> 補貨管理
          </h1>
          <p className="mt-1 text-sm text-slate-500">依儲位 min/max 規則產生與完成補貨任務</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button type="button" variant="outline" onClick={openRuleDialog}>
              <Settings2 className="size-4" />
              儲位規則設定
            </Button>
          )}
          {canGenerate && (
            <Button type="button" disabled={busy} onClick={handleGenerate}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
              產生補貨任務
            </Button>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900">補貨任務</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="size-5 animate-spin" />
            載入中…
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">尚無補貨任務</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">任務 ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">料號</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">數量</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">來源儲位</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">目的儲位</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">批次</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">狀態</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.taskId} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-sm font-mono">{task.taskId}</td>
                    <td className="px-4 py-3 text-sm font-mono">{task.internalSku}</td>
                    <td className="px-4 py-3 text-right text-sm">{task.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-mono">{task.fromLocationId}</td>
                    <td className="px-4 py-3 text-sm font-mono">{task.toLocationId}</td>
                    <td className="px-4 py-3 text-sm font-mono">{task.lotId}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(task.status)}</td>
                    <td className="px-4 py-3 text-center">
                      {task.status.toUpperCase() === 'OPEN' && canComplete && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleComplete(task.taskId)}
                        >
                          完成
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={showRuleDialog} onOpenChange={(open) => !open && setShowRuleDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>儲位規則設定</DialogTitle>
            <DialogDescription>設定儲位補貨料號與 min/max 水位（最高量必須大於最低量）。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rule-location">儲位</Label>
              <select
                id="rule-location"
                value={ruleLocationId === '' ? '' : String(ruleLocationId)}
                onChange={(e) =>
                  setRuleLocationId(e.target.value ? Number(e.target.value) : '')
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">請選擇儲位</option>
                {locations.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>
                    {loc.locationCode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="rule-sku">料號 (SKU)</Label>
              <select
                id="rule-sku"
                value={ruleSku}
                onChange={(e) => setRuleSku(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">請選擇料號</option>
                {items.map((item) => (
                  <option key={item.internalSku} value={item.internalSku}>
                    {item.internalSku}
                    {item.description ? ` — ${item.description}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rule-min">最低量 (min)</Label>
                <Input
                  id="rule-min"
                  type="number"
                  min={0}
                  value={ruleMin}
                  onChange={(e) => setRuleMin(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rule-max">最高量 (max)</Label>
                <Input
                  id="rule-max"
                  type="number"
                  min={1}
                  value={ruleMax}
                  onChange={(e) => setRuleMax(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowRuleDialog(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleSaveRule} disabled={ruleSaving}>
              {ruleSaving ? '儲存中…' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
