import { useState } from 'react';
import { Search, MapPin, Package2, Filter, Calendar, AlertCircle } from 'lucide-react';

export default function InventoryModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLot, setSelectedLot] = useState<any>(null);

  const inventoryData = [
    {
      id: 1,
      sku: 'IC-7805',
      description: '5V 穩壓 IC',
      lotNumber: 'LOT-A1234',
      vendorLot: 'TI2024W15A',
      vendor: 'Texas Instruments',
      location: 'A-01-02-03',
      qtyOnHand: 4850,
      qtyReserved: 150,
      receiveDate: '2024-04-15',
      expiryDate: '2025-04-15',
      mslLevel: 3,
      status: 'available'
    },
    {
      id: 2,
      sku: 'IC-LM358',
      description: '雙運算放大器',
      lotNumber: 'LOT-B5678',
      vendorLot: 'ST2024042',
      vendor: 'STMicroelectronics',
      location: 'A-01-03-01',
      qtyOnHand: 2500,
      qtyReserved: 500,
      receiveDate: '2024-04-20',
      expiryDate: '2025-04-20',
      mslLevel: 2,
      status: 'available'
    },
    {
      id: 3,
      sku: 'IC-2N2222',
      description: 'NPN 電晶體',
      lotNumber: 'LOT-C9012',
      vendorLot: 'ON240501',
      vendor: 'ON Semiconductor',
      location: 'B-02-01-04',
      qtyOnHand: 9500,
      qtyReserved: 0,
      receiveDate: '2024-05-01',
      expiryDate: null,
      mslLevel: 1,
      status: 'available'
    },
    {
      id: 4,
      sku: 'IC-7805',
      description: '5V 穩壓 IC',
      lotNumber: 'LOT-D3456',
      vendorLot: 'TI2024W10B',
      vendor: 'Texas Instruments',
      location: 'A-01-02-04',
      qtyOnHand: 3200,
      qtyReserved: 0,
      receiveDate: '2024-03-10',
      expiryDate: '2024-12-10',
      mslLevel: 3,
      status: 'expiring_soon'
    },
  ];

  const locationMap = [
    { zone: 'A區', aisles: 3, racks: 45, occupancy: 78, color: 'bg-blue-500' },
    { zone: 'B區', aisles: 2, racks: 30, occupancy: 62, color: 'bg-green-500' },
    { zone: 'C區', aisles: 2, racks: 25, occupancy: 45, color: 'bg-yellow-500' },
    { zone: 'D區', aisles: 1, racks: 15, occupancy: 34, color: 'bg-purple-500' },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { label: '可用', className: 'bg-green-100 text-green-700' },
      reserved: { label: '已預留', className: 'bg-blue-100 text-blue-700' },
      expiring_soon: { label: '即將到期', className: 'bg-yellow-100 text-yellow-700' },
      quarantine: { label: '隔離', className: 'bg-red-100 text-red-700' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available;
    return <span className={`px-2 py-1 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋料號、批號、儲位..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
            <Filter className="size-4" />
            進階篩選
          </button>
        </div>
      </div>

      {/* Location Map Overview */}
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
                <div
                  className={`h-full ${zone.color} transition-all`}
                  style={{ width: `${zone.occupancy}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">庫存明細 (Lot 級別)</h2>
          <p className="text-sm text-slate-500 mt-1">總計 {inventoryData.length} 個批次</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">料號</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">內部批號</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">供應商批號</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">儲位</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">可用量</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">預留量</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">收貨日期</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">MSL</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">狀態</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {inventoryData.map((lot) => (
                <tr
                  key={lot.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedLot(lot)}
                >
                  <td className="py-3 px-4">
                    <div className="text-sm font-mono font-medium text-slate-900">{lot.sku}</div>
                    <div className="text-xs text-slate-500">{lot.description}</div>
                  </td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-900">{lot.lotNumber}</td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-mono text-slate-700">{lot.vendorLot}</div>
                    <div className="text-xs text-slate-500">{lot.vendor}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-sm font-mono text-blue-600">
                      <MapPin className="size-3" />
                      {lot.location}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-slate-900">
                    {lot.qtyOnHand.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-slate-600">
                    {lot.qtyReserved.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-700">{lot.receiveDate}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center size-6 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      {lot.mslLevel}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(lot.status)}</td>
                  <td className="py-3 px-4 text-center">
                    <button className="text-sm text-blue-600 hover:text-blue-800">詳情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lot Details Modal */}
      {selectedLot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLot(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">批次詳情</h3>
              <button onClick={() => setSelectedLot(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600">料號</label>
                  <p className="text-lg font-mono font-semibold text-slate-900">{selectedLot.sku}</p>
                  <p className="text-sm text-slate-500">{selectedLot.description}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">供應商</label>
                  <p className="text-lg font-semibold text-slate-900">{selectedLot.vendor}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="text-sm text-slate-600">內部批號</label>
                  <p className="text-base font-mono font-medium text-slate-900">{selectedLot.lotNumber}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">供應商批號</label>
                  <p className="text-base font-mono font-medium text-slate-900">{selectedLot.vendorLot}</p>
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
