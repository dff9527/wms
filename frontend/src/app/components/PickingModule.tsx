import { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, Clock, ArrowRight, Package, MapPin, Calendar, Plus, Play, XCircle, Printer } from 'lucide-react';
import type { FifoAllocationSummary, PickWaveTask } from '../types/wms-inventory';
import AllocationResult from './picking/AllocationResult';
import { printHtml } from '../utils/printWindow';

// Customer interface matching CustomerOut (snake_case)
interface Customer {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  approved_avl?: any;
  is_active: boolean;
}

// Item interface for dropdown
interface Item {
  internalSku: string;
  description: string;
}

interface SalesOrderItem {
  soNumber: string;
  customer: string;
  orderDate: string;
  status: string;
  totalLines: number;
  totalQty: number;
  strategy: string;
}

// Task extended with picking-specific states
interface PickWaveTaskWithPicking extends PickWaveTask {
  pickedQty: number; // The quantity picked by operator (can differ from pickQty)
  confirmError?: string; // Error message for this task
  isConfirming: boolean; // Loading state for confirmation
  isConfirmed: boolean; // Whether this task is confirmed
}

export default function PickingModule() {
  const [allocation, setAllocation] = useState<FifoAllocationSummary | null>(null);
  const [pickWave, setPickWave] = useState<PickWaveTask[]>([]);
  const [pickWaveWithPicking, setPickWaveWithPicking] = useState<PickWaveTaskWithPicking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSo, setSelectedSo] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  
  // New state for packing list
  const [packingList, setPackingList] = useState<{ 
    soNumber: string; 
    items: { 
      sku: string; 
      lots: { 
        internalLotNumber: string; 
        internalSku: string; 
        qty: number; 
        location: string | null; 
        receiveDate: string 
      }[] 
    }[] 
  } | null>(null);

  // Picking mode state
  const [isPickingMode, setIsPickingMode] = useState(false);

  const [salesOrders, setSalesOrders] = useState<SalesOrderItem[]>([]);
  
  // State for "Create SO" dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  
  // Form state
  const [soNumber, setSoNumber] = useState('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [strategy, setStrategy] = useState<'FIFO' | 'FEFO'>('FIFO');
  const [orderLines, setOrderLines] = useState<{internalSku: string; orderedQty: number}[]>([{internalSku: '', orderedQty: 1}]);
  
  // Customers and Items for dropdowns
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const fetchSalesOrders = async () => {
    try {
      const response = await axios.get('/api/v1/picking/orders');
      setSalesOrders(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to fetch sales orders', err);
    }
  };

  const handleAllocate = async (soNumber: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/v1/picking/allocate', { so_number: soNumber });
       // Map backend response to FifoAllocationSummary
      const data = response.data;
      setAllocation({
        soNumber: data.soNumber,
        requestedQty: data.requestedQty ?? 0,
        strategy: data.strategy_used || 'FIFO',
        allocatedQty: data.allocatedQty ?? 0,
        details: Array.isArray(data.details) ? data.details : []
       });

       // Refresh order statuses from backend, then the wave
      await fetchSalesOrders();
      await fetchPickWave();
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
         sequence: item.sequence ?? index + 1,
         taskId: item.task_id,
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
       // Reset picking mode when wave changes
       setPickWaveWithPicking(tasks.map(task => ({
         ...task,
         pickedQty: task.pickQty,
         isConfirming: false,
         isConfirmed: String(task.status).toLowerCase() === 'picked'
       })));
      } catch (err) {
       console.error('Failed to fetch pick wave', err);
      }
    };

  const handleConfirmShipment = async () => {
    if (!selectedSo) return;
    
    try {
      await axios.post('/api/v1/shipping/confirm', {
        so_number: selectedSo,
        shipper: 'operator'
      });

      // On success, fetch packing list and refresh wave/orders; exit picking mode
      await fetchPackingList(selectedSo);
      setIsPickingMode(false);
      await fetchPickWave();
      await fetchSalesOrders();
    } catch (err: any) {
      setConfirmError(err.response?.data?.detail || '確認出貨失敗');
    }
  };

  const fetchPackingList = async (soNumber: string) => {
    try {
      const response = await axios.get(`/api/v1/shipping/packing-list/${soNumber}`);
      setPackingList(response.data);
    } catch (err) {
      console.error('Failed to fetch packing list', err);
    }
  };

  // Handle individual task confirmation during picking mode
  const handleConfirmTask = async (task: PickWaveTaskWithPicking) => {
    if (task.isConfirming || task.isConfirmed) return;
    
    setPickWaveWithPicking(prev => prev.map(t => 
      t.taskId === task.taskId ? { ...t, isConfirming: true } : t
    ));
    
    try {
      await axios.post('/api/v1/picking/confirm', {
        task_id: task.taskId,
        picked_qty: task.pickedQty,
        picker: '' // Backend will use JWT user, empty string is acceptable
      });
      
      // Mark task as confirmed
      setPickWaveWithPicking(prev => prev.map(t => 
        t.taskId === task.taskId ? { 
          ...t, 
          isConfirming: false,
          isConfirmed: true
        } : t
      ));
      
      // Refresh wave to update status
      await fetchPickWave();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || '確認失敗';
      setPickWaveWithPicking(prev => prev.map(t => 
        t.taskId === task.taskId ? { 
          ...t, 
          isConfirming: false,
          confirmError: errorMessage
        } : t
      ));
    }
  };

  // Cancel error for a task
  const handleCancelError = (taskId: number) => {
    setPickWaveWithPicking(prev => prev.map(t => 
      t.taskId === taskId ? { ...t, confirmError: undefined } : t
    ));
  };

  // Calculate summary stats for picking mode
  const totalTasks = pickWaveWithPicking.length;
  const confirmedTasks = pickWaveWithPicking.filter(t => t.isConfirmed).length;
  const pendingTasks = pickWaveWithPicking.filter(t => !t.isConfirmed).length;
  const canConfirmShipment = pendingTasks === 0 && totalTasks > 0;

  const handleConfirmAllocation = async () => {
    // Simply refresh the wave when clicking "Confirm Allocation" (now used as refresh)
    setConfirmLoading(true);
    try {
      await fetchPickWave();
      setConfirmSuccess('波次已重新整理');
    } catch (err: any) {
      setConfirmError(err.response?.data?.detail || '刷新波次失敗');
    } finally {
      setConfirmLoading(false);
    }
  };

  const togglePickingMode = () => {
    setIsPickingMode(!isPickingMode);
    // Reset picking errors when exiting picking mode
    if (!isPickingMode) {
      setPickWaveWithPicking(prev => prev.map(t => ({ ...t, confirmError: undefined })));
    }
  };

  const handlePickedQtyChange = (taskId: number, value: string) => {
    const numValue = parseFloat(value);
    setPickWaveWithPicking(prev => prev.map(t => 
      t.taskId === taskId ? { ...t, pickedQty: isNaN(numValue) ? 0 : numValue } : t
    ));
  };

  // Print pick wave function
  const printPickWave = () => {
    if (pickWave.length === 0) return;
    
    const now = new Date();
    const DateTimeString = now.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const headerHtml = `
      <div class="print-title">揀貨單 Pick Wave</div>
      <div class="print-subtitle">列印日期: ${DateTimeString}</div>
      <div class="info-row"><span class="info-label">訂單編號:</span><span class="info-value">${selectedSo || 'N/A'}</span></div>
      <div class="info-row"><span class="info-label">總任務數:</span><span class="info-value">${totalTasks}</span></div>
      <hr style="border: 1px solid #000; margin: 15px 0;">
    `;
    
    let tableHtml = `
      <table>
        <thead>
          <tr>
            <th>序號</th>
            <th>儲位</th>
            <th>料號</th>
            <th>內部批號</th>
            <th>內部條碼</th>
            <th>供應商批號</th>
            <th>揀貨量</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    pickWave.forEach((task) => {
      const statusText = String(task.status || '—').toLowerCase();
      let statusLabel = task.status || '—';
      if (statusText.includes('pending')) statusLabel = '待配貨';
      else if (statusText.includes('allocated')) statusLabel = '已配貨';
      else if (statusText.includes('picking')) statusLabel = '揀貨中';
      else if (statusText.includes('completed')) statusLabel = '已完成';
      else if (statusText.includes('picked')) statusLabel = '已揀貨';
      else if (statusText.includes('confirmed')) statusLabel = '已確認';
      else if (statusText.includes('cancelled')) statusLabel = '已取消';
      else if (statusText.includes('shipped')) statusLabel = '已出貨';
      else if (statusText.includes('closed')) statusLabel = '已關閉';
      
      tableHtml += `
        <tr>
          <td>${task.sequence}</td>
          <td>${task.location || '—'}</td>
          <td>${task.internalSku}</td>
          <td>${task.internalLotNumber || '—'}</td>
          <td>${task.internalBarcode || '—'}</td>
          <td>${task.vendorLotCode || '—'}</td>
          <td>${task.pickQty}</td>
          <td>${statusLabel}</td>
        </tr>
      `;
    });
    
    tableHtml += `</tbody></table>`;
    
    printHtml(`揀貨單 - ${selectedSo || 'N/A'}`, headerHtml + tableHtml);
  };

  // Print packing list function
  const printPackingList = () => {
    if (!packingList || !packingList.items.length) return;
    
    const now = new Date();
    const DateTimeString = now.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const headerHtml = `
      <div class="print-title">裝箱單 Packing List</div>
      <div class="print-subtitle">訂單編號: ${packingList.soNumber} · 列印日期: ${DateTimeString}</div>
      <hr style="border: 1px solid #000; margin: 15px 0;">
    `;
    
    let contentHtml = '';
    
    packingList.items.forEach((item) => {
      let itemTableHtml = `
        <h2>料號: ${item.sku}</h2>
        <table>
          <thead>
            <tr>
              <th>內部批號</th>
              <th>數量</th>
              <th>收貨日期</th>
              <th>儲位</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      item.lots.forEach((lot) => {
        itemTableHtml += `
          <tr>
            <td>${lot.internalLotNumber || '—'}</td>
            <td>${lot.qty}</td>
            <td>${lot.receiveDate || '—'}</td>
            <td>${lot.location || '—'}</td>
          </tr>
        `;
      });
      
      itemTableHtml += `</tbody></table>`;
      contentHtml += itemTableHtml;
    });
    
    printHtml(`裝箱單 - ${packingList.soNumber}`, headerHtml + contentHtml);
  };

  useEffect(() => {
    fetchSalesOrders();
    fetchPickWave();
  }, []);

  // Fetch customers and items for dropdowns
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await axios.get('/api/v1/customers');
        setCustomers(response.data);
      } catch (err) {
        console.error('Failed to fetch customers', err);
      }
    };
    const fetchItems = async () => {
      try {
        const response = await axios.get('/api/v1/purchase-orders/items');
        setItems(response.data);
      } catch (err) {
        console.error('Failed to fetch items', err);
      }
    };
    fetchCustomers();
    fetchItems();
  }, []);

  // Handle Create SO dialog
  const handleCreateSO = async () => {
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    
    try {
      const lines = orderLines.filter(line => line.internalSku && line.orderedQty > 0);
      
      if (lines.length === 0) {
        setCreateError('請至少新增一筆明細');
        setCreateLoading(false);
        return;
      }
      
      await axios.post('/api/v1/picking/orders', {
        soNumber: soNumber.trim(),
        customerId: customerId === '' ? null : customerId,
        strategy: strategy,
        lines: lines.map(line => ({
          internalSku: line.internalSku,
          orderedQty: line.orderedQty
        }))
      });
      
      setCreateSuccess('訂單建立成功！');
      setSoNumber('');
      setCustomerId('');
      setStrategy('FIFO');
      setOrderLines([{internalSku: '', orderedQty: 1}]);
      setShowCreateDialog(false);
      
      // Refresh the sales orders list
      await fetchSalesOrders();
      
    } catch (err: any) {
      const detail = err.response?.data?.detail || '建立訂單失敗';
      setCreateError(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setCreateLoading(false);
    }
  };

  const addOrderLine = () => {
    setOrderLines([...orderLines, {internalSku: '', orderedQty: 1}]);
  };

  const removeOrderLine = (index: number) => {
    if (orderLines.length > 1) {
      const newLines = [...orderLines];
      newLines.splice(index, 1);
      setOrderLines(newLines);
    }
  };

  const updateOrderLine = (index: number, field: 'internalSku' | 'orderedQty', value: string | number) => {
    const newLines = [...orderLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setOrderLines(newLines);
  };

  const getStatusBadge = (status: string | undefined | null) => {
    const statusConfig = {
      pending: { label: '待配貨', className: 'bg-slate-100 text-slate-700', icon: Clock },
      allocated: { label: '已配貨', className: 'bg-blue-100 text-blue-700', icon: CheckCircle },
      picking: { label: '揀貨中', className: 'bg-yellow-100 text-yellow-700', icon: Package },
      completed: { label: '已完成', className: 'bg-green-100 text-green-700', icon: CheckCircle },
      in_progress: { label: '進行中', className: 'bg-orange-100 text-orange-700', icon: Clock },
      picked: { label: '已揀貨', className: 'bg-indigo-100 text-indigo-700', icon: CheckCircle },
      confirmed: { label: '已確認', className: 'bg-teal-100 text-teal-700', icon: CheckCircle },
      cancelled: { label: '已取消', className: 'bg-red-100 text-red-700', icon: Clock },
      open: { label: '開啟', className: 'bg-gray-100 text-gray-700', icon: Clock },
      shipped: { label: '已出貨', className: 'bg-purple-100 text-purple-700', icon: CheckCircle },
      closed: { label: '已關閉', className: 'bg-slate-200 text-slate-600', icon: Clock }
    };
    
    const key = String(status).toLowerCase();
    const config = statusConfig[key as keyof typeof statusConfig] || { 
      label: status || '—', 
      className: 'bg-slate-100 text-slate-700', 
      icon: Clock 
    };
    
    const Icon = config.icon;
    return (
       <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.className}`}>
         <Icon className="size-3" />
         {config.label}
       </span>
     );
  };

  // In picking mode, show tasks with input and confirm button
  const renderPickingTask = (task: PickWaveTaskWithPicking) => (
    <tr key={task.sequence} className={`border-b border-slate-100 ${task.isConfirmed ? 'bg-green-50/50' : 'bg-white'}`}>
      <td className="py-3 px-3">
        <span className={`inline-flex items-center justify-center size-7 rounded-full font-bold text-sm ${task.isConfirmed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
          {task.sequence}
        </span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-blue-600 shrink-0" />
          <span className="text-sm font-mono font-semibold text-blue-600">{task.location ?? '—'}</span>
        </div>
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">{task.internalSku}</td>
      <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">{task.internalLotNumber}</td>
      <td className="py-3 px-3 text-sm font-mono text-slate-800 whitespace-nowrap">{task.internalBarcode}</td>
      <td className="py-3 px-3 text-sm font-mono text-slate-700 whitespace-nowrap">{task.vendorLotCode}</td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={task.pickedQty}
            onChange={(e) => handlePickedQtyChange(task.taskId, e.target.value)}
            disabled={task.isConfirmed || task.isConfirming}
            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-xs text-slate-500">/ {task.pickQty.toLocaleString()}</span>
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1 text-sm text-slate-700 whitespace-nowrap">
          <Calendar className="size-3 text-slate-500 shrink-0" />
          {task.receiveDate}
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center justify-center gap-2">
          {task.isConfirmed ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
              <CheckCircle className="size-3" />
              已確認
            </span>
          ) : (
            <>
              {getStatusBadge(task.status)}
              <button
                type="button"
                onClick={() => handleConfirmTask(task)}
                disabled={task.isConfirming}
                className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {task.isConfirming ? '確認中...' : '確認'}
              </button>
            </>
          )}
        </div>
        {task.confirmError && (
          <div className="mt-2 flex items-start gap-2">
            <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
              <span className="font-semibold">錯誤: </span>{task.confirmError}
            </div>
            <button
              type="button"
              onClick={() => handleCancelError(task.taskId)}
              className="text-red-400 hover:text-red-600"
            >
              <span className="text-lg">&times;</span>
            </button>
          </div>
        )}
      </td>
    </tr>
  );

  // In regular mode (not picking), show tasks as read-only
  const renderReadOnlyTask = (task: PickWaveTask) => (
    <tr key={task.sequence} className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-3 px-3">
        <span className="inline-flex items-center justify-center size-7 bg-blue-100 text-blue-700 rounded-full font-bold text-sm">
          {task.sequence}
        </span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-blue-600 shrink-0" />
          <span className="text-sm font-mono font-semibold text-blue-600">{task.location ?? '—'}</span>
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
  );

  return (
     <div className="p-6 space-y-6">
       <div className="bg-white rounded-lg border border-slate-200 p-6">
         <div className="flex items-center justify-between mb-4">
           <div>
             <h2 className="text-xl font-semibold text-slate-900">銷售訂單</h2>
             <p className="text-sm text-slate-500 mt-1">等待配貨與揀貨的訂單</p>
           </div>
           <button
             type="button"
             onClick={() => {
               setShowCreateDialog(true);
               setCreateError(null);
               setCreateSuccess(null);
             }}
             className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
           >
             <Plus className="size-4" />
             新增訂單
           </button>
         </div>

         {salesOrders.length === 0 && (
           <p className="text-sm text-slate-400 py-6 text-center">目前沒有訂單</p>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {salesOrders.map((order) => (
             <div
              key={order.soNumber}
              onClick={() => { setSelectedSo(order.soNumber); handleAllocate(order.soNumber); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedSo(order.soNumber); handleAllocate(order.soNumber); } }}
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
                 <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">{order.strategy}</span>
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
                訂單: {allocation.soNumber} | 策略: {allocation.strategy}
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
                   ✓ 依據 <span className="font-semibold">{allocation.strategy}</span> 自動分配
                   {allocation.strategy === 'FIFO' && ' · 最早收貨優先'}
                   {allocation.strategy === 'FEFO' && ' · 最早到期優先'}
                 </p>
                 <button
                  type="button"
                  onClick={handleConfirmAllocation}
                  disabled={confirmLoading}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                 >
                   {confirmLoading ? '刷新中...' : '刷新波次'}
                 </button>
               </div>
               {confirmSuccess && (
                 <div className="mt-2 bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 text-sm">{confirmSuccess}</div>
               )}
               {confirmError && (
                 <div className="mt-2 bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">{confirmError}</div>
               )}
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
             <p className="text-sm text-slate-500">已依儲位路徑優化排序 · 揀貨時請掃描內部條碼</p>
           </div>
           <div className="flex gap-2">
             <button 
               type="button" 
               onClick={() => printPickWave()}
               disabled={pickWave.length === 0}
               className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Printer className="size-4" />
               列印揀貨單
             </button>
             {isPickingMode ? (
               <button 
                type="button" 
                onClick={togglePickingMode}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
               >
                 <XCircle className="size-4" />
                 離開揀貨模式
               </button>
             ) : (
               <button 
                type="button" 
                onClick={togglePickingMode}
                disabled={pickWave.length === 0 || !pickWave.some(t => String(t.status).toUpperCase() === 'PENDING')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Play className="size-4" />
                 開始揀貨
               </button>
             )}
           </div>
         </div>

         {pickWave.length === 0 ? (
           <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500">
             無揀貨任務，請先執行配貨
           </div>
         ) : (
           <>
             <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <span className="text-slate-700">
                     <span className="font-semibold">總任務數:</span> {totalTasks}
                   </span>
                   <span className="text-green-700">
                     <span className="font-semibold">已完成:</span> {confirmedTasks}
                   </span>
                   <span className="text-orange-700">
                     <span className="font-semibold">待完成:</span> {pendingTasks}
                   </span>
                 </div>
                 {isPickingMode && canConfirmShipment && (
                   <button
                    type="button"
                    onClick={handleConfirmShipment}
                    disabled={confirmLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-semibold text-lg"
                   >
                     <CheckCircle className="size-5" />
                     確認出貨
                   </button>
                 )}
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
                   {pickWaveWithPicking.map((task) => 
                     isPickingMode ? renderPickingTask(task) : renderReadOnlyTask(task)
                   )}
                 </tbody>
               </table>
             </div>
           </>
         )}

         <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
           <div className="flex items-start gap-3">
             <div className="size-5 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
               <span className="text-white text-xs">ⓘ</span>
             </div>
             <div className="text-sm text-blue-900">
               <p className="font-medium mb-1">路徑優化提示</p>
               <p className="text-blue-700">揀貨路徑已依儲位編號排序，減少行走距離。</p>
             </div>
           </div>
         </div>
       </div>

       {/* Packing List Section */}
       {packingList && (
         <div className="bg-white rounded-lg border border-slate-200 p-6">
           <div className="flex items-center justify-between mb-4">
             <div>
               <h2 className="text-xl font-semibold text-slate-900">裝箱清單</h2>
               <p className="text-sm text-slate-500 mt-1">訂單: {packingList.soNumber}</p>
             </div>
             <button 
               type="button" 
               onClick={() => printPackingList()}
               disabled={!packingList.items.length}
               className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Printer className="size-4" />
               列印裝箱單
             </button>
           </div>

           <div className="space-y-4">
             {packingList.items.map((item, itemIndex) => (
               <div key={itemIndex} className="border border-slate-200 rounded-lg overflow-hidden">
                 <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                   <span className="text-sm font-medium text-slate-700">料號: {item.sku}</span>
                 </div>
                 <table className="w-full min-w-[800px]">
                   <thead className="bg-slate-50/50">
                     <tr className="border-b border-slate-200">
                       <th className="text-left py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">內部批號</th>
                       <th className="text-left py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">料號</th>
                       <th className="right py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">數量</th>
                       <th className="text-left py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">收貨日期</th>
                       <th className="text-left py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">儲位</th>
                     </tr>
                   </thead>
                   <tbody>
                     {item.lots.map((lot, lotIndex) => (
                       <tr key={lotIndex} className="border-b border-slate-100 hover:bg-slate-50 last:border-b-0">
                         <td className="py-2 px-3 text-sm font-mono text-slate-900">{lot.internalLotNumber}</td>
                         <td className="py-2 px-3 text-sm font-mono text-slate-700">{lot.internalSku}</td>
                         <td className="py-2 px-3 text-sm text-right font-semibold text-slate-900">{lot.qty.toLocaleString()}</td>
                         <td className="py-2 px-3 text-sm text-slate-700">{lot.receiveDate}</td>
                         <td className="py-2 px-3 text-sm text-slate-700">{lot.location ?? '—'}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             ))}
           </div>
         </div>
       )}

       {/* Create SO Dialog */}
       {showCreateDialog && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="p-6 border-b border-slate-200 flex items-center justify-between">
               <h3 className="text-xl font-semibold text-slate-900">建立銷售訂單</h3>
               <button
                 type="button"
                 onClick={() => {
                   setShowCreateDialog(false);
                   setCreateError(null);
                   setCreateSuccess(null);
                 }}
                 className="text-slate-400 hover:text-slate-600"
               >
                 <span className="text-2xl">&times;</span>
               </button>
             </div>
             
             <div className="p-6 space-y-4">
               {/* Error/Success messages */}
               {createError && (
                 <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
                   {createError}
                 </div>
               )}
               {createSuccess && (
                 <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 text-sm">
                   {createSuccess}
                 </div>
               )}

               {/* Order Number */}
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">
                   訂單編號 *
                 </label>
                 <input
                   type="text"
                   value={soNumber}
                   onChange={(e) => setSoNumber(e.target.value)}
                   placeholder="例如: SO-2026-001"
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                   disabled={createLoading}
                 />
               </div>

               {/* Customer */}
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">
                   客戶
                 </label>
                 <select
                   value={customerId}
                   onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                   disabled={createLoading}
                 >
                   <option value="">請選擇客戶</option>
                   {customers.map((customer) => (
                     <option key={customer.customer_id} value={customer.customer_id}>
                       {customer.customer_name} ({customer.customer_code})
                     </option>
                   ))}
                 </select>
               </div>

               {/* Strategy */}
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">
                   配貨策略
                 </label>
                 <select
                   value={strategy}
                   onChange={(e) => setStrategy(e.target.value as 'FIFO' | 'FEFO')}
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                   disabled={createLoading}
                 >
                   <option value="FIFO">FIFO (先進先出)</option>
                   <option value="FEFO">FEFO (先到期先出)</option>
                 </select>
               </div>

               {/* Order Lines */}
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-2">
                   明細列
                 </label>
                 <div className="space-y-3">
                   {orderLines.map((line, index) => (
                     <div key={index} className="flex gap-3 items-start">
                       {/* SKU Dropdown */}
                       <div className="flex-1">
                         <label className="block text-xs font-medium text-slate-500 mb-1">
                           料號 * {index + 1}
                         </label>
                         <select
                           value={line.internalSku}
                           onChange={(e) => updateOrderLine(index, 'internalSku', e.target.value)}
                           className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                           disabled={createLoading}
                         >
                           <option value="">請選擇料號</option>
                           {items.map((item) => (
                             <option key={item.internalSku} value={item.internalSku}>
                               {item.internalSku} - {item.description}
                             </option>
                           ))}
                         </select>
                       </div>
                       
                       {/* Quantity */}
                       <div className="w-32">
                         <label className="block text-xs font-medium text-slate-500 mb-1">
                           數量 *
                         </label>
                         <input
                           type="number"
                           min="1"
                           value={line.orderedQty}
                           onChange={(e) => updateOrderLine(index, 'orderedQty', Number(e.target.value))}
                           className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                           disabled={createLoading}
                         />
                       </div>
                       
                       {/* Remove Button */}
                       {orderLines.length > 1 && (
                         <button
                           type="button"
                           onClick={() => removeOrderLine(index)}
                           className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                           disabled={createLoading}
                         >
                           <span className="text-lg">&times;</span>
                         </button>
                       )}
                     </div>
                   ))}
                 </div>
                 
                 <button
                   type="button"
                   onClick={addOrderLine}
                   disabled={createLoading}
                   className="mt-3 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
                 >
                   + 新增明細
                 </button>
               </div>
             </div>
             
             <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50 rounded-b-lg">
               <button
                 type="button"
                 onClick={() => {
                   setShowCreateDialog(false);
                   setCreateError(null);
                   setCreateSuccess(null);
                 }}
                 disabled={createLoading}
                 className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
               >
                 取消
               </button>
               <button
                 type="button"
                 onClick={handleCreateSO}
                 disabled={createLoading}
                 className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
               >
                 {createLoading ? (
                   <>
                     <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                     建立中...
                   </>
                 ) : (
                   '建立訂單'
                 )}
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
   );
}