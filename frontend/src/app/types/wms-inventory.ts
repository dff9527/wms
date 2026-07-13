/**
 * 對齊 WMS_Development_Spec.md — inventory_lots
 *
 * 【資料架構】
 * - internalSku → DB internal_sku（什麼料）
 * - internalLotNumber → DB internal_lot_number（哪一批，FIFO）
 * - internalBarcode → DB internal_barcode（掃描識別）
 * - vendorLotCode → DB vendor_lot_code（原廠追溯）
 */

export interface WmsLotIdentifiers {
  internalSku: string;
  internalLotNumber: string;
  internalBarcode: string;
  vendorLotCode: string;
}

/** ─── 收貨清單 ─── */

export type ReceivingListRowStatus = 'pending' | 'iqc' | 'completed';

export interface ReceivingListRow extends WmsLotIdentifiers {
  id: number;
  poNumber: string;
  vendor: string;
  qty: number;
  status: ReceivingListRowStatus;
}

/** ─── 庫存 Lot 列表 ─── */

export type InventoryLotRowStatus =
  | 'available'
  | 'reserved'
  | 'expiring_soon'
  | 'quarantine'
  | 'qc_hold'
  | 'expired'
  | 'shipped'
  | 'void';

export interface InventoryLotRow extends WmsLotIdentifiers {
  id: number;
  description: string;
  vendor: string;
  location: string;
  qtyOnHand: number;
  qtyReserved: number;
  receiveDate: string;
  expiryDate: string | null;
  mslLevel: number;
  status: InventoryLotRowStatus;
}

/** ─── 揀貨波次 / FIFO 配貨 ─── */

export interface PickWaveTask extends WmsLotIdentifiers {
  sequence: number;
  taskId: number;
  location: string;
  pickQty: number;
  receiveDate: string;
  expiryDate: string;
  status: string;
  soNumber: string;
}

export interface FifoAllocationDetail extends WmsLotIdentifiers {
  rank: number;
  qty: number;
  receiveDate: string;
  location: string;
}

// FIX: [fix_2] — Make internalSku optional in FifoAllocationSummary to match actual data shape returned by allocation handler
export interface FifoAllocationSummary {
  soNumber: string;
  internalSku?: string;
  requestedQty: number;
  strategy: string;
  allocatedQty: number;
  details: FifoAllocationDetail[];
}

/** ─── 追溯（正向摘要） ─── */

export interface TraceForwardSupplier {
  name: string;
  vendorLotCode: string;
  dateCode: string;
  receiveDate: string;
  poNumber: string;
  qty: number;
}

export interface TraceForwardReceiving {
  date: string;
  inspector: string;
  iqcResult: string;
  internalSku: string;
  internalLotNumber: string;
  internalBarcode: string;
}

export interface TraceForwardInventory {
  location: string;
  currentQty: number;
  reservedQty: number;
}

export interface TraceShipment {
  soNumber: string;
  customer: string;
  shipDate: string;
  qty: number;
  status: 'delivered' | 'pending';
}

export interface TraceForwardResult {
  barcode: string;
  type: 'internal_barcode' | 'internal_lot' | 'vendor_lot';
  supplier: TraceForwardSupplier;
  receiving: TraceForwardReceiving;
  inventory: TraceForwardInventory;
  shipments: TraceShipment[];
}
