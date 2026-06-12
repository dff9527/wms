import axios from 'axios';
import type { ReceivingItem, ReceivingItemApiRaw, ReceivingListResponse } from '../types/receiving';

// 一律走相對路徑(dev 由 Vite proxy、正式由 nginx 轉發),不依賴 VITE_API_URL
const API_BASE_URL = '';

function normalizeStatus(s: string): ReceivingItem['lotStatus'] {
  const upper = String(s || '').toUpperCase();
  if (upper === 'AVAILABLE') return 'AVAILABLE';
  if (upper === 'RESERVED') return 'RESERVED';
  if (upper === 'QC_HOLD' || upper === 'IQC') return 'QC_HOLD';
  if (upper === 'QUARANTINE') return 'QUARANTINE';
  if (upper === 'EXPIRED') return 'EXPIRED';
  if (upper === 'SHIPPED') return 'SHIPPED';
  // Optional alias for legacy fallback data
  if (upper === 'PENDING_RECEIVE' || upper === 'PENDING') return 'QC_HOLD';
  return 'AVAILABLE';
}

export function mapRawToReceivingItem(raw: ReceivingItemApiRaw): ReceivingItem {
  return {
    lotId: raw.lot_id,
    poNumber: raw.po_number ?? '',
    vendorName: raw.vendor_name ?? '',
    internalSku: raw.internal_sku ?? '',
    internalLotNumber: raw.internal_lot_number ?? '',
    internalBarcode: raw.internal_barcode ?? '',
    vendorPn: raw.vendor_pn ?? '—',
    vendorLotCode: raw.vendor_lot_code ?? '—',
    vendorDateCode: raw.vendor_date_code ?? undefined,
    originalBarcode: raw.original_barcode ?? '',
    description: raw.description ?? '',
    quantityOnHand: raw.quantity_on_hand ?? 0,
    unit: raw.unit ?? 'PCS',
    lotStatus: normalizeStatus(raw.lot_status),
    receiveDate: raw.receive_date ?? '',
    locationCode: raw.location_code ?? undefined,
    iqcResult: raw.iqc_result ? String(raw.iqc_result).toUpperCase() as ReceivingItem['iqcResult'] : undefined,
    iqcDate: raw.iqc_date ?? undefined,
    iqcInspector: raw.iqc_inspector ?? undefined,
    qualityNotes: raw.quality_notes ?? undefined,
   };
}

export interface ScanBarcodeRequest {
  barcode: string;
  vendorId?: number;
}

export interface ScanBarcodeResponse {
  success: boolean;
  parsed?: {
    vendorPn: string;
    qty: number;
    lotCode: string;
    dateCode?: string;
   };
  patternUsed?: string;
}

export interface ProcessReceiptRequest {
  poNumber: string;
  barcode: string;
  vendorId: number;
  qty: number;
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

export async function getReceivingList(params?: {
  poNumber?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ReceivingListResponse> {
  const response = await axios.get<{ items: ReceivingItemApiRaw[]; total: number }>(`${API_BASE_URL}/api/v1/receiving/list`, {
    params: {
      po_number: params?.poNumber,
      status: params?.status,
      page: params?.page,
      page_size: params?.pageSize,
     },
   });
  const { items, total } = response.data;
  return {
    items: items.map(mapRawToReceivingItem),
    total: total ?? items.length,
   };
}

export async function getReceivingDetail(lotId: number): Promise<ReceivingItem> {
  const response = await axios.get<ReceivingItemApiRaw>(`${API_BASE_URL}/api/v1/receiving/${lotId}`);
  return mapRawToReceivingItem(response.data);
}

export async function scanBarcode(request: ScanBarcodeRequest): Promise<ScanBarcodeResponse> {
  const response = await axios.post<ScanBarcodeResponse>(`${API_BASE_URL}/api/v1/receiving/scan`, request);
  return response.data;
}

export async function processReceipt(request: ProcessReceiptRequest): Promise<ProcessReceiptResponse> {
  const response = await axios.post<ProcessReceiptResponse>(`${API_BASE_URL}/api/v1/receiving/receive`, {
    po_number: request.poNumber,
    barcode: request.barcode,
    vendor_id: request.vendorId,
    qty: request.qty,
  });
  return response.data;
}

export async function completeIQC(request: CompleteIQCRequest): Promise<{
  success: boolean;
  status: string;
  suggestedLocation?: string;
}> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/receiving/iqc`, request);
  return response.data;
}

export async function printLabel(lotId: number): Promise<{
  success: boolean;
  zpl: string;
  printed: boolean;
}> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/receiving/print-label`, { lot_id: lotId });
  return response.data;
}

// ==================== Purchase Order APIs ====================

export interface POItem {
  poNumber: string;
  vendorId: number;
  vendorName: string;
  poDate: string;
  status: string;
  lines: Array<{
    lineNumber: number;
    internalSku: string;
    vendorPn: string;
    orderedQty: number;
    receivedQty: number;
  }>;
}

export async function listPOs(): Promise<POItem[]> {
  const response = await axios.get<{ items?: POItem[] }>(`${API_BASE_URL}/api/v1/purchase-orders`);
  return Array.isArray(response.data) ? response.data : (response.data.items || []);
}

export interface ItemOption {
  internalSku: string;
  description: string;
}

export async function listItems(): Promise<ItemOption[]> {
  const response = await axios.get<{ items?: ItemOption[] }>(
    `${API_BASE_URL}/api/v1/purchase-orders/items`
  );
  return Array.isArray(response.data) ? response.data : (response.data.items || []);
}

export async function listOpenPOs(): Promise<string[]> {
  const response = await axios.get<{ items?: Array<{ poNumber: string; status: string }> }>(
    `${API_BASE_URL}/api/v1/purchase-orders/open-po-list`
  );
  const items = response.data.items || response.data;
  return Array.isArray(items) ? items.map((item: any) => item.poNumber) : [];
}

export interface Vendor {
  vendorId: number;
  vendorName: string;
}

export async function listVendors(): Promise<Vendor[]> {
  const response = await axios.get<{ items?: Vendor[] }>(`${API_BASE_URL}/api/v1/vendors`);
  return Array.isArray(response.data) ? response.data : (response.data.items || []);
}

export interface CreatePORequest {
  poNumber: string;
  vendorId: number;
  lines: Array<{
    internalSku: string;
    vendorPn: string;
    orderedQty: number;
  }>;
}

export interface CreatePOResponse {
  poNumber: string;
  vendorId: number;
  vendorName: string;
  poDate: string;
  status: string;
  lines: Array<{
    lineNumber: number;
    internalSku: string;
    vendorPn: string;
    orderedQty: number;
    receivedQty: number;
  }>;
}

export async function createPO(request: CreatePORequest): Promise<CreatePOResponse> {
  const response = await axios.post<CreatePOResponse>(`${API_BASE_URL}/api/v1/purchase-orders`, {
    poNumber: request.poNumber,
    vendorId: request.vendorId,
    lines: request.lines,
  });
  return response.data;
}
