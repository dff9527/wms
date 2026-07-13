import type { PickWaveTask } from '../../types/wms-inventory';

// Customer interface matching CustomerOut (snake_case)
export interface Customer {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  approved_avl?: any;
  is_active: boolean;
}

// Item interface for dropdown
export interface Item {
  internalSku: string;
  description: string;
}

export interface SalesOrderItem {
  soId: number;
  soNumber: string;
  customerId: number | null;
  customer: string;
  orderDate: string;
  status: string;
  totalLines: number;
  totalQty: number;
  strategy: string;
}

// Task extended with picking-specific states
export interface PickWaveTaskWithPicking extends PickWaveTask {
  pickedQty: number; // The quantity picked by operator (can differ from pickQty)
  confirmError?: string; // Error message for this task
  isConfirming: boolean; // Loading state for confirmation
  isConfirmed: boolean; // Whether this task is confirmed
}

export interface PackingListLot {
  internalLotNumber: string;
  internalSku: string;
  qty: number;
  location: string | null;
  receiveDate: string;
}

export interface PackingListItem {
  sku: string;
  lots: PackingListLot[];
}

export interface PackingList {
  soNumber: string;
  items: PackingListItem[];
}

export function mapSalesOrderItem(raw: any): SalesOrderItem {
  return {
    soId: Number(raw?.soId ?? raw?.so_id ?? 0),
    soNumber: raw?.soNumber ?? raw?.so_number ?? '',
    customerId:
      raw?.customerId == null && raw?.customer_id == null
        ? null
        : Number(raw?.customerId ?? raw?.customer_id ?? 0),
    customer: raw?.customer ?? raw?.customer_name ?? '',
    orderDate: raw?.orderDate ?? raw?.order_date ?? '',
    status: raw?.status ?? '',
    totalLines: Number(raw?.totalLines ?? raw?.total_lines ?? 0),
    totalQty: Number(raw?.totalQty ?? raw?.total_qty ?? 0),
    strategy: raw?.strategy ?? 'FIFO',
  };
}
