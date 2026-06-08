import { useState } from 'react';
import axios from 'axios';
import { Search, Package, TruckIcon, Factory, Building2, ChevronRight } from 'lucide-react';
import type { TraceForwardResult } from '../types/wms-inventory';

export default function TraceabilityModule() {
  const [searchBarcode, setSearchBarcode] = useState('');
  const [traceResult, setTraceResult] = useState<TraceForwardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchBarcode.trim()) return;
    const trimmed = searchBarcode.trim();
    if (trimmed.length > 128) {
      setError('查詢字串過長（最多 128 字元）');
      return;
    }
    if (!/^[A-Za-z0-9\-_.]+$/.test(trimmed)) {
      setError('查詢字串包含不允許的字元');
      return;
    }
    
    // Reset stale state before new search
    setTraceResult(null);
    setLoading(true);
    setError(null);
    
    try {
      // Try forward trace first
      try {
        const response = await axios.get('/api/v1/trace/forward', { params: { query: searchBarcode } });
        if (response.data) {
          mapAndSetResult(response.data);
          return;
        }
      } catch (forwardErr: any) {
        // 404 means not found via forward — fall through to backward
        if (forwardErr.response?.status !== 404) {
          throw forwardErr;
        }
      }
      
      // Fallback: backward trace
      try {
        const backResponse = await axios.get('/api/v1/trace/backward', { params: { internal_barcode: searchBarcode } });
        if (backResponse.data) {
          const b = backResponse.data;
          // Construct a partial TraceForwardResult from backward data
          // Backward endpoint returns exactly: { internalBarcode, internalLotNumber, vendorLotCode, vendorDateCode, supplierName, originalBarcode }
          const partial: TraceForwardResult = {
            barcode: b.internalBarcode || searchBarcode,
            type: 'internal_barcode',
            supplier: {
              name: b.supplierName || '',
              vendorLotCode: b.vendorLotCode || '',
              dateCode: b.vendorDateCode || '',
              receiveDate: '',
              poNumber: '',
              qty: 0
            },
            receiving: {
              date: '',
              inspector: '',
              iqcResult: '',
              internalSku: '',
              internalLotNumber: b.internalLotNumber || '',
              internalBarcode: b.internalBarcode || ''
            },
            inventory: {
              location: '',
              currentQty: 0,
              reservedQty: 0
            },
            shipments: []
          };
          setTraceResult(partial);
          // Show informational banner, not an error
          setError('部分追溯 — 僅找到逆向批次資料，正向追溯鏈不可用');
          return;
        }
      } catch (backErr: any) {
        if (backErr.response?.status !== 404) {
          throw backErr;
        }
      }
      
      // Neither found
      setError('找不到對應的批次或條碼');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Traceability search failed');
    } finally {
      setLoading(false);
    }
  };

  const mapAndSetResult = (data: any) => {
    setTraceResult({
      barcode: data.barcode,
      type: data.type,
      supplier: {
        name: (data.supplier ?? {}).name || '',
        vendorLotCode: (data.supplier ?? {}).vendorLotCode || '',
        dateCode: (data.supplier ?? {}).dateCode || '',
        receiveDate: (data.supplier ?? {}).receiveDate || '',
        poNumber: (data.supplier ?? {}).poNumber || '',
        qty: (data.supplier ?? {}).qty ?? 0
      },
      receiving: {
        date: (data.receiving ?? {}).date || '',
        inspector: (data.receiving ?? {}).inspector || '',
        iqcResult: (data.receiving ?? {}).iqcResult || '',
        internalSku: (data.receiving ?? {}).internalSku || '',
        internalLotNumber: (data.receiving ?? {}).internalLotNumber || '',
        internalBarcode: (data.receiving ?? {}).internalBarcode || ''
      },
      inventory: {
        location: (data.inventory ?? {}).location || '',
        currentQty: (data.inventory ?? {}).currentQty ?? 0,
        reservedQty: (data.inventory ?? {}).reservedQty ?? 0
      },
      shipments: (Array.isArray(data.shipments) ? data.shipments : []).map((s: any) => ({
        soNumber: s.soNumber || '',
        customer: s.customer || '',
        shipDate: s.shipDate || '',
        qty: s.qty ?? 0,
        status: s.status || ''
      }))
    });
  };

  const traceTimeline = [
    {
      step: 1,
      title: '供應商出貨',
      date: traceResult?.supplier.receiveDate || '',
      icon: Factory,
      color: 'bg-purple-500',
      details: [
        { label: '供應商', value: traceResult?.supplier.name || '' },
        { label: '供應商批號 (vendor_lot_code)', value: traceResult?.supplier.vendorLotCode || '' },
        { label: '出貨數量', value: `${traceResult?.supplier.qty?.toLocaleString() || 0} PCS` },
      ],
    },
    {
      step: 2,
      title: '收貨入庫',
      date: traceResult?.receiving.date || '',
      icon: Package,
      color: 'bg-blue-500',
      details: [
        { label: 'PO 單號', value: traceResult?.supplier.poNumber || '' },
        { label: 'IQC 檢驗', value: traceResult?.receiving.iqcResult || '' },
        { label: '料號 (internal_sku)', value: traceResult?.receiving.internalSku || '' },
        { label: '內部批號 (internal_lot_number)', value: traceResult?.receiving.internalLotNumber || '' },
        { label: '內部條碼 (internal_barcode)', value: traceResult?.receiving.internalBarcode || '' },
        { label: '上架儲位', value: traceResult?.inventory.location || '' },
      ],
    },
  ];

  // Add shipment steps dynamically if traceResult exists
  if (traceResult) {
    traceResult.shipments.forEach((shipment, idx) => {
      const st = String(shipment.status ?? '').toUpperCase();
      traceTimeline.push({
        step: 3 + idx,
        title: `揀貨出庫 #${idx + 1}`,
        date: shipment.shipDate,
        icon: st === 'DELIVERED' ? TruckIcon : Building2,
        color: st === 'DELIVERED' ? 'bg-green-500' : 'bg-yellow-500',
        details: [
          { label: 'SO 單號', value: shipment.soNumber },
          { label: '客戶', value: shipment.customer },
          { label: '出貨數量', value: `${shipment.qty.toLocaleString()} PCS` },
          ...(st !== 'DELIVERED' ? [{ label: '狀態', value: '待出貨' }] : [])
        ],
      });
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Search className="size-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">批次追溯查詢</h2>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <input
              type="text"
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="輸入 internal_lot_number、internal_barcode 或 vendor_lot_code…"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? '查詢中...' : '查詢追溯'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className={`p-4 rounded-lg border text-sm ${
          traceResult
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {error}
        </div>
      )}

      {traceResult && !loading && (
        <>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">追溯摘要</h3>
            <p className="text-xs text-slate-600 mb-4">
              查詢鍵: <span className="font-mono">{traceResult.barcode}</span> · 類型推斷: {traceResult.type}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">供應商</p>
                <p className="text-lg font-semibold text-slate-900">{traceResult.supplier.name}</p>
                <p className="text-xs text-slate-500 mt-1 font-mono">vendor_lot_code: {traceResult.supplier.vendorLotCode}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">料號 (internal_sku)</p>
                <p className="text-lg font-mono font-semibold text-slate-900">{traceResult.receiving.internalSku}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">內部批號</p>
                <p className="text-lg font-mono font-semibold text-slate-900">{traceResult.receiving.internalLotNumber}</p>
                <p className="text-xs text-slate-500 mt-1">儲位: {traceResult.inventory.location}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">內部條碼</p>
                <p className="text-sm font-mono font-semibold text-slate-900 break-all">{traceResult.receiving.internalBarcode}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">庫存</p>
                <p className="text-lg font-semibold text-green-600">{traceResult.inventory.currentQty.toLocaleString()} PCS</p>
                <p className="text-xs text-slate-500 mt-1">預留: {traceResult.inventory.reservedQty} PCS</p>
              </div>
            </div>
            <div className="mt-4 bg-white rounded-lg p-4 border border-slate-200 flex justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-700">
                出貨次數: <span className="font-semibold">{traceResult.shipments.length}</span>
              </p>
              <p className="text-sm text-slate-700">
                累計已分配出貨量:{' '}
                <span className="font-semibold">{traceResult.shipments.reduce((sum, s) => sum + s.qty, 0).toLocaleString()} PCS</span>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">完整追溯鏈</h3>

            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200"></div>

              <div className="space-y-8">
                {traceTimeline.map((item, idx) => (
                  <div key={idx} className="relative flex gap-6">
                    <div className="relative z-10">
                      <div className={`size-16 ${item.color} rounded-full flex items-center justify-center shadow-lg`}>
                        <item.icon className="size-8 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 pb-8">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-base font-semibold text-slate-900">{item.title}</h4>
                            <p className="text-sm text-slate-600 mt-1">{item.date}</p>
                          </div>
                          <span className="text-xs font-mono text-slate-500">Step {item.step}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {item.details.map((detail, detailIdx) => (
                            <div key={detailIdx} className="flex items-start gap-2">
                              <ChevronRight className="size-4 text-slate-400 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-xs text-slate-500">{detail.label}</p>
                                <p className="text-sm font-medium text-slate-900 break-all">{detail.value}</p>
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
                  {traceResult.shipments.map((shipment, idx) => {
                    const st = String(shipment.status ?? '').toUpperCase();
                    return (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm font-mono text-slate-900">{shipment.soNumber}</td>
                        <td className="py-3 px-4 text-sm text-slate-700">{shipment.customer}</td>
                        <td className="py-3 px-4 text-sm text-slate-700">{shipment.shipDate}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-slate-900">{shipment.qty.toLocaleString()} PCS</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              st === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {st === 'DELIVERED' ? '已送達' : '待出貨'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!traceResult && !loading && (
        <div className="bg-white rounded-lg border border-slate-200 p-12">
          <div className="flex flex-col items-center justify-center text-slate-400">
            <Search className="size-16 mb-4" />
            <p className="text-lg font-medium text-slate-600 mb-2">輸入 internal_lot_number、internal_barcode 或 vendor_lot_code</p>
            <p className="text-sm text-slate-500 text-center max-w-lg">
              正向追溯（供應商→客戶）與逆向對照皆以 inventory_lots 三層識別為核心：internal_sku、internal_lot_number、internal_barcode；vendor_lot_code 對應原廠。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
