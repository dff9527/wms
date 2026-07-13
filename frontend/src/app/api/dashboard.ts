import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

export interface TodayReceiving {
  date: string;
  count: number;
  totalQuantity: number;
}

export interface DailyTrendPoint {
  date: string;
  receiving: number;
  shipping: number;
}

export interface RecentActivity {
  id: number;
  type: string;
  lotId: number | null;
  internalSku: string | null;
  internalLotNumber: string | null;
  quantityChange: number;
  referenceNumber: string | null;
  executedBy: string;
  executedAt: string;
}

export interface InventoryStatusSummary {
  totalQuantity: number;
  breakdown: { status: string; quantity: number }[];
}

export function useInventoryStatusSummary() {
  return useQuery({
    queryKey: ['dashboard', 'inventory-status'],
    queryFn: async (): Promise<InventoryStatusSummary> => {
      const { data } = await axios.get('/api/v1/dashboard/inventory-status');
      return {
        totalQuantity: data.total_quantity,
        breakdown: Array.isArray(data.breakdown) ? data.breakdown : [],
      };
    },
  });
}

export function useTodayReceiving() {
  return useQuery({
    queryKey: ['dashboard', 'today-receiving'],
    queryFn: async (): Promise<TodayReceiving> => {
      const { data } = await axios.get('/api/v1/dashboard/today-receiving');
      return {
        date: data.date,
        count: data.count,
        totalQuantity: data.total_quantity,
      };
    },
  });
}

export function useDailyTrend() {
  return useQuery({
    queryKey: ['dashboard', 'daily-trend'],
    queryFn: async (): Promise<DailyTrendPoint[]> => {
      const { data } = await axios.get('/api/v1/dashboard/daily-trend');
      return data;
    },
  });
}

export function useRecentActivities() {
  return useQuery({
    queryKey: ['dashboard', 'recent-activities'],
    queryFn: async (): Promise<RecentActivity[]> => {
      const { data } = await axios.get('/api/v1/dashboard/recent-activities');
      return data.map((activity: Record<string, unknown>) => ({
        id: activity.id,
        type: activity.type,
        lotId: activity.lot_id,
        internalSku: activity.internal_sku,
        internalLotNumber: activity.internal_lot_number,
        quantityChange: activity.quantity_change,
        referenceNumber: activity.reference_number,
        executedBy: activity.executed_by,
        executedAt: activity.executed_at,
      })) as RecentActivity[];
    },
  });
}
