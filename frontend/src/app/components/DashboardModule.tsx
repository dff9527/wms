import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, TrendingUp, AlertTriangle, CheckCircle2, Loader2, AlertCircle, LucideIcon } from 'lucide-react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useInventoryLots } from '../api/inventory';
import type { InventoryLotRow } from '../types/wms-inventory';

export default function DashboardModule() {
      // --- Data Fetching ---

      // 1. Inventory Lots
  const { data: lotsData, isLoading: isLotsLoading, isError: isLotsError } = useInventoryLots({});
  const lots: InventoryLotRow[] = Array.isArray(lotsData) ? lotsData : [];

      // Compute inventory stats from lots
  let totalQtyOnHand = 0;
// FIX: [fix_1] — Remove unused variables availableCount, qcHoldCount, quarantineCount and their increment logic
  let availableQty = 0;
  const statusQtys: Record<string, number> = {};

  for (const lot of lots) {
    const qty = Number(lot?.qtyOnHand ?? 0);
    totalQtyOnHand += qty;

    const key = String(lot?.status ?? '').toLowerCase();
    if (!key || key === 'undefined' || key === 'null') continue;

    statusQtys[key] = (statusQtys[key] ?? 0) + qty;

    if (key === 'available') {
      availableQty += qty;
      }
      }

      // Build pie chart data from real inventory statuses
  const inventoryByStatus = [
        { name: '可用 (Available)', value: availableQty },
        { name: 'QC待檢 (QC Hold)', value: statusQtys['qc_hold'] ?? 0 },
        { name: '隔離 (Quarantine)', value: statusQtys['quarantine'] ?? 0 },
        { name: '其他', value: Math.max(0, totalQtyOnHand - availableQty - (statusQtys['qc_hold'] ?? 0) - (statusQtys['quarantine'] ?? 0)) },
      ].filter(item => item.value > 0);


      // 2. Pending Pick Tasks
  const { data: pickTasksData, isLoading: isPicksLoading, isError: isPicksError } = useQuery({
    queryKey: ['picking-tasks'],
    queryFn: async () => {
      try {
        const r = await axios.get('/api/v1/picking/tasks');
        return Array.isArray(r.data) ? r.data : [];
          } catch {
        return [];
          }
        },
      });
  const pendingPickCount = Array.isArray(pickTasksData)
        ? pickTasksData.filter((t: any) => String(t?.status ?? '').toLowerCase() === 'pending').length
        : 0;

      // 3. Pending Shipments
  const { data: shipmentData, isLoading: isShipmentsLoading, isError: isShipmentsError } = useQuery({
    queryKey: ['shipping-pending'],
    queryFn: async () => {
      try {
        const r = await axios.get('/api/v1/shipping/pending');
        return Array.isArray(r.data) ? r.data : [];
          } catch {
        return [];
          }
        },
      });
  const pendingShipmentCount = Array.isArray(shipmentData) ? shipmentData.length : 0;

      // --- Derived UI State ---

  const isGlobalLoading = isLotsLoading && isPicksLoading && isShipmentsLoading;
  const hasAnyError = isLotsError || isPicksError || isShipmentsError;

// FIX: [fix_2] — Add explicit type annotation to statsData array to resolve TS2353 union property errors
  const statsData: Array<{ title: string; value: string; unit: string; icon: LucideIcon; color: string; change: string; isEmpty?: boolean; isMock?: boolean }> = [
        {
      title: '總庫存量',
      value: lots.length > 0 ? totalQtyOnHand.toLocaleString() : '—',
      unit: 'PCS',
      icon: Package,
      color: 'bg-blue-500',
      change: '', // No historical endpoint
      isEmpty: lots.length === 0,
        },
        {
      title: '待揀貨',
      value: String(pendingPickCount),
      unit: '任務',
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      change: '', // No historical endpoint
      isEmpty: false,
        },
        {
      title: '待出貨',
      value: String(pendingShipmentCount),
      unit: '批次',
      icon: CheckCircle2,
      color: 'bg-purple-500',
      change: '', // No historical endpoint
      isEmpty: false,
        },
        {
      title: '今日收貨',
      value: '—',
      unit: '批次',
      icon: TrendingUp,
      color: 'bg-green-500',
      change: '',
      isMock: true, // No backing endpoint
        },
      ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  if (isGlobalLoading) {
    return (
          <div className="p-6 flex items-center justify-center h-[calc(100vh-4rem)]">
            <Loader2 className="size-8 animate-spin text-slate-400" />
          </div>
        );
      }

  return (
        <div className="p-6 space-y-6">
          {/* Error Banner */}
          {hasAnyError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-red-800">資料載入失敗</h4>
                <p className="text-xs text-red-700 mt-1">部分儀表板數據無法從伺服器獲取，請稍後再試或檢查網路連線。</p>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsData.map((stat, idx) => (
              <div key={idx} className={`bg-white rounded-lg border ${stat.isMock ? 'border-dashed border-slate-300' : 'border-slate-200'} p-6 relative overflow-hidden`}>
                 {stat.isMock && (
                   <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-slate-100 text-[10px] tracking-wider font-bold text-slate-500 rounded">尚未提供</span>
                 )}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">{stat.title}</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                      <span className="text-sm text-slate-500">{stat.unit}</span>
                    </div>
                    {/* Removed fabricated change percentage */}
                    {!stat.isEmpty && !stat.isMock && stat.change && (
                       <p className={`text-sm mt-2 ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.change} 較昨日
                      </p>
                    )}
                     {stat.isEmpty && (
                       <p className="text-xs text-slate-400 mt-2 italic">無資料來源</p>
                     )}
                  </div>
                  <div className={`${stat.color} size-12 rounded-lg flex items-center justify-center`}>
                    <stat.icon className="size-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Mock/No Endpoint */}
            <div className="bg-white rounded-lg border border-dashed border-slate-300 p-6 relative min-h-[400px] flex flex-col">
               <span className="absolute top-4 right-4 px-1.5 py-0.5 bg-slate-100 text-[10px] tracking-wider font-bold text-slate-500 rounded">尚未提供</span>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">每日收發貨趨勢</h3>
                <div className="flex-1 flex items-center justify-center text-slate-400 italic">
               無歷史交易資料來源
                </div>
            </div>

            {/* Pie Chart - Real Data from Inventory Lots */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">庫存分佈 (依狀態)</h3>
                {inventoryByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                    data={inventoryByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.name}: ${entry.value.toLocaleString()}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                      >
                        {inventoryByStatus.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="flex items-center justify-center h-[300px] text-slate-400 italic">
                 無庫存資料
                   </div>
                )}
            </div>
          </div>

          {/* Recent Activities - Mock/No Endpoint */}
          <div className="bg-white rounded-lg border border-dashed border-slate-300 p-6 relative min-h-[200px] flex flex-col">
             <span className="absolute top-4 right-4 px-1.5 py-0.5 bg-slate-100 text-[10px] tracking-wider font-bold text-slate-500 rounded">尚未提供</span>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">最近活動</h3>
              <div className="flex-1 flex items-center justify-center text-slate-400 italic">
             無即時活動串流來源
              </div>
          </div>
        </div>
      );
}
