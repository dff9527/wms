// frontend/src/api/receiving.ts

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * 收貨 API 客戶端
 * 
 * 完整支援三層識別碼架構
 */

// TypeScript 型別定義
export interface ReceivingItem {
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
  lotStatus: 'QC_HOLD' | 'AVAILABLE' | 'QUARANTINE';
  receiveDate: string;
  locationCode?: string;
  
  // IQC 資訊
  iqcResult?: 'PASS' | 'FAIL' | 'PENDING';
  iqcDate?: string;
  iqcInspector?: string;
  qualityNotes?: string;
}

export interface ReceivingListResponse {
  items: ReceivingItem[];
  total: number;
}

export interface ScanBarcodeRequest {
  barcode: string;
  vendorId?: number;
}

export interface ScanBarcodeResponse {
  success: boolean;
  parsed: {
    vendorPn: string;
    qty: number;
    lotCode: string;
    dateCode?: string;
  };
  patternUsed: string;
}

export interface ProcessReceiptRequest {
  poNumber: string;
  scannedBarcode: string;
  quantity: number;
}

export interface ProcessReceiptResponse {
  success: boolean;
  lotId: number;
  internalLotNumber: string;
  internalBarcode: string;
  labelUrl: string;
}

export interface CompleteIQCRequest {
  lotId: number;
  result: 'PASS' | 'FAIL';
  inspector: string;
  notes?: string;
}

// API 函式

/**
 * 取得收貨清單
 */
export async function getReceivingList(params?: {
  poNumber?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ReceivingListResponse> {
  const response = await axios.get(`${API_BASE_URL}/api/v1/receiving/list`, {
    params
  });
  return response.data;
}

/**
 * 取得單一批次詳情
 */
export async function getReceivingDetail(lotId: number): Promise<ReceivingItem> {
  const response = await axios.get(`${API_BASE_URL}/api/v1/receiving/${lotId}`);
  return response.data;
}

/**
 * 掃描條碼 (預覽解析結果)
 */
export async function scanBarcode(request: ScanBarcodeRequest): Promise<ScanBarcodeResponse> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/receiving/scan`, request);
  return response.data;
}

/**
 * 執行收貨
 */
export async function processReceipt(request: ProcessReceiptRequest): Promise<ProcessReceiptResponse> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/receiving/receive`, request);
  return response.data;
}

/**
 * 完成 IQC 檢驗
 */
export async function completeIQC(request: CompleteIQCRequest): Promise<{
  success: boolean;
  status: string;
  suggestedLocation?: string;
}> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/receiving/iqc`, request);
  return response.data;
}

/**
 * 列印標籤
 */
export async function printLabel(lotId: number): Promise<{
  success: boolean;
  labelUrl: string;
}> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/receiving/print-label`, {
    lotId
  });
  return response.data;
}

// React Query Hooks (可選)

/**
 * 使用 React Query 的範例
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useReceivingList(params?: {
  poNumber?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['receiving-list', params],
    queryFn: () => getReceivingList(params)
  });
}

export function useReceivingDetail(lotId: number) {
  return useQuery({
    queryKey: ['receiving-detail', lotId],
    queryFn: () => getReceivingDetail(lotId),
    enabled: lotId > 0
  });
}

export function useProcessReceipt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: processReceipt,
    onSuccess: () => {
      // 刷新收貨清單
      queryClient.invalidateQueries({ queryKey: ['receiving-list'] });
    }
  });
}

export function useCompleteIQC() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: completeIQC,
    onSuccess: (data, variables) => {
      // 刷新該批次詳情
      queryClient.invalidateQueries({ 
        queryKey: ['receiving-detail', variables.lotId] 
      });
      // 刷新收貨清單
      queryClient.invalidateQueries({ queryKey: ['receiving-list'] });
    }
  });
}
