// frontend/src/components/receiving/ReceivingDetail.tsx

import React from 'react';
import { Package, Barcode as BarcodeIcon, Tag, Calendar, MapPin, User } from 'lucide-react';
import Barcode from 'react-barcode';

/**
 * 收貨詳情元件
 * 
 * 功能:
 * 1. 左右分欄顯示內部資訊和供應商資訊
 * 2. 顯示條碼圖形
 * 3. 完整追溯鏈資訊
 */

interface ReceivingDetailProps {
  item: {
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
    originalBarcode: string;
    
    // 詳細資訊
    description: string;
    quantityOnHand: number;
    unit: string;
    lotStatus: string;
    receiveDate: string;
    locationCode?: string;
    
    // IQC 資訊
    iqcResult?: 'PASS' | 'FAIL' | 'PENDING';
    iqcDate?: string;
    iqcInspector?: string;
    qualityNotes?: string;
  };
}

export default function ReceivingDetail({ item }: ReceivingDetailProps) {
  
  // IQC 狀態標籤
  const getIQCBadge = (result?: string) => {
    if (!result) return null;
    
    const config = {
      'PASS': { label: '合格', className: 'bg-green-100 text-green-800' },
      'FAIL': { label: '不合格', className: 'bg-red-100 text-red-800' },
      'PENDING': { label: '待檢驗', className: 'bg-yellow-100 text-yellow-800' }
    };
    
    const badge = config[result] || config['PENDING'];
    
    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };
  
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* 標題區 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              批次詳情
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              採購單號: {item.poNumber}
            </p>
          </div>
          <div className="text-right">
            {getIQCBadge(item.iqcResult)}
            <p className="mt-2 text-sm text-gray-500">
              收貨時間: {new Date(item.receiveDate).toLocaleString('zh-TW')}
            </p>
          </div>
        </div>
      </div>
      
      {/* 主要資訊 - 左右分欄 */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* 左欄: 內部追溯資訊 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">
              內部追溯資訊
            </h3>
          </div>
          
          <div className="space-y-4">
            {/* 內部料號 */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Tag className="w-4 h-4" />
                內部料號 (SKU)
              </label>
              <div className="text-lg font-semibold text-gray-900">
                {item.internalSku}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {item.description}
              </div>
            </div>
            
            {/* 內部批號 */}
            <div className="border-t pt-4">
              <label className="text-sm text-gray-500 mb-1 block">
                內部批號 (Lot Number)
              </label>
              <div className="text-xl font-bold text-blue-600">
                {item.internalLotNumber}
              </div>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                收貨: {new Date(item.receiveDate).toLocaleDateString('zh-TW')}
              </div>
            </div>
            
            {/* 內部條碼 */}
            <div className="border-t pt-4">
              <label className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <BarcodeIcon className="w-4 h-4" />
                內部條碼 (Barcode)
              </label>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="font-mono text-lg text-center mb-2">
                  {item.internalBarcode}
                </div>
                {/* 條碼圖形 */}
                <div className="flex justify-center">
                  <Barcode 
                    value={item.internalBarcode}
                    width={2}
                    height={60}
                    displayValue={false}
                  />
                </div>
              </div>
            </div>
            
            {/* 儲位 */}
            {item.locationCode && (
              <div className="border-t pt-4">
                <label className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <MapPin className="w-4 h-4" />
                  儲位
                </label>
                <div className="text-lg font-semibold text-gray-900">
                  {item.locationCode}
                </div>
              </div>
            )}
            
            {/* 數量 */}
            <div className="border-t pt-4">
              <label className="text-sm text-gray-500 mb-1 block">
                庫存數量
              </label>
              <div className="text-2xl font-bold text-gray-900">
                {item.quantityOnHand.toLocaleString()} <span className="text-lg text-gray-500">{item.unit}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 右欄: 供應商追溯資訊 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-gray-900">
              供應商追溯資訊
            </h3>
          </div>
          
          <div className="space-y-4">
            {/* 供應商名稱 */}
            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                供應商名稱
              </label>
              <div className="text-lg font-semibold text-gray-900">
                {item.vendorName}
              </div>
            </div>
            
            {/* 供應商料號 */}
            <div className="border-t pt-4">
              <label className="text-sm text-gray-500 mb-1 block">
                供應商料號 (P/N)
              </label>
              <div className="font-mono text-lg text-gray-900">
                {item.vendorPn}
              </div>
            </div>
            
            {/* 供應商批號 */}
            <div className="border-t pt-4">
              <label className="text-sm text-gray-500 mb-1 block">
                供應商批號 (Lot Code)
              </label>
              <div className="font-mono text-lg font-semibold text-purple-600">
                {item.vendorLotCode}
              </div>
            </div>
            
            {/* 供應商日期碼 */}
            {item.vendorDateCode && (
              <div className="border-t pt-4">
                <label className="text-sm text-gray-500 mb-1 block">
                  供應商日期碼 (Date Code)
                </label>
                <div className="font-mono text-lg text-gray-900">
                  {item.vendorDateCode}
                </div>
              </div>
            )}
            
            {/* 原始條碼 */}
            <div className="border-t pt-4">
              <label className="text-sm text-gray-500 mb-1 block">
                原始掃描條碼
              </label>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="font-mono text-sm text-gray-700 break-all">
                  {item.originalBarcode}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                * 保留供應商原始條碼供追溯使用
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* IQC 檢驗資訊 */}
      {item.iqcResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">
              IQC 檢驗資訊
            </h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                檢驗結果
              </label>
              {getIQCBadge(item.iqcResult)}
            </div>
            
            {item.iqcDate && (
              <div>
                <label className="text-sm text-gray-500 mb-1 block">
                  檢驗時間
                </label>
                <div className="text-sm text-gray-900">
                  {new Date(item.iqcDate).toLocaleString('zh-TW')}
                </div>
              </div>
            )}
            
            {item.iqcInspector && (
              <div>
                <label className="text-sm text-gray-500 mb-1 block">
                  檢驗員
                </label>
                <div className="text-sm text-gray-900">
                  {item.iqcInspector}
                </div>
              </div>
            )}
          </div>
          
          {item.qualityNotes && (
            <div className="mt-4 border-t pt-4">
              <label className="text-sm text-gray-500 mb-1 block">
                檢驗備註
              </label>
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {item.qualityNotes}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 追溯鏈視覺化 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          追溯鏈
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="text-center">
            <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Package className="w-12 h-12 text-purple-600" />
            </div>
            <div className="text-sm font-medium text-gray-900">
              供應商
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {item.vendorName}
            </div>
            <div className="font-mono text-xs text-purple-600 mt-1">
              {item.vendorLotCode}
            </div>
          </div>
          
          <div className="flex-1 mx-4">
            <div className="border-t-2 border-dashed border-gray-300"></div>
          </div>
          
          <div className="text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <BarcodeIcon className="w-12 h-12 text-blue-600" />
            </div>
            <div className="text-sm font-medium text-gray-900">
              內部批次
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(item.receiveDate).toLocaleDateString('zh-TW')}
            </div>
            <div className="font-mono text-xs text-blue-600 mt-1">
              {item.internalLotNumber}
            </div>
          </div>
          
          <div className="flex-1 mx-4">
            <div className="border-t-2 border-dashed border-gray-300"></div>
          </div>
          
          <div className="text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <MapPin className="w-12 h-12 text-green-600" />
            </div>
            <div className="text-sm font-medium text-gray-900">
              儲位
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {item.locationCode || '待上架'}
            </div>
            <div className="font-mono text-xs text-green-600 mt-1">
              {item.lotStatus}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
