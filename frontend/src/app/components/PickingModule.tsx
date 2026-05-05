import { useState } from 'react';
import { TruckIcon, CheckCircle, Clock, ArrowRight, Package, MapPin, Calendar } from 'lucide-react';

export default function PickingModule() {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

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

  const pickWave = [
    {
      sequence: 1,
      location: 'A-01-02-03',
      sku: 'IC-7805',
      lotNumber: 'LOT-A1234',
      pickQty: 1000,
      receiveDate: '2024-03-10',
      expiryDate: '2024-12-10',
      status: 'pending',
      soNumber: 'SO-2024-0342',
    },
    {
      sequence: 2,
      location: 'A-01-02-04',
      sku: 'IC-7805',
      lotNumber: 'LOT-D3456',
      pickQty: 500,
      receiveDate: '2024-04-15',
      expiryDate: '2025-04-15',
      status: 'completed',
      soNumber: 'SO-2024-0342',
    },
    {
      sequence: 3,
      location: 'A-01-03-01',
      sku: 'IC-LM358',
      lotNumber: 'LOT-B5678',
      pickQty: 2500,
      receiveDate: '2024-04-20',
      expiryDate: '2025-04-20',
      status: 'in_progress',
      soNumber: 'SO-2024-0342',
    },
  ];

  const fifoAllocation = {
    soNumber: 'SO-2024-0342',
    sku: 'IC-7805',
    requestedQty: 1500,
    strategy: 'FIFO',
    allocatedQty: 1500,
    details: [
      {
        lot: 'LOT-A1234',
        qty: 1000,
        receiveDate: '2024-03-10',
        location: 'A-01-02-03',
        rank: 1,
      },
      {
        lot: 'LOT-D3456',
        qty: 500,
        receiveDate: '2024-04-15',
        location: 'A-01-02-04',
        rank: 2,
      },
    ],
  };

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
      {/* Sales Orders List */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">銷售訂單</h2>
            <p className="text-sm text-slate-500 mt-1">等待配貨與揀貨的訂單</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            + 新增訂單
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {salesOrders.map((order) => (
            <div
              key={order.soNumber}
              className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedOrder(order)}
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
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                  {order.fifoStrategy}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FIFO Allocation Result */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <ArrowRight className="size-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">FIFO 配貨結果</h2>
            <p className="text-sm text-slate-500">
              訂單: {fifoAllocation.soNumber} | 料號: {fifoAllocation.sku} | 策略: {fifoAllocation.strategy}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">需求數量</p>
              <p className="text-2xl font-bold text-slate-900">{fifoAllocation.requestedQty.toLocaleString()} PCS</p>
            </div>
            <ArrowRight className="size-8 text-slate-400" />
            <div>
              <p className="text-sm text-slate-600">配貨數量</p>
              <p className="text-2xl font-bold text-green-600">{fifoAllocation.allocatedQty.toLocaleString()} PCS</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {fifoAllocation.details.map((detail, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center justify-center size-8 bg-blue-100 text-blue-700 rounded-full font-bold text-sm">
                {detail.rank}
              </div>
              <div className="flex-1 grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">批號</p>
                  <p className="text-sm font-mono font-semibold text-slate-900">{detail.lot}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">配貨數量</p>
                  <p className="text-sm font-bold text-green-600">{detail.qty.toLocaleString()} PCS</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">收貨日期</p>
                  <p className="text-sm text-slate-700">{detail.receiveDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">儲位</p>
                  <p className="text-sm font-mono text-blue-600">{detail.location}</p>
                </div>
              </div>
              <CheckCircle className="size-5 text-green-600" />
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              ✓ 依據 <span className="font-semibold">{fifoAllocation.strategy}</span> 策略自動分配
              {fifoAllocation.strategy === 'FIFO' && ' (最早收貨優先)'}
              {fifoAllocation.strategy === 'FEFO' && ' (最早到期優先)'}
            </p>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              確認配貨
            </button>
          </div>
        </div>
      </div>

      {/* Pick Wave */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">揀貨波次</h2>
            <p className="text-sm text-slate-500">已依儲位路徑優化排序</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
              列印揀貨單
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              開始揀貨
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">序號</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">儲位</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">料號</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">批號</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">揀貨量</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">收貨日期</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">狀態</th>
              </tr>
            </thead>
            <tbody>
              {pickWave.map((task) => (
                <tr key={task.sequence} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center justify-center size-7 bg-blue-100 text-blue-700 rounded-full font-bold text-sm">
                      {task.sequence}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-blue-600" />
                      <span className="text-sm font-mono font-semibold text-blue-600">{task.location}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-900">{task.sku}</td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-700">{task.lotNumber}</td>
                  <td className="py-3 px-4 text-sm text-right font-semibold text-slate-900">
                    {task.pickQty.toLocaleString()} PCS
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-sm text-slate-700">
                      <Calendar className="size-3 text-slate-500" />
                      {task.receiveDate}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(task.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="size-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs">ⓘ</span>
            </div>
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">路徑優化提示</p>
              <p className="text-blue-700">
                揀貨路徑已依儲位編號排序 (A-01 → A-02 → B-01),減少行走距離。
                預計完成時間: <span className="font-semibold">約 15 分鐘</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
