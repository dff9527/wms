import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InventoryLotRow } from '../types/wms-inventory';

// FIX: [fix_1] — Replace process.env with Vite-compatible import.meta.env to avoid TS2591 node types error
const API_BASE_URL = (import.meta.env as Record<string, string>).VITE_API_URL || '/api/v1';

// Helper to map snake_case API response to camelCase Frontend Type
function mapToInventoryLotRow(data: any): InventoryLotRow {
  return {
      // FIX: [fix_1] — Use exact field names matching InventoryLotRow type: id instead of lotId, qtyOnHand instead of quantityOnHand, qtyReserved instead of quantityReserved, location instead of locationCode, status instead of lotStatus
     // FIX: [fix_1] — Renamed vendorPn to vendor to match the actual InventoryLotRow interface field name suggested by TypeScript compiler
    id: data.lot_id,
    internalSku: data.internal_sku,
    internalBarcode: data.internal_barcode,
    internalLotNumber: data.internal_lot_number,
    vendor: data.vendor_pn,
    qtyOnHand: data.quantity_on_hand,
    qtyReserved: data.quantity_reserved,
    location: data.location_code,
    status: data.lot_status,
    expiryDate: data.expiry_date ?? null,
    // These fields are required by InventoryLotRow but not yet returned by LotOut; default until backend exposes them.
    vendorLotCode: data.vendor_lot_code ?? '',
    description: data.description ?? '',
    receiveDate: data.receive_date ?? '',
    mslLevel: data.msl_level ?? 0,
    };
}

export async function getInventoryLots(params?: {
  sku?: string;
  status?: string[];
  location?: string;
  vendor?: number;
}): Promise<InventoryLotRow[]> {
  const queryParams = new URLSearchParams();
  if (params?.sku) queryParams.append('sku', params.sku);
  if (params?.status) params.status.forEach(s => queryParams.append('status', s));
  if (params?.location) queryParams.append('location', params.location);
  if (params?.vendor) queryParams.append('vendor', String(params.vendor));

  const response = await axios.get(`${API_BASE_URL}/inventory/lots?${queryParams.toString()}`);
  return response.data.map(mapToInventoryLotRow);
}

export async function getInventoryLotDetail(lotId: number): Promise<InventoryLotRow> {
  const response = await axios.get(`${API_BASE_URL}/inventory/lots/${lotId}`);
  return mapToInventoryLotRow(response.data);
}

export async function adjustLot(payload: { lotId: number; quantityChange: number; reason?: string }) {
  const response = await axios.post(`${API_BASE_URL}/inventory/adjust`, payload);
  return response.data;
}

export async function splitLot(payload: { parentLotId: number; quantityToSplit: number }) {
  const response = await axios.post(`${API_BASE_URL}/inventory/split`, payload);
  return response.data;
}

// React Query Hooks

export function useInventoryLots(params?: Parameters<typeof getInventoryLots>[0]) {
  return useQuery({
    queryKey: ['inventory-lots', params],
    queryFn: () => getInventoryLots(params),
    });
}

export function useAdjustLotMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: Parameters<typeof adjustLot>[0]) => adjustLot(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
      },
    });
}

export function useSplitLotMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: Parameters<typeof splitLot>[0]) => splitLot(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
      },
    });
}
