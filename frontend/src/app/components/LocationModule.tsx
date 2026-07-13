import { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getRole } from '../api/auth';
import {
  createLocation,
  listLocations,
  listWarehouses,
  type LocationRow,
  type WarehouseOption,
} from '../api/locations';
import { Button } from './ui/button';
import { Input } from './ui/input';

const LOCATION_TYPES = ['BIN', 'SHELF', 'RACK', 'AISLE', 'ZONE'];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: '可用', className: 'bg-green-100 text-green-700' },
  LOCKED: { label: '盤點凍結', className: 'bg-amber-100 text-amber-700' },
};

export default function LocationModule() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    warehouseId: '',
    locationCode: '',
    locationType: 'BIN',
    isQuarantine: false,
    capacityKg: '',
    capacityCbm: '',
  });
  const isAdmin = getRole() === 'admin';

  const reload = async () => {
    const [nextLocations, nextWarehouses] = await Promise.all([
      listLocations(),
      listWarehouses(),
    ]);
    setLocations(nextLocations);
    setWarehouses(nextWarehouses);
  };

  useEffect(() => {
    reload().catch(() => toast.error('無法載入儲位資料'));
  }, []);

  const handleCreate = async () => {
    if (!form.warehouseId || !form.locationCode.trim()) {
      toast.error('倉庫與儲位代碼為必填');
      return;
    }
    setBusy(true);
    try {
      await createLocation({
        warehouseId: Number(form.warehouseId),
        locationCode: form.locationCode.trim(),
        locationType: form.locationType,
        isQuarantine: form.isQuarantine,
        capacityKg: form.capacityKg ? Number(form.capacityKg) : null,
        capacityCbm: form.capacityCbm ? Number(form.capacityCbm) : null,
      });
      toast.success('儲位已建立');
      setShowForm(false);
      setForm({
        warehouseId: form.warehouseId,
        locationCode: '',
        locationType: 'BIN',
        isQuarantine: false,
        capacityKg: '',
        capacityCbm: '',
      });
      await reload();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? '建立儲位失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <MapPin className="size-6" /> 儲位管理
          </h1>
          <p className="mt-1 text-sm text-slate-500">檢視與建立倉庫儲位</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="mr-1 size-4" />
            新增儲位
          </Button>
        )}
      </div>

      {isAdmin && showForm && (
        <section className="rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">倉庫</label>
              <select
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">選擇倉庫…</option>
                {warehouses.map((w) => (
                  <option key={w.warehouseId} value={w.warehouseId}>
                    {w.warehouseName} ({w.warehouseCode}){w.isEsdControlled ? ' · ESD' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">儲位代碼</label>
              <Input
                value={form.locationCode}
                onChange={(e) => setForm({ ...form, locationCode: e.target.value })}
                placeholder="如 A-02-R1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">類型</label>
              <select
                value={form.locationType}
                onChange={(e) => setForm({ ...form, locationType: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                重量上限 kg(選填)
              </label>
              <Input
                type="number"
                min="0"
                value={form.capacityKg}
                onChange={(e) => setForm({ ...form, capacityKg: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                體積上限 cbm(選填)
              </label>
              <Input
                type="number"
                min="0"
                value={form.capacityCbm}
                onChange={(e) => setForm({ ...form, capacityCbm: e.target.value })}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isQuarantine}
                onChange={(e) => setForm({ ...form, isQuarantine: e.target.checked })}
                className="rounded border-slate-300"
              />
              隔離區(退貨/待驗品專用)
            </label>
          </div>
          <Button className="mt-4" disabled={busy} onClick={handleCreate}>
            {busy ? '建立中...' : '確認建立'}
          </Button>
        </section>
      )}

      <section className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="p-3 font-medium text-slate-600">儲位代碼</th>
              <th className="p-3 font-medium text-slate-600">倉庫</th>
              <th className="p-3 font-medium text-slate-600">類型</th>
              <th className="p-3 font-medium text-slate-600">隔離區</th>
              <th className="p-3 font-medium text-slate-600">容量 (kg / cbm)</th>
              <th className="p-3 font-medium text-slate-600">狀態</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  尚無儲位資料
                </td>
              </tr>
            )}
            {locations.map((location) => {
              const status = STATUS_LABELS[location.status] ?? {
                label: location.status,
                className: 'bg-slate-100 text-slate-600',
              };
              return (
                <tr key={location.locationId} className="border-t border-slate-100">
                  <td className="p-3 font-mono font-medium text-slate-900">
                    {location.locationCode}
                  </td>
                  <td className="p-3 text-slate-700">
                    {location.warehouseName ?? '—'}
                    {location.warehouseCode ? ` (${location.warehouseCode})` : ''}
                  </td>
                  <td className="p-3 text-slate-700">{location.locationType ?? '—'}</td>
                  <td className="p-3">{location.isQuarantine ? '是' : '—'}</td>
                  <td className="p-3 text-slate-700">
                    {location.capacityKg ?? '—'} / {location.capacityCbm ?? '—'}
                  </td>
                  <td className="p-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
