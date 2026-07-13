import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { notifyScanResult } from '../utils/scanFeedback';
import type { FifoAllocationSummary, PickWaveTask } from '../types/wms-inventory';
import AllocationSection from './picking/AllocationSection';
import CancelOrderDialog from './picking/CancelOrderDialog';
import CancelTaskDialog from './picking/CancelTaskDialog';
import CreateSODialog from './picking/CreateSODialog';
import EditOrderDialog from './picking/EditOrderDialog';
import PackingListSection from './picking/PackingListSection';
import PickWaveSection from './picking/PickWaveSection';
import SalesOrdersSection from './picking/SalesOrdersSection';
import {
  mapSalesOrderItem,
  type Customer,
  type Item,
  type PackingList,
  type PickWaveTaskWithPicking,
  type SalesOrderItem,
} from './picking/types';
import { printPackingListDocument, printPickWaveDocument } from './picking/printHelpers';
import { getRole } from '../api/auth';

export default function PickingModule() {
  const pickScanRef = useRef<HTMLInputElement>(null);
  const isAdmin = getRole() === 'admin';
  const [allocation, setAllocation] = useState<FifoAllocationSummary | null>(null);
  const [pickWave, setPickWave] = useState<PickWaveTask[]>([]);
  const [pickWaveWithPicking, setPickWaveWithPicking] = useState<PickWaveTaskWithPicking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSo, setSelectedSo] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [packingList, setPackingList] = useState<PackingList | null>(null);

  const [isPickingMode, setIsPickingMode] = useState(false);
  const [pickBarcode, setPickBarcode] = useState('');

  const [salesOrders, setSalesOrders] = useState<SalesOrderItem[]>([]);
  const [showCancelledOrders, setShowCancelledOrders] = useState(false);
  const [editOrder, setEditOrder] = useState<SalesOrderItem | null>(null);
  const [editOrderCustomerId, setEditOrderCustomerId] = useState<number | ''>('');
  const [editOrderStrategy, setEditOrderStrategy] = useState<'FIFO' | 'FEFO'>('FIFO');
  const [cancelOrder, setCancelOrder] = useState<SalesOrderItem | null>(null);
  const [cancelTask, setCancelTask] = useState<PickWaveTask | null>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [soNumber, setSoNumber] = useState('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [strategy, setStrategy] = useState<'FIFO' | 'FEFO'>('FIFO');
  const [orderLines, setOrderLines] = useState<{ internalSku: string; orderedQty: number }[]>([
    { internalSku: '', orderedQty: 1 },
  ]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);
  const [addCustomerCode, setAddCustomerCode] = useState('');
  const [addCustomerName, setAddCustomerName] = useState('');
  const [addCustomerLoading, setAddCustomerLoading] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);

  const fetchSalesOrders = async () => {
    try {
      const response = await axios.get('/api/v1/picking/orders', {
        params: { include_cancelled: showCancelledOrders || undefined },
      });
      const orderItems = Array.isArray(response.data) ? response.data : response.data?.items ?? [];
      setSalesOrders(orderItems.map(mapSalesOrderItem));
    } catch (err) {
      console.error('Failed to fetch sales orders', err);
      toast.error('載入銷售訂單失敗');
    }
  };

  const handleAllocate = async (soNumber: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/v1/picking/allocate', { so_number: soNumber });
      const data = response.data;
      setAllocation({
        soNumber: data.soNumber,
        requestedQty: data.requestedQty ?? 0,
        strategy: data.strategy_used || 'FIFO',
        allocatedQty: data.allocatedQty ?? 0,
        details: Array.isArray(data.details) ? data.details : [],
      });

      await fetchSalesOrders();
      await fetchPickWave();
    } catch (err: any) {
      const message = err.response?.data?.detail || '配貨失敗';
      setError(message);
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setLoading(false);
    }
  };

  const fetchPickWave = async () => {
    try {
      const response = await axios.get('/api/v1/picking/wave');
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
        soNumber: item.soNumber,
      }));
      setPickWave(tasks);
      setPickWaveWithPicking(
        tasks.map((task) => ({
          ...task,
          pickedQty: task.pickQty,
          isConfirming: false,
          isConfirmed: String(task.status).toLowerCase() === 'picked',
        }))
      );
    } catch (err) {
      console.error('Failed to fetch pick wave', err);
    }
  };

  const handleConfirmShipment = async () => {
    if (!selectedSo) return;

    try {
      await axios.post('/api/v1/shipping/confirm', {
        so_number: selectedSo,
        shipper: 'operator',
      });

      await fetchPackingList(selectedSo);
      setIsPickingMode(false);
      await fetchPickWave();
      await fetchSalesOrders();
      toast.success('出貨確認成功');
    } catch (err: any) {
      const message = err.response?.data?.detail || '確認出貨失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
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

  const handleConfirmTask = async (task: PickWaveTaskWithPicking) => {
    if (task.isConfirming || task.isConfirmed) return;

    setPickWaveWithPicking((prev) =>
      prev.map((t) => (t.taskId === task.taskId ? { ...t, isConfirming: true } : t))
    );

    try {
      await axios.post('/api/v1/picking/confirm', {
        task_id: task.taskId,
        picked_qty: task.pickedQty,
        picker: '',
      });

      setPickWaveWithPicking((prev) =>
        prev.map((t) =>
          t.taskId === task.taskId
            ? {
                ...t,
                isConfirming: false,
                isConfirmed: true,
              }
            : t
        )
      );

      await fetchPickWave();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || '確認失敗';
      setPickWaveWithPicking((prev) =>
        prev.map((t) =>
          t.taskId === task.taskId
            ? {
                ...t,
                isConfirming: false,
                confirmError: errorMessage,
              }
            : t
        )
      );
    }
  };

  const handleCancelError = (taskId: number) => {
    setPickWaveWithPicking((prev) =>
      prev.map((t) => (t.taskId === taskId ? { ...t, confirmError: undefined } : t))
    );
  };

  const totalTasks = pickWaveWithPicking.length;
  const confirmedTasks = pickWaveWithPicking.filter((t) => t.isConfirmed).length;
  const pendingTasks = pickWaveWithPicking.filter((t) => !t.isConfirmed).length;
  const canConfirmShipment = pendingTasks === 0 && totalTasks > 0;

  const handleConfirmAllocation = async () => {
    setConfirmLoading(true);
    try {
      await fetchPickWave();
      toast.success('波次已重新整理');
    } catch (err: any) {
      const message = err.response?.data?.detail || '刷新波次失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setConfirmLoading(false);
    }
  };

  const togglePickingMode = () => {
    setIsPickingMode(!isPickingMode);
    if (!isPickingMode) {
      setPickWaveWithPicking((prev) => prev.map((t) => ({ ...t, confirmError: undefined })));
    }
  };

  const handlePickedQtyChange = (taskId: number, value: string) => {
    const numValue = parseFloat(value);
    setPickWaveWithPicking((prev) =>
      prev.map((t) =>
        t.taskId === taskId ? { ...t, pickedQty: isNaN(numValue) ? 0 : numValue } : t
      )
    );
  };

  const printPickWave = () => {
    printPickWaveDocument(pickWave, selectedSo, totalTasks);
  };

  const printPackingList = () => {
    if (!packingList) return;
    printPackingListDocument(packingList);
  };

  useEffect(() => {
    fetchSalesOrders();
    fetchPickWave();
  }, [showCancelledOrders]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await axios.get('/api/v1/customers/');
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

  const reloadCustomers = async () => {
    try {
      const response = await axios.get('/api/v1/customers/');
      setCustomers(response.data);
    } catch (err) {
      console.error('Failed to reload customers', err);
    }
  };

  const handleAddCustomer = async () => {
    setAddCustomerLoading(true);
    setAddCustomerError(null);

    if (!addCustomerCode.trim()) {
      setAddCustomerError('客戶代碼不可空白');
      setAddCustomerLoading(false);
      return;
    }
    if (!addCustomerName.trim()) {
      setAddCustomerError('客戶名稱不可空白');
      setAddCustomerLoading(false);
      return;
    }

    try {
      const res = await axios.post('/api/v1/customers/', {
        customer_code: addCustomerCode.trim(),
        customer_name: addCustomerName.trim(),
        is_active: true,
      });

      await reloadCustomers();

      const newCustomer: Customer = res.data;
      setCustomerId(newCustomer.customer_id);

      setAddCustomerCode('');
      setAddCustomerName('');
      setShowAddCustomerForm(false);
    } catch (err: any) {
      const detail = err.response?.data?.detail || '新增客戶失敗';
      setAddCustomerError(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setAddCustomerLoading(false);
    }
  };

  const openEditOrderDialog = (order: SalesOrderItem) => {
    setEditOrder(order);
    setEditOrderCustomerId(order.customerId ?? '');
    setEditOrderStrategy(String(order.strategy).toUpperCase() === 'FEFO' ? 'FEFO' : 'FIFO');
  };

  const handleUpdateOrder = async () => {
    if (!editOrder) return;
    if (!editOrderCustomerId) {
      toast.error('請選擇客戶');
      return;
    }
    try {
      await axios.patch(`/api/v1/picking/orders/${editOrder.soId}`, {
        customerId: Number(editOrderCustomerId),
        ...(String(editOrder.status).toUpperCase() === 'OPEN' ? { strategy: editOrderStrategy } : {}),
      });
      toast.success('銷售訂單已更新');
      setEditOrder(null);
      await fetchSalesOrders();
    } catch (err: any) {
      const message = err.response?.data?.detail || '更新銷售訂單失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrder) return;
    try {
      await axios.post(`/api/v1/picking/orders/${cancelOrder.soId}/cancel`);
      toast.success(`訂單 ${cancelOrder.soNumber} 已作廢`);
      if (selectedSo === cancelOrder.soNumber) {
        setSelectedSo(null);
        setAllocation(null);
      }
      setCancelOrder(null);
      await fetchSalesOrders();
      await fetchPickWave();
    } catch (err: any) {
      const message = err.response?.data?.detail || '作廢銷售訂單失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handleCancelTask = async () => {
    if (!cancelTask) return;
    try {
      await axios.post(`/api/v1/picking/tasks/${cancelTask.taskId}/cancel`);
      toast.success(`任務 #${cancelTask.taskId} 已取消`);
      setCancelTask(null);
      await fetchPickWave();
    } catch (err: any) {
      const message = err.response?.data?.detail || '取消任務失敗';
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    }
  };

  const handleCreateSO = async () => {
    setCreateLoading(true);

    try {
      const lines = orderLines.filter((line) => line.internalSku && line.orderedQty > 0);

      if (lines.length === 0) {
        toast.error('請至少新增一筆明細');
        setCreateLoading(false);
        return;
      }

      await axios.post('/api/v1/picking/orders', {
        soNumber: soNumber.trim(),
        customerId: customerId === '' ? null : customerId,
        strategy: strategy,
        lines: lines.map((line) => ({
          internalSku: line.internalSku,
          orderedQty: line.orderedQty,
        })),
      });

      toast.success('訂單建立成功');
      setSoNumber('');
      setCustomerId('');
      setStrategy('FIFO');
      setOrderLines([{ internalSku: '', orderedQty: 1 }]);
      setShowCreateDialog(false);

      await fetchSalesOrders();
    } catch (err: any) {
      const detail = err.response?.data?.detail || '建立訂單失敗';
      toast.error(Array.isArray(detail) ? detail.join(', ') : String(detail));
    } finally {
      setCreateLoading(false);
    }
  };

  const addOrderLine = () => {
    setOrderLines([...orderLines, { internalSku: '', orderedQty: 1 }]);
  };

  const removeOrderLine = (index: number) => {
    if (orderLines.length > 1) {
      const newLines = [...orderLines];
      newLines.splice(index, 1);
      setOrderLines(newLines);
    }
  };

  const updateOrderLine = (
    index: number,
    field: 'internalSku' | 'orderedQty',
    value: string | number
  ) => {
    const newLines = [...orderLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setOrderLines(newLines);
  };

  const handlePickScan = () => {
    const barcode = pickBarcode.trim();
    if (!barcode) return;
    const task = pickWaveWithPicking.find(
      (candidate) => !candidate.isConfirmed && candidate.internalBarcode === barcode
    );
    if (!task) {
      toast.error('條碼不屬於目前待揀任務，請確認批次');
      notifyScanResult('error');
      setPickBarcode('');
      requestAnimationFrame(() => pickScanRef.current?.focus());
      return;
    }
    notifyScanResult('success');
    setPickBarcode('');
    void handleConfirmTask(task).finally(() => pickScanRef.current?.focus());
  };

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <SalesOrdersSection
        salesOrders={salesOrders}
        selectedSo={selectedSo}
        showCancelledOrders={showCancelledOrders}
        setShowCancelledOrders={setShowCancelledOrders}
        isAdmin={isAdmin}
        onSelectOrder={(so) => {
          setSelectedSo(so);
          handleAllocate(so);
        }}
        onOpenCreate={() => setShowCreateDialog(true)}
        onEditOrder={openEditOrderDialog}
        onCancelOrder={setCancelOrder}
      />

      <AllocationSection
        allocation={allocation}
        loading={loading}
        error={error}
        confirmLoading={confirmLoading}
        onConfirmAllocation={handleConfirmAllocation}
      />

      <PickWaveSection
        pickWave={pickWave}
        pickWaveWithPicking={pickWaveWithPicking}
        isPickingMode={isPickingMode}
        isAdmin={isAdmin}
        pickBarcode={pickBarcode}
        setPickBarcode={setPickBarcode}
        pickScanRef={pickScanRef}
        totalTasks={totalTasks}
        confirmedTasks={confirmedTasks}
        pendingTasks={pendingTasks}
        canConfirmShipment={canConfirmShipment}
        confirmLoading={confirmLoading}
        onPrintPickWave={printPickWave}
        onTogglePickingMode={togglePickingMode}
        onPickScan={handlePickScan}
        onConfirmShipment={handleConfirmShipment}
        onPickedQtyChange={handlePickedQtyChange}
        onConfirmTask={handleConfirmTask}
        onCancelError={handleCancelError}
        onCancelTask={setCancelTask}
      />

      {packingList && (
        <PackingListSection packingList={packingList} onPrintPackingList={printPackingList} />
      )}

      {showCreateDialog && (
        <CreateSODialog
          soNumber={soNumber}
          setSoNumber={setSoNumber}
          customerId={customerId}
          setCustomerId={setCustomerId}
          strategy={strategy}
          setStrategy={setStrategy}
          orderLines={orderLines}
          customers={customers}
          items={items}
          createLoading={createLoading}
          showAddCustomerForm={showAddCustomerForm}
          setShowAddCustomerForm={setShowAddCustomerForm}
          addCustomerCode={addCustomerCode}
          setAddCustomerCode={setAddCustomerCode}
          addCustomerName={addCustomerName}
          setAddCustomerName={setAddCustomerName}
          addCustomerLoading={addCustomerLoading}
          addCustomerError={addCustomerError}
          setAddCustomerError={setAddCustomerError}
          onClose={() => setShowCreateDialog(false)}
          onAddCustomer={handleAddCustomer}
          onCreateSO={handleCreateSO}
          onAddOrderLine={addOrderLine}
          onRemoveOrderLine={removeOrderLine}
          onUpdateOrderLine={updateOrderLine}
        />
      )}

      <EditOrderDialog
        editOrder={editOrder}
        setEditOrder={setEditOrder}
        editOrderCustomerId={editOrderCustomerId}
        setEditOrderCustomerId={setEditOrderCustomerId}
        editOrderStrategy={editOrderStrategy}
        setEditOrderStrategy={setEditOrderStrategy}
        customers={customers}
        onUpdateOrder={handleUpdateOrder}
      />

      <CancelOrderDialog
        cancelOrder={cancelOrder}
        setCancelOrder={setCancelOrder}
        onCancelOrder={handleCancelOrder}
      />

      <CancelTaskDialog
        cancelTask={cancelTask}
        setCancelTask={setCancelTask}
        onCancelTask={handleCancelTask}
      />
    </div>
  );
}
