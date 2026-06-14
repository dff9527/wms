import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  completeIQC,
  getReceivingDetail,
  getReceivingList,
  printLabel,
  processReceipt,
  scanBarcode,
  listVendors,
  listPOs,
  listItems,
  createPO,
  listOpenPOs,
} from '../api/receiving';

export function useReceivingList(params?: { poNumber?: string; status?: string }) {
  return useQuery({
    queryKey: ['receiving-list', params],
    queryFn: () => getReceivingList(params),
  });
}

export function useReceivingDetail(lotId: number) {
  return useQuery({
    queryKey: ['receiving-detail', lotId],
    queryFn: () => getReceivingDetail(lotId),
    enabled: lotId > 0,
  });
}

export function useProcessReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: processReceipt,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receiving-list'] }),
  });
}

export function useCompleteIQC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completeIQC,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['receiving-detail', variables.lotId] });
      qc.invalidateQueries({ queryKey: ['receiving-list'] });
    },
  });
}

// FIX: [fix_4] — Add useScanBarcode hook export to resolve TS2305 error in ReceivingModule
export function useScanBarcode() {
  return useMutation({
    mutationFn: scanBarcode,
  });
}

// Add usePrintLabel hook for label printing
export function usePrintLabel() {
  return useMutation({
    mutationFn: printLabel,
  });
}

// PO-related hooks
export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: () => listVendors(),
  });
}

export function usePOs() {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => listPOs(),
  });
}

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: () => listItems(),
  });
}

export function useOpenPOs() {
  return useQuery({
    queryKey: ['open-po-list'],
    queryFn: () => listOpenPOs(),
  });
}

export function useCreatePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPO,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['open-po-list'] });
    },
  });
}
