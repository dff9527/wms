import axios from 'axios';
import type { ReceivingItem, ReceivingItemApiRaw, ReceivingListResponse } from '../types/receiving';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function normalizeStatus(s: string): ReceivingItem['lotStatus'] {
  const upper = String(s || '').toUpperCase();
  if (upper === 'PENDING_RECEIVE' || upper === 'PENDING') return 'PENDING_RECEIVE';
  if (upper === 'QC_HOLD' || upper === 'IQC') return 'QC_HOLD';
  if (upper === 'QUARANTINE') return 'QUARANTINE';
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
    iqcResult: raw.iqc_result as ReceivingItem['iqcResult'] | undefined,
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
  const response = await axios.post<ProcessReceiptResponse>(`${API_BASE_URL}/api/v1/receiving/receive`, request);
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
  labelUrl: string;
}> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/receiving/print-label`, { lot_id: lotId });
  return response.data;
}
