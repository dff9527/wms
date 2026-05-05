import { useState } from 'react';
import { Search, ArrowRight, Package, TruckIcon, Factory, Building2, ChevronRight } from 'lucide-react';

export default function TraceabilityModule() {
  const [searchBarcode, setSearchBarcode] = useState('');
  const [traceResult, setTraceResult] = useState<any>(null);

  const handleSearch = () => {
    if (!searchBarcode) return;

    // Simulate trace result
    setTraceResult({
      barcode: searchBarcode,
      type: 'internal',
      forwardTrace: {
        supplier: {
          name: 'Texas Instruments',
          lot: 'TI2024W15A',
          dateCode: '2024W15',
          receiveDate: '2024-04-15',
          poNumber: 'PO-2024-0501',
          qty: 5000,
        },
        receiving: {
          date: '2024-04-15',
          inspector: '王小明',
          iqcResult: '合格',
          internalLot: 'LOT-A1234',
        },
        inventory: {
          location: 'A-01-02-03',
          currentQty: 3850,
          reservedQty: 150,
        },
        shipments: [
          {
            soNumber: 'SO-2024-0301',
            customer: '台積電',
            shipDate: '2024-04-20',
            qty: 500,
            status: 'delivered',
          },
          {
            soNumber: 'SO-2024-0315',
            customer: '聯發科',
            shipDate: '2024-04-28',
            qty: 300,
            status: 'delivered',
          },
          {
            soNumber: 'SO-2024-0342',
            customer: '台積電',
            shipDate: '2024-05-05',
            qty: 200,
            status: 'pending',
          },
        ],
      },
    });
  };

  const traceTimeline = [
    {
      step: 1,
      title: '供應商出貨',
      date: '2024-04-10',
      icon: Factory,
      color: 'bg-purple-500',
      details: [
        { label: '供應商', value: 'Texas Instruments' },
        { label: '供應商批號', value: 'TI2024W15A' },
        { label: '出貨數量', value: '5,000 PCS' },
      ],
    },
    {
      step: 2,
      title: '收貨入庫',
      date: '2024-04-15',
      icon: Package,
      color: 'bg-blue-500',
      details: [
        { label: 'PO 單號', value: 'PO-2024-0501' },
        { label: 'IQC 檢驗', value: '合格' },
        { label: '內部批號', value: 'LOT-A1234' },
        { label: '上架儲位', value: 'A-01-02-03' },
      ],
    },
    {
      step: 3,
      title: '揀貨出庫 #1',
      date: '2024-04-20',
      icon: TruckIcon,
      color: 'bg-green-500',
      details: [
        { label: 'SO 單號', value: 'SO-2024-0301' },
        { label: '客戶', value: '台積電' },
        { label: '出貨數量', value: '500 PCS' },
      ],
    },
    {
      step: 4,
      title: '揀貨出庫 #2',
      date: '2024-04-28',
      icon: TruckIcon,
      color: 'bg-green-500',
      details: [
        { label: 'SO 單號', value: 'SO-2024-0315' },
        { label: '客戶', value: '聯發科' },
        { label: '出貨數量', value: '300 PCS' },
      ],
    },
    {
      step: 5,
      title: '揀貨出庫 #3',
      date: '2024-05-05',
      icon: Building2,
      color: 'bg-yellow-500',
      details: [
        { label: 'SO 單號', value: 'SO-2024-0342' },
        { label: '客戶', value: '台積電' },
        { label: '出貨數量', value: '200 PCS' },
        { label: '狀態', value: '待出貨' },
      ],
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Search className="size-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">批次追溯查詢</h2>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="輸入內部批號、供應商批號或條碼進行追溯..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            查詢追溯
          </button>
        </div>

        <div className="mt-4 flex gap-4 text-sm">
          <button
            onClick={() => setSearchBarcode('LOT-A1234')}
            className="px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
          >
            範例: LOT-A1234 (內部批號)
          </button>
          <button
            onClick={() => setSearchBarcode('TI2024W15A')}
            className="px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
          >
            範例: TI2024W15A (供應商批號)
          </button>
        </div>
      </div>

      {/* Trace Result Summary */}
      {traceResult && (
        <>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">追溯摘要</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">供應商</p>
                <p className="text-lg font-semibold text-slate-900">{traceResult.forwardTrace.supplier.name}</p>
                <p className="text-xs text-slate-500 mt-1">批號: {traceResult.forwardTrace.supplier.lot}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">內部批號</p>
                <p className="text-lg font-mono font-semibold text-slate-900">
                  {traceResult.forwardTrace.receiving.internalLot}
                </p>
                <p className="text-xs text-slate-500 mt-1">儲位: {traceResult.forwardTrace.inventory.location}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">庫存狀況</p>
                <p className="text-lg font-semibold text-green-600">
                  {traceResult.forwardTrace.inventory.currentQty.toLocaleString()} PCS
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  預留: {traceResult.forwardTrace.inventory.reservedQty} PCS
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">出貨次數</p>
                <p className="text-lg font-semibold text-slate-900">{traceResult.forwardTrace.shipments.length} 次</p>
                <p className="text-xs text-slate-500 mt-1">
                  總計:{' '}
                  {traceResult.forwardTrace.shipments.reduce((sum: number, s: any) => sum + s.qty, 0).toLocaleString()}{' '}
                  PCS
                </p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">完整追溯鏈</h3>

            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200"></div>

              <div className="space-y-8">
                {traceTimeline.map((item, idx) => (
                  <div key={idx} className="relative flex gap-6">
                    {/* Timeline Icon */}
                    <div className="relative z-10">
                      <div className={`size-16 ${item.color} rounded-full flex items-center justify-center shadow-lg`}>
                        <item.icon className="size-8 text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-8">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-base font-semibold text-slate-900">{item.title}</h4>
                            <p className="text-sm text-slate-600 mt-1">{item.date}</p>
                          </div>
                          <span className="text-xs font-mono text-slate-500">Step {item.step}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {item.details.map((detail, detailIdx) => (
                            <div key={detailIdx} className="flex items-start gap-2">
                              <ChevronRight className="size-4 text-slate-400 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-xs text-slate-500">{detail.label}</p>
                                <p className="text-sm font-medium text-slate-900 truncate">{detail.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shipment Details */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">出貨記錄明細</h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">SO 單號</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">客戶</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">出貨日期</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">數量</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {traceResult.forwardTrace.shipments.map((shipment: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm font-mono text-slate-900">{shipment.soNumber}</td>
                      <td className="py-3 px-4 text-sm text-slate-700">{shipment.customer}</td>
                      <td className="py-3 px-4 text-sm text-slate-700">{shipment.shipDate}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-slate-900">
                        {shipment.qty.toLocaleString()} PCS
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            shipment.status === 'delivered'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {shipment.status === 'delivered' ? '已送達' : '待出貨'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!traceResult && (
        <div className="bg-white rounded-lg border border-slate-200 p-12">
          <div className="flex flex-col items-center justify-center text-slate-400">
            <Search className="size-16 mb-4" />
            <p className="text-lg font-medium text-slate-600 mb-2">輸入批號或條碼開始追溯</p>
            <p className="text-sm text-slate-500">支援正向追溯 (供應商→客戶) 與逆向追溯 (內部碼→原廠碼)</p>
          </div>
        </div>
      )}
    </div>
  );
}
