import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = '/api/v1';

export interface ReturnPayload {
  lotId: number;
  quantity: number;
  reason: string;
  reference?: string;
}

export interface ReturnResult {
  returnId: number;
  returnNumber: string;
  returnType: string;
  lotId: number;
  quantity: number;
  status: string;
  requiresIqc: boolean;
}

export async function customerReturn(payload: ReturnPayload): Promise<ReturnResult> {
  const response = await axios.post(`${API_BASE_URL}/returns/customer`, payload);
  return response.data;
}

export async function supplierReturn(payload: ReturnPayload): Promise<ReturnResult> {
  const response = await axios.post(`${API_BASE_URL}/returns/supplier`, payload);
  return response.data;
}

export function useCustomerReturnMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customerReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
    },
  });
}

export function useSupplierReturnMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supplierReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
    },
  });
}
