import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  completeIQC,
  getReceivingDetail,
  getReceivingList,
  processReceipt,
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
