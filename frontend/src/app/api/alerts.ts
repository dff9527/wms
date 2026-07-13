import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

export type AlertSeverity = 'critical' | 'warning';
export type AlertType = 'EXPIRING_LOT' | 'MSL_EXPIRED' | 'LOW_STOCK' | string;

export interface AlertItem {
  type: AlertType;
  severity: AlertSeverity | string;
  message: string;
  internalSku: string;
  lotId: number | null;
  currentQty: number | null;
  thresholdQty: number | null;
  dueDate: string | null;
  bagOpenedAt: string | null;
}

export interface AlertsResponse {
  items: AlertItem[];
  total: number;
}

export function useAlerts(days = 30) {
  return useQuery({
    queryKey: ['alerts', days],
    queryFn: async (): Promise<AlertsResponse> => {
      const { data } = await axios.get('/api/v1/alerts', { params: { days } });
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        total: Number(data?.total ?? 0),
      };
    },
  });
}
