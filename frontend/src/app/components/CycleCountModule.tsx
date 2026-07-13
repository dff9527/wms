import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getRole } from '../api/auth';
import {
  createCycleCount,
  freezeCycleCount,
  listCountLocations,
  listCycleCounts,
  reviewCycleCount,
  saveCountEntries,
  submitCycleCount,
  type CycleCount,
} from '../api/cycleCounts';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function CycleCountModule() {
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [locations, setLocations] = useState<Array<{ locationId: number; locationCode: string }>>(
    []
  );
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [skus, setSkus] = useState('');
  const [active, setActive] = useState<CycleCount | null>(null);
  const [entries, setEntries] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const canReview = ['admin', 'supervisor'].includes(getRole());

  const reload = async () => {
    const [nextCounts, nextLocations] = await Promise.all([
      listCycleCounts(),
      listCountLocations(),
    ]);
    setCounts(nextCounts);
    setLocations(nextLocations);
    if (active) setActive(nextCounts.find((c) => c.cycleCountId === active.cycleCountId) ?? null);
  };

  useEffect(() => {
    reload().catch(() => toast.error('無法載入盤點資料'));
  }, []);

  const act = async (operation: () => Promise<CycleCount>, success: string) => {
    setBusy(true);
    try {
      const next = await operation();
      setActive(next);
      await reload();
      toast.success(success);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? '盤點操作失敗');
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    act(
      () =>
        createCycleCount(
          selectedLocations,
          skus
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        ),
      '盤點單已建立'
    );

  const save = () => {
    if (!active) return;
    const payload = active.lines.map((line) => ({
      lineId: line.lineId,
      countedQuantity: Number(entries[line.lineId] ?? line.countedQuantity),
    }));
    if (payload.some((entry) => !Number.isInteger(entry.countedQuantity) || entry.countedQuantity < 0)) {
      toast.error('每一列都必須輸入非負整數');
      return;
    }
    act(() => saveCountEntries(active.cycleCountId, payload), '盲盤數量已儲存');
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ClipboardCheck className="size-6" /> 盤點管理
        </h1>
        <p className="mt-1 text-sm text-slate-500">建立、凍結、盲盤與差異審核</p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold">建立盤點單</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {locations.map((location) => (
            <label key={location.locationId} className="flex items-center gap-2 rounded border px-3 py-2">
              <input
                type="checkbox"
                checked={selectedLocations.includes(location.locationId)}
                onChange={(event) =>
                  setSelectedLocations((current) =>
                    event.target.checked
                      ? [...current, location.locationId]
                      : current.filter((id) => id !== location.locationId)
                  )
                }
              />
              {location.locationCode}
            </label>
          ))}
        </div>
        <Input
          className="mt-3 max-w-xl"
          value={skus}
          onChange={(event) => setSkus(event.target.value)}
          placeholder="選填：料號範圍，以逗號分隔"
        />
        <Button className="mt-3" disabled={busy || !selectedLocations.length} onClick={create}>
          建立盤點單
        </Button>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <section className="rounded-lg border bg-white p-3">
          <h2 className="mb-2 font-semibold">盤點單</h2>
          {counts.map((count) => (
            <button
              key={count.cycleCountId}
              className="mb-2 w-full rounded border p-3 text-left hover:bg-slate-50"
              onClick={() => setActive(count)}
            >
              <div className="font-medium">{count.countNumber}</div>
              <div className="text-xs text-slate-500">{count.status} · {count.lines.length} 列</div>
            </button>
          ))}
        </section>

        <section className="overflow-auto rounded-lg border bg-white p-4">
          {!active ? (
            <p className="text-slate-500">請選擇盤點單</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-semibold">{active.countNumber}</h2><p className="text-sm text-slate-500">狀態：{active.status}</p></div>
                <div className="flex gap-2">
                  {active.status === 'DRAFT' && <Button onClick={() => act(() => freezeCycleCount(active.cycleCountId), '儲位已凍結')}>凍結</Button>}
                  {['FROZEN', 'COUNTING'].includes(active.status) && <Button onClick={save}>儲存盲盤</Button>}
                  {['FROZEN', 'COUNTING'].includes(active.status) && <Button variant="outline" onClick={() => act(() => submitCycleCount(active.cycleCountId), '已送交差異審核')}>送審</Button>}
                  {active.status === 'REVIEW' && canReview && <Button onClick={() => act(() => reviewCycleCount(active.cycleCountId, true), '差異已核准並過帳')}>核准</Button>}
                  {active.status === 'REVIEW' && canReview && <Button variant="destructive" onClick={() => act(() => reviewCycleCount(active.cycleCountId, false), '盤點單已退回')}>拒絕</Button>}
                </div>
              </div>
              {busy && <Loader2 className="mb-2 size-4 animate-spin" />}
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="p-2">儲位</th><th className="p-2">料號 / 批號</th><th className="p-2">帳面</th><th className="p-2">實盤</th><th className="p-2">差異</th></tr></thead>
                <tbody>
                  {active.lines.map((line) => (
                    <tr key={line.lineId} className="border-b">
                      <td className="p-2">{line.locationCode}</td>
                      <td className="p-2">{line.internalSku}<div className="text-xs text-slate-500">{line.internalLotNumber}</div></td>
                      <td className="p-2">{line.expectedQuantity ?? '盲盤'}</td>
                      <td className="p-2"><Input className="w-28" type="number" min="0" disabled={!['FROZEN', 'COUNTING'].includes(active.status)} value={entries[line.lineId] ?? line.countedQuantity ?? ''} onChange={(event) => setEntries((current) => ({ ...current, [line.lineId]: event.target.value }))} /></td>
                      <td className="p-2">{line.variance ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
