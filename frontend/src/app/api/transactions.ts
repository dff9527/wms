import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import type { RecentActivity } from './dashboard';

export interface TransactionsPage {
  items: RecentActivity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TransactionsQuery {
  page?: number;
  pageSize?: number;
  transactionType?: string;
  search?: string;
}

function mapActivity(raw: Record<string, unknown>): RecentActivity {
  return {
    id: Number(raw.id),
    type: String(raw.type ?? ''),
    lotId: raw.lot_id == null ? null : Number(raw.lot_id),
    internalSku: (raw.internal_sku as string | null) ?? null,
    internalLotNumber: (raw.internal_lot_number as string | null) ?? null,
    quantityChange: Number(raw.quantity_change ?? 0),
    referenceNumber: (raw.reference_number as string | null) ?? null,
    executedBy: String(raw.executed_by ?? ''),
    executedAt: String(raw.executed_at ?? ''),
  };
}

export function useTransactions(params: TransactionsQuery = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const transactionType = params.transactionType || undefined;
  const search = params.search || undefined;

  return useQuery({
    queryKey: ['dashboard', 'transactions', page, pageSize, transactionType, search],
    queryFn: async (): Promise<TransactionsPage> => {
      const { data } = await axios.get('/api/v1/dashboard/transactions', {
        params: {
          page,
          page_size: pageSize,
          transaction_type: transactionType,
          search,
        },
      });
      return {
        items: Array.isArray(data?.items) ? data.items.map(mapActivity) : [],
        total: Number(data?.total ?? 0),
        page: Number(data?.page ?? page),
        pageSize: Number(data?.page_size ?? pageSize),
        totalPages: Number(data?.total_pages ?? 0),
      };
    },
    placeholderData: (previous) => previous,
  });
}
