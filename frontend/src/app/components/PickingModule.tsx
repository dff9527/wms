import { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, Clock, ArrowRight, Package, MapPin, Calendar } from 'lucide-react';
import type { FifoAllocationSummary, PickWaveTask } from '../types/wms-inventory';
import AllocationResult from './picking/AllocationResult';

export default function PickingModule() {
  const [allocation, setAllocation] = useState<FifoAllocationSummary | null>(null);
  const [pickWave, setPickWave] = useState<PickWaveTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSo, setSelectedSo] = useState<string | null>(null);

  const salesOrders = [
       {
      soNumber: 'SO-2024-0342',
      customer: '台積電',
      orderDate: '2024-05-01',
      status: 'allocated',
      totalLines: 3,
      totalQty: 8500,
      fifoStrategy: 'FIFO',
       },
       {
      soNumber: 'SO-2024-0343',
      customer: '聯發科',
      orderDate: '2024-05-02',
      status: 'picking',
      totalLines: 2,
      totalQty: 5000,
      fifoStrategy: 'FEFO',
       },
       {
      soNumber: 'SO-2024-0344',
      customer: '日月光',
      orderDate: '2024-05-03',
      status: 'pending',
      totalLines: 4,
      totalQty: 12000,
      fifoStrategy: 'FIFO',
       },
     ];

  const handleAllocate = async (soNumber: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/v1/picking/allocate', { so_number: soNumber });
       // Map backend response to FifoAllocationSummary
      const data = response.data;
      setAllocation({
        soNumber: data.soNumber,
        internalSku: data.internalSku || '',
        requestedQty: data.requestedQty || 0,
        strategy: data.strategy_used || 'FIFO',
        allocatedQty: data.allocatedQty || 0,
        details: data.details || []
       });
      
       // Fetch wave after allocation
      fetchPickWave();
     } catch (err: any) {
      setError(err.response?.data?.detail || 'Allocation failed');
     } finally {
      setLoading(false);
     }
   };

  const fetchPickWave = async () => {
    try {
      const response = await axios.get('/api/v1/picking/wave');
       // Map response into PickWaveTask[]
      const tasks: PickWaveTask[] = response.data.map((item: any, index: number) => ({
        sequence: item.sequence || index + 1,
        location: item.location,
        internalSku: item.internalSku,
        internalLotNumber: item.internalLotNumber,
        internalBarcode: item.internalBarcode,
        vendorLotCode: item.vendorLotCode,
        pickQty: item.pickQty,
        receiveDate: item.receiveDate,
        expiryDate: item.expiryDate,
        status: item.status,
        soNumber: item.soNumber
       }));
      setPickWave(tasks);
     } catch (err) {
      console.error('Failed to fetch pick wave', err);
     }
   };

  useEffect(() => {
     // Fetch initial wave if needed, or wait for allocation
     // Spec says: Run on mount and after a successful allocate.
    fetchPickWave();
   }, []);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '待配貨', className: 'bg-slate-100 text-slate-700', icon: Clock },
      allocated: { label: '已配貨', className: 'bg-blue-100 text-blue-700', icon: CheckCircle },
      picking: { label: '揀貨中', className: 'bg-yellow-100 text-yellow-700', icon: Package },
      completed: { label: '已完成', className: 'bg-green-100 text-green-700', icon: CheckCircle },
      in_progress: { label: '進行中', className: 'bg-orange-100 text-orange-700', icon: Clock },
       };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    return (
         <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.className}`}>
           <Icon className="size-3" />
           {config.label}
         </span>
       );
     };

  return (
       <div className="p-6 space-y-6">
         <div className="bg-white rounded-lg border border-slate-200 p-6">
           <div className="flex items-center justify-between mb-4">
             <div>
               <h2 className="text-xl font-semibold text-slate-900">銷售訂單</h2>
               <p className="text-sm text-slate-500 mt-1">等待配貨與揀貨的訂單</p>
             </div>
             <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
               + 新增訂單
             </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {salesOrders.map((order) => (
               // FIX: [fix_2] — Call setSelectedSo alongside handleAllocate so the state setter is used, resolving TS6133 and activating selection highlight
               <div
              key={order.soNumber}
              onClick={() => { setSelectedSo(order.soNumber); handleAllocate(order.soNumber); }}
              className={`border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${selectedSo === order.soNumber ? 'ring-2 ring-blue-500' : ''}`}
               >
                 <div className="flex items-center justify-between mb-3">
                   <span className="text-sm font-mono font-semibold text-slate-900">{order.soNumber}</span>
                   {getStatusBadge(order.status)}
                 </div>
                 <div className="space-y-2 text-sm">
                   <div className="flex justify-between">
                     <span className="text-slate-600">客戶</span>
                     <span className="font-medium text-slate-900">{order.customer}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-slate-600">訂購日期</span>
                     <span className="text-slate-700">{order.orderDate}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-slate-600">行項數</span>
                     <span className="text-slate-700">{order.totalLines} 項</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-slate-600">總數量</span>
                     <span className="font-semibold text-slate-900">{order.totalQty.toLocaleString()} PCS</span>
                   </div>
                 </div>
                 <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                   <span className="text-xs text-slate-500">配貨策略</span>
                   <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">{order.fifoStrategy}</span>
                 </div>
               </div>
             ))}
           </div>
         </div>

         <div className="bg-white rounded-lg border border-slate-200 p-6">
           <div className="flex items-center gap-3 mb-4">
             <div className="size-10 bg-purple-100 rounded-lg flex items-center justify-center">
               <ArrowRight className="size-5 text-purple-600" />
             </div>
             <div>
               <h2 className="text-xl font-semibold text-slate-900">FIFO 配貨結果</h2>
               {allocation && (
                 <p className="text-sm text-slate-500">
                  訂單: {allocation.soNumber} | 料號 (internal_sku): {allocation.internalSku} | 策略: {allocation.strategy}
                 </p>
               )}
             </div>
           </div>

           {loading ? (
             <div className="flex justify-center py-8">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
             </div>
           ) : error ? (
             <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
               {error}
             </div>
           ) : allocation ? (
             <>
               <AllocationResult allocation={allocation} />
              
               <div className="mt-4 pt-4 border-t border-slate-200">
                 <div className="flex items-center justify-between flex-wrap gap-2">
                   <p className="text-sm text-slate-600">
                     ✓ 依據 <span className="font-semibold">{allocation.strategy}</span> 自動分配（排序鍵：
                     <span className="font-mono"> internal_lot_number / receive_date</span>）
                     {allocation.strategy === 'FIFO' && ' · 最早收貨優先'}
                     {allocation.strategy === 'FEFO' && ' · 最早到期優先'}
                   </p>
                   <button type="button" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    確認配貨
                   </button>
                 </div>
               </div>
             </>
           ) : (
             <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500">
              請選擇訂單以執行配貨
             </div>
           )}
         </div>

         <div className="bg-white rounded-lg border border-slate-200 p-6">
           <div className="flex items-center justify-between mb-4">
             <div>
               <h2 className="text-xl font-semibold text-slate-900">揀貨波次</h2>
               <p className="text-sm text-slate-500">已依儲位路徑優化排序 · 揀貨掃描請使用 internal_barcode</p>
             </div>
             <div className="flex gap-2">
               <button type="button" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
              列印揀貨單
               </button>
               <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              開始揀貨
               </button>
             </div>
           </div>

           <div className="overflow-x-auto">
             <table className="w-full min-w-[1320px]">
               <thead className="bg-slate-50">
                 <tr className="border-b border-slate-200">
                   <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">序號</th>
                   <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">儲位</th>
                   <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">料號</th>
                   <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">內部批號</th>
                   <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">內部條碼</th>
                   <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">供應商批號</th>
                   <th className="text-right py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">揀貨量</th>
                   <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">收貨日期</th>
                   <th className="text-center py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">狀態</th>
                 </tr>
               </thead>
               <tbody>
                 {pickWave.length === 0 ? (
                   <tr>
                     <td colSpan={9} className="py-8 text-center text-slate-500">
                      無揀貨任務，請先執行配貨
                     </td>
                   </tr>
                 ) : (
                  pickWave.map((task) => (
                     <tr key={task.sequence} className="border-b border-slate-100 hover:bg-slate-50">
                       <td className="py-3 px-3">
                         <span className="inline-flex items-center justify-center size-7 bg-blue-100 text-blue-700 rounded-full font-bold text-sm">
                           {task.sequence}
                         </span>
                       </td>
                       <td className="py-3 px-3">
                         <div className="flex items-center gap-2">
                           <MapPin className="size-4 text-blue-600 shrink-0" />
                           <span className="text-sm font-mono font-semibold text-blue-600">{task.location}</span>
                         </div>
                       </td>
                       <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">{task.internalSku}</td>
                       <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">{task.internalLotNumber}</td>
                       <td className="py-3 px-3 text-sm font-mono text-slate-800 whitespace-nowrap">{task.internalBarcode}</td>
                       <td className="py-3 px-3 text-sm font-mono text-slate-700 whitespace-nowrap">{task.vendorLotCode}</td>
                       <td className="py-3 px-3 text-sm text-right font-semibold text-slate-900">{task.pickQty.toLocaleString()} PCS</td>
                       <td className="py-3 px-3">
                         <div className="flex items-center gap-1 text-sm text-slate-700 whitespace-nowrap">
                           <Calendar className="size-3 text-slate-500 shrink-0" />
                           {task.receiveDate}
                         </div>
                       </td>
                       <td className="py-3 px-3 text-center">{getStatusBadge(task.status)}</td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
           </div>

           <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
             <div className="flex items-start gap-3">
               <div className="size-5 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                 <span className="text-white text-xs">ⓘ</span>
               </div>
               <div className="text-sm text-blue-900">
                 <p className="font-medium mb-1">路徑優化提示</p>
                 <p className="text-blue-700">
                揀貨路徑已依儲位編號排序 (A-01 → A-02 → B-01)，減少行走距離。預計完成時間:{' '}
                   <span className="font-semibold">約 15 分鐘</span>
                 </p>
               </div>
             </div>
           </div>
         </div>
       </div>
     );
}
