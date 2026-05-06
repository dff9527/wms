// frontend/src/components/receiving/ReceivingList.tsx

import React from 'react';
import { Package, Check, Clock, AlertCircle } from 'lucide-react';

/**
 * 收貨清單元件
 * 
 * 功能:
 * 1. 顯示三層識別碼 (SKU + Lot Number + Barcode)
 * 2. 顯示供應商追溯資訊
 * 3. 狀態顏色標籤
 * 4. 詳情查看
 */

interface ReceivingItem {
  lotId: number;
  poNumber: string;
  vendorName: string;
  
  // 三層識別碼
  internalSku: string;
  internalLotNumber: string;
  internalBarcode: string;
  
  // 供應商追溯
  vendorPn: string;
  vendorLotCode: string;
  vendorDateCode?: string;
  
  quantityOnHand: number;
  unit: string;
  lotStatus: 'QC_HOLD' | 'AVAILABLE' | 'QUARANTINE';
  receiveDate: string;
}

interface ReceivingListProps {
  items: ReceivingItem[];
  onViewDetails: (lotId: number) => void;
}

export default function ReceivingList({ items, onViewDetails }: ReceivingListProps) {
  
  // 狀態標籤樣式
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'QC_HOLD': {
        label: 'IQC檢驗中',
        className: 'bg-yellow-100 text-yellow-800',
        icon: <Clock className="w-4 h-4" />
      },
      'AVAILABLE': {
        label: '已完成',
        className: 'bg-green-100 text-green-800',
        icon: <Check className="w-4 h-4" />
      },
      'QUARANTINE': {
        label: '隔離區',
        className: 'bg-red-100 text-red-800',
        icon: <AlertCircle className="w-4 h-4" />
      }
    };
    
    const config = statusConfig[status] || statusConfig['QC_HOLD'];
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                採購單號
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                供應商
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                內部料號
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                內部批號
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                內部條碼
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                供應商批號
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                數量
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                狀態
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.lotId} className="hover:bg-gray-50">
                {/* 採購單號 */}
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {item.poNumber}
                </td>
                
                {/* 供應商 */}
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {item.vendorName}
                </td>
                
                {/* 內部料號 */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {item.internalSku}
                  </div>
                </td>
                
                {/* 內部批號 */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-blue-600">
                    {item.internalLotNumber}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.receiveDate).toLocaleDateString('zh-TW')}
                  </div>
                </td>
                
                {/* 內部條碼 */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                    {item.internalBarcode}
                  </div>
                </td>
                
                {/* 供應商批號 */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="font-mono text-sm text-gray-600">
                    {item.vendorLotCode}
                  </div>
                  {item.vendorDateCode && (
                    <div className="text-xs text-gray-400">
                      DC: {item.vendorDateCode}
                    </div>
                  )}
                </td>
                
                {/* 數量 */}
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <div className="font-semibold">
                    {item.quantityOnHand.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {item.unit}
                  </div>
                </td>
                
                {/* 狀態 */}
                <td className="px-4 py-4 whitespace-nowrap">
                  {getStatusBadge(item.lotStatus)}
                </td>
                
                {/* 操作 */}
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => onViewDetails(item.lotId)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    詳情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 空狀態 */}
      {items.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            暫無收貨記錄
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            等待掃描條碼...
          </p>
        </div>
      )}
    </div>
  );
}
