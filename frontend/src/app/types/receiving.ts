/**
 * 收貨／批次 API 與 UI 共用型別（對齊 CURSOR_INSTRUCTIONS.md）
 */

export type ReceivingLotStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'QC_HOLD'
  | 'QUARANTINE'
  | 'EXPIRED'
  | 'SHIPPED';

/** 對齊後端 snake_case JSON，經 api/receiving.ts 正規化成 ReceivingItem */
export interface ReceivingItemApiRaw {
  lot_id: number;
  po_number: string;
  vendor_name: string;
  internal_sku: string;
  internal_lot_number: string;
  internal_barcode: string;
  vendor_pn: string | null;
  vendor_lot_code: string | null;
  vendor_date_code?: string | null;
  original_barcode?: string | null;
  description?: string | null;
  quantity_on_hand: number;
  unit: string | null;
  lot_status: string;
  receive_date: string | null;
  location_code?: string | null;
  iqc_result?: string | null;
  iqc_date?: string | null;
  iqc_inspector?: string | null;
  quality_notes?: string | null;
}

export interface ReceivingItem {
  lotId: number;
  poNumber: string;
  vendorName: string;
  internalSku: string;
  internalLotNumber: string;
  internalBarcode: string;
  vendorPn: string;
  vendorLotCode: string;
  vendorDateCode?: string;
  originalBarcode: string;
  description: string;
  quantityOnHand: number;
  unit: string;
  lotStatus: ReceivingLotStatus;
  receiveDate: string;
  locationCode?: string;
  iqcResult?: 'PASS' | 'FAIL' | 'PENDING';
  iqcDate?: string;
  iqcInspector?: string;
  qualityNotes?: string;
}

export interface ReceivingListResponse {
  items: ReceivingItem[];
  total: number;
}
