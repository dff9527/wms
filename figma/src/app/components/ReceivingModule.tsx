import { useState } from 'react';
import { ScanBarcode, Package, CheckCircle2, AlertCircle, Printer, Upload } from 'lucide-react';

export default function ReceivingModule() {
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [receivingList, setReceivingList] = useState([
    { id: 1, poNumber: 'PO-2024-0501', vendor: 'Texas Instruments', sku: 'TI-7805', vendorLot: 'TI2024W15A', qty: 5000, status: 'pending' },
    { id: 2, poNumber: 'PO-2024-0502', vendor: 'STMicroelectronics', sku: 'ST-LM358', vendorLot: 'ST2024042', qty: 3000, status: 'iqc' },
    { id: 3, poNumber: 'PO-2024-0503', vendor: 'ON Semiconductor', sku: 'ON-2N2222', vendorLot: 'ON240501', qty: 10000, status: 'completed' },
  ]);

  const handleScanBarcode = () => {
    if (!scannedBarcode) return;

    // Simulate barcode parsing
    const parsed = {
      vendor: 'Texas Instruments',
      partNumber: 'TI-7805',
      lotCode: 'TI2024W15A',
      quantity: '5000',
      dateCode: '2024W15',
      mslLevel: '3',
      poNumber: 'PO-2024-0501'
    };
    setParsedData(parsed);
  };

  const handleReceive = () => {
    if (parsedData) {
      alert(`收貨成功!\n料號: ${parsedData.partNumber}\n批號: ${parsedData.lotCode}\n數量: ${parsedData.quantity} PCS`);
      setParsedData(null);
      setScannedBarcode('');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '待收貨', className: 'bg-yellow-100 text-yellow-700' },
      iqc: { label: 'IQC檢驗中', className: 'bg-blue-100 text-blue-700' },
      completed: { label: '已完成', className: 'bg-green-100 text-green-700' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <span className={`px-2 py-1 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Barcode Scanner Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <ScanBarcode className="size-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">條碼掃描與解析</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                掃描供應商條碼
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanBarcode()}
                  placeholder="請掃描或輸入條碼..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleScanBarcode}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  解析
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                支援格式: TI / ST / ON / NXP / Infineon 等主流供應商
              </p>
            </div>

            {/* Manual Input */}
            <div className="pt-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-3">手動輸入</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">採購單號</label>
                  <input type="text" placeholder="PO-2024-XXXX" className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">供應商</label>
                  <select className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500">
                    <option>選擇供應商...</option>
                    <option>Texas Instruments</option>
                    <option>STMicroelectronics</option>
                    <option>ON Semiconductor</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Parsed Result */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-3">解析結果</p>
            {parsedData ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">供應商</span>
                  <span className="text-sm font-medium text-slate-900">{parsedData.vendor}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">料號</span>
                  <span className="text-sm font-mono font-medium text-slate-900">{parsedData.partNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">批號</span>
                  <span className="text-sm font-mono font-medium text-slate-900">{parsedData.lotCode}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">數量</span>
                  <span className="text-sm font-medium text-slate-900">{parsedData.quantity} PCS</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">日期碼</span>
                  <span className="text-sm font-medium text-slate-900">{parsedData.dateCode}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm text-slate-600">MSL 等級</span>
                  <span className="text-sm font-medium text-slate-900">Level {parsedData.mslLevel}</span>
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    onClick={handleReceive}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="size-4" />
                    確認收貨
                  </button>
                  <button className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2">
                    <Printer className="size-4" />
                    列印標籤
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Package className="size-12 mb-2" />
                <p className="text-sm">等待掃描條碼...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Receiving List */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">收貨清單</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Upload className="size-4" />
            匯入採購單
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">採購單號</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">供應商</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">料號</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">批號</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">數量</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">狀態</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {receivingList.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm font-mono text-slate-900">{item.poNumber}</td>
                  <td className="py-3 px-4 text-sm text-slate-700">{item.vendor}</td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-900">{item.sku}</td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-700">{item.vendorLot}</td>
                  <td className="py-3 px-4 text-sm text-right text-slate-900">{item.qty.toLocaleString()} PCS</td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(item.status)}</td>
                  <td className="py-3 px-4 text-center">
                    <button className="text-sm text-blue-600 hover:text-blue-800">詳情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
