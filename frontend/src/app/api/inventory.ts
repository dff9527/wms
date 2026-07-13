import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InventoryLotRow } from '../types/wms-inventory';

// 一律走相對路徑(dev 由 Vite proxy、正式由 nginx 轉發),不依賴 VITE_API_URL
const API_BASE_URL = '/api/v1';

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
    bagOpenedAt: data.bag_opened_at ?? null,
    // These fields are required by InventoryLotRow but not yet returned by LotOut; default until backend exposes them.
    vendorLotCode: data.vendor_lot_code ?? '',
    description: data.description ?? '',
    receiveDate: data.receive_date ?? '',
    mslLevel: data.msl_level ?? 0,
  };
}

export type InventorySortBy =
  | 'internal_sku'
  | 'internal_lot_number'
  | 'quantity_on_hand'
  | 'quantity_reserved'
  | 'receive_date'
  | 'expiry_date'
  | 'lot_status'
  | 'location_code';

export interface InventoryLotsParams {
  sku?: string;
  status?: string[];
  location?: string;
  vendor?: number;
  page?: number;
  pageSize?: number;
  sortBy?: InventorySortBy;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface InventoryLotsPage {
  items: InventoryLotRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getInventoryLots(params?: InventoryLotsParams): Promise<InventoryLotsPage> {
  const queryParams = new URLSearchParams();
  if (params?.sku) queryParams.append('sku', params.sku);
  if (params?.status) params.status.forEach((s) => queryParams.append('status', s));
  if (params?.location) queryParams.append('location', params.location);
  if (params?.vendor) queryParams.append('vendor', String(params.vendor));
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.pageSize) queryParams.append('page_size', String(params.pageSize));
  if (params?.sortBy) queryParams.append('sort_by', params.sortBy);
  if (params?.order) queryParams.append('order', params.order);
  if (params?.search) queryParams.append('search', params.search);

  const response = await axios.get(`${API_BASE_URL}/inventory/lots?${queryParams.toString()}`);
  const rawItems = Array.isArray(response.data) ? response.data : response.data.items;
  return {
    items: rawItems.map(mapToInventoryLotRow),
    total: response.data.total ?? rawItems.length,
    page: response.data.page ?? 1,
    pageSize: response.data.page_size ?? rawItems.length,
    totalPages: response.data.total_pages ?? (rawItems.length ? 1 : 0),
  };
}

export async function getInventoryLotDetail(lotId: number): Promise<InventoryLotRow> {
  const response = await axios.get(`${API_BASE_URL}/inventory/lots/${lotId}`);
  return mapToInventoryLotRow(response.data);
}

export async function adjustLot(payload: {
  lotId: number;
  quantityChange: number;
  reason?: string;
}) {
  const response = await axios.post(`${API_BASE_URL}/inventory/adjust`, payload);
  return response.data;
}

export async function splitLot(payload: { parentLotId: number; quantityToSplit: number }) {
  const response = await axios.post(`${API_BASE_URL}/inventory/split`, payload);
  return response.data;
}

export async function moveLot(payload: {
  lotId: number;
  targetLocationCode: string;
  reason?: string;
}) {
  const response = await axios.post(`${API_BASE_URL}/inventory/lots/${payload.lotId}/move`, {
    targetLocationCode: payload.targetLocationCode,
    reason: payload.reason,
  });
  return response.data;
}

export async function updateMslBag(lotId: number, action: 'open-bag' | 'bake') {
  return axios
    .post(`${API_BASE_URL}/inventory/lots/${lotId}/${action}`)
    .then((response) => response.data);
}

export async function updateLot(payload: {
  lotId: number;
  locationCode?: string;
  qualityNotes?: string;
}) {
  const response = await axios.patch(`${API_BASE_URL}/lots/${payload.lotId}`, {
    locationCode: payload.locationCode,
    qualityNotes: payload.qualityNotes,
  });
  return response.data;
}

export async function voidLot(lotId: number) {
  const response = await axios.post(`${API_BASE_URL}/lots/${lotId}/void`);
  return response.data;
}

// React Query Hooks

export function useInventoryLots(params?: Parameters<typeof getInventoryLots>[0]) {
  return useQuery({
    queryKey: ['inventory-lots', params],
    queryFn: () => getInventoryLots(params),
    placeholderData: (previousData) => previousData,
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

export function useMoveLotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof moveLot>[0]) => moveLot(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-lots'] }),
  });
}

export function useMslBagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lotId, action }: { lotId: number; action: 'open-bag' | 'bake' }) =>
      updateMslBag(lotId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-lots'] }),
  });
}

export function useUpdateLotMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof updateLot>[0]) => updateLot(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
    },
  });
}

export function useVoidLotMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lotId: number) => voidLot(lotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
    },
  });
}
