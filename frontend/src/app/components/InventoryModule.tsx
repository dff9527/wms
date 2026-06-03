import { useState } from 'react';
// FIX: [fix_2] — Remove unused import 'Package2' to resolve TS6133 error.
import { Search, MapPin, Filter, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import type { InventoryLotRow, InventoryLotRowStatus } from '../types/wms-inventory';
import { useInventoryLots } from '../api/inventory';

export default function InventoryModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLot, setSelectedLot] = useState<InventoryLotRow | null>(null);

   // Fetch real inventory data via React Query
  const { data: lotsData, isPending, isError, error } = useInventoryLots({});

   // FIX: [fix_2] — Remove .lots property access since lotsData is already InventoryLotRow[]
  const inventoryData: InventoryLotRow[] = lotsData ?? [];

  const locationMap = [
       { zone: 'A區', aisles: 3, racks: 45, occupancy: 78, color: 'bg-blue-500' },
       { zone: 'B區', aisles: 2, racks: 30, occupancy: 62, color: 'bg-green-500' },
       { zone: 'C區', aisles: 2, racks: 25, occupancy: 45, color: 'bg-yellow-500' },
       { zone: 'D區', aisles: 1, racks: 15, occupancy: 34, color: 'bg-purple-500' },
     ];

  const getStatusBadge = (status: InventoryLotRowStatus) => {
    // backend lot_status is UPPERCASE (AVAILABLE/RESERVED/QC_HOLD/QUARANTINE/EXPIRED/SHIPPED);
    // normalize and fall back for any status not in the map so the row never crashes.
    const statusConfig: Record<string, { label: string; className: string }> = {
      available: { label: '可用', className: 'bg-green-100 text-green-700' },
      reserved: { label: '已預留', className: 'bg-blue-100 text-blue-700' },
      expiring_soon: { label: '即將到期', className: 'bg-yellow-100 text-yellow-700' },
      quarantine: { label: '隔離', className: 'bg-red-100 text-red-700' },
      qc_hold: { label: '待檢', className: 'bg-amber-100 text-amber-700' },
      expired: { label: '已過期', className: 'bg-red-100 text-red-700' },
      shipped: { label: '已出貨', className: 'bg-slate-100 text-slate-600' },
    };
    const config = statusConfig[String(status ?? '').toLowerCase()] ?? {
      label: String(status ?? '—'),
      className: 'bg-slate-100 text-slate-700',
    };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
     };

   // Loading state
  if (isPending) {
    return (
       <div className="p-6 flex items-center justify-center h-64">
         <Loader2 className="size-8 animate-spin text-slate-400" />
         <span className="ml-3 text-slate-500">載入庫存資料中...</span>
       </div>
     );
   }

   // Error state
  if (isError) {
    return (
       <div className="p-6">
         <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
           <AlertCircle className="size-5 shrink-0 mt-0.5" />
           <div>
             <p className="font-medium">無法載入庫存資料</p>
             <p className="mt-1 text-amber-800/90">{error instanceof Error ? error.message : '發生未知錯誤'}</p>
           </div>
         </div>
       </div>
     );
   }

  return (
       <div className="p-6 space-y-6">
         <div className="bg-white rounded-lg border border-slate-200 p-4">
           <div className="flex flex-col md:flex-row gap-4">
             <div className="flex-1 relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
               <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋 internal_sku、internal_lot_number、internal_barcode、儲位…"
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
             <button type="button" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
               <Filter className="size-4" />
            進階篩選
             </button>
           </div>
         </div>

         <div className="bg-white rounded-lg border border-slate-200 p-6">
           <div className="flex items-center gap-3 mb-4">
             <MapPin className="size-6 text-blue-600" />
             <h2 className="text-xl font-semibold text-slate-900">儲位配置</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             {locationMap.map((zone, idx) => (
               <div key={idx} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                 <div className="flex items-center justify-between mb-3">
                   <h3 className="text-lg font-semibold text-slate-900">{zone.zone}</h3>
                   <div className={`${zone.color} size-3 rounded-full`}></div>
                 </div>
                 <div className="space-y-2 text-sm text-slate-600">
                   <div className="flex justify-between">
                     <span>走道數</span>
                     <span className="font-medium text-slate-900">{zone.aisles}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>貨架數</span>
                     <span className="font-medium text-slate-900">{zone.racks}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span>使用率</span>
                     <span className="font-medium text-slate-900">{zone.occupancy}%</span>
                   </div>
                 </div>
                 <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                   <div className={`h-full ${zone.color} transition-all`} style={{ width: `${zone.occupancy}%` }}></div>
                 </div>
               </div>
             ))}
           </div>
         </div>

         <div className="bg-white rounded-lg border border-slate-200">
           <div className="p-6 border-b border-slate-200">
             <h2 className="text-xl font-semibold text-slate-900">庫存明細 (Lot 級別)</h2>
             <p className="text-sm text-slate-500 mt-1">
            總計 {inventoryData.length} 個批次 · 料號 = internal_sku · 內部批號 = internal_lot_number · 內部條碼 = internal_barcode · 供應商批號 =
            vendor_lot_code
             </p>
           </div>

           {inventoryData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <MapPin className="size-12 mb-2" />
                <p className="text-sm">暫無符合條件的庫存批次</p>
              </div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full min-w-[1280px]">
                 <thead className="bg-slate-50">
                   <tr className="border-b border-slate-200">
                     <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">料號</th>
                     <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">內部批號</th>
                     <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">內部條碼</th>
                     <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">供應商批號</th>
                     <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">儲位</th>
                     <th className="text-right py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">可用量</th>
                     <th className="text-right py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">預留量</th>
                     <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">收貨日期</th>
                     <th className="text-center py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">MSL</th>
                     <th className="text-center py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">狀態</th>
                     <th className="text-center py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">操作</th>
                   </tr>
                 </thead>
                 <tbody>
                   {inventoryData.map((lot) => (
                     <tr
                    key={lot.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedLot(lot)}
                     >
                       <td className="py-3 px-3">
                         <div className="text-sm font-mono font-medium text-slate-900">{lot.internalSku}</div>
                         <div className="text-xs text-slate-500">{lot.description}</div>
                       </td>
                       <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">{lot.internalLotNumber}</td>
                       <td className="py-3 px-3 text-sm font-mono text-slate-800 whitespace-nowrap">{lot.internalBarcode}</td>
                       <td className="py-3 px-3">
                         <div className="text-sm font-mono text-slate-700">{lot.vendorLotCode}</div>
                         <div className="text-xs text-slate-500">{lot.vendor}</div>
                       </td>
                       <td className="py-3 px-3">
                         <div className="flex items-center gap-1 text-sm font-mono text-blue-600">
                           <MapPin className="size-3" />
                           {lot.location}
                         </div>
                       </td>
                       <td className="py-3 px-3 text-sm text-right font-medium text-slate-900">{lot.qtyOnHand.toLocaleString()}</td>
                       <td className="py-3 px-3 text-sm text-right text-slate-600">{lot.qtyReserved.toLocaleString()}</td>
                       <td className="py-3 px-3 text-sm text-slate-700 whitespace-nowrap">{lot.receiveDate}</td>
                       <td className="py-3 px-3 text-center">
                         <span className="inline-flex items-center justify-center size-6 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                           {lot.mslLevel}
                         </span>
                       </td>
                       <td className="py-3 px-3 text-center">{getStatusBadge(lot.status)}</td>
                       <td className="py-3 px-3 text-center">
                         <button type="button" className="text-sm text-blue-600 hover:text-blue-800">
                        詳情
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
         </div>

         {selectedLot && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLot(null)}>
             <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-xl font-semibold text-slate-900">批次詳情</h3>
                 <button type="button" onClick={() => setSelectedLot(null)} className="text-slate-400 hover:text-slate-600">
                   <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
               </div>

               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-sm text-slate-600">料號 (internal_sku)</label>
                     <p className="text-lg font-mono font-semibold text-slate-900">{selectedLot.internalSku}</p>
                     <p className="text-sm text-slate-500">{selectedLot.description}</p>
                   </div>
                   <div>
                     <label className="text-sm text-slate-600">供應商</label>
                     <p className="text-lg font-semibold text-slate-900">{selectedLot.vendor}</p>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-200">
                   <div>
                     <label className="text-sm text-slate-600">內部批號 (internal_lot_number)</label>
                     <p className="text-base font-mono font-medium text-slate-900">{selectedLot.internalLotNumber}</p>
                   </div>
                   <div>
                     <label className="text-sm text-slate-600">內部條碼 (internal_barcode)</label>
                     <p className="text-base font-mono font-medium text-slate-900">{selectedLot.internalBarcode}</p>
                   </div>
                   <div>
                     <label className="text-sm text-slate-600">供應商批號 (vendor_lot_code)</label>
                     <p className="text-base font-mono font-medium text-slate-900">{selectedLot.vendorLotCode}</p>
                   </div>
                 </div>

                 <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                   <div>
                     <label className="text-sm text-slate-600">可用量</label>
                     <p className="text-xl font-bold text-green-600">{selectedLot.qtyOnHand.toLocaleString()}</p>
                   </div>
                   <div>
                     <label className="text-sm text-slate-600">預留量</label>
                     <p className="text-xl font-bold text-blue-600">{selectedLot.qtyReserved.toLocaleString()}</p>
                   </div>
                   <div>
                     <label className="text-sm text-slate-600">MSL 等級</label>
                     <p className="text-xl font-bold text-slate-900">Level {selectedLot.mslLevel}</p>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                   <div className="flex items-center gap-2">
                     <Calendar className="size-4 text-slate-500" />
                     <div>
                       <label className="text-sm text-slate-600">收貨日期</label>
                       <p className="text-base font-medium text-slate-900">{selectedLot.receiveDate}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     {selectedLot.expiryDate && <AlertCircle className="size-4 text-yellow-500" />}
                     <div>
                       <label className="text-sm text-slate-600">到期日期</label>
                       <p className="text-base font-medium text-slate-900">{selectedLot.expiryDate || 'N/A'}</p>
                     </div>
                   </div>
                 </div>

                 <div className="pt-4 border-t border-slate-200">
                   <div className="flex items-center gap-2 mb-2">
                     <MapPin className="size-4 text-blue-600" />
                     <label className="text-sm text-slate-600">儲位</label>
                   </div>
                   <p className="text-xl font-mono font-bold text-blue-600">{selectedLot.location}</p>
                 </div>
               </div>
             </div>
           </div>
         )}
       </div>
     );
}
