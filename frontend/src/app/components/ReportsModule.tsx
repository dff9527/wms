import { useEffect, useState } from 'react';
import { AlertCircle, Download, Loader2, Search } from 'lucide-react';
import { useTransactions } from '../api/transactions';
import { exportCsv } from '../utils/exportCsv';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';

const TX_TYPES = [
  '',
  'RECEIVE',
  'PUT_AWAY',
  'PICK',
  'SHIP',
  'ADJUST',
  'SPLIT',
  'MOVE',
  'RETURN',
] as const;

export default function ReportsModule() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [transactionType, setTransactionType] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, transactionType, pageSize]);

  const { data, isLoading, isError, isFetching } = useTransactions({
    page,
    pageSize,
    transactionType: transactionType || undefined,
    search: debouncedSearch || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const handleExport = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate()
    ).padStart(2, '0')}`;
    exportCsv(
      `transactions_${ymd}.csv`,
      ['交易類型', '料號', '批號', '數量變動', '單據號碼', '操作者', '時間'],
      items.map((row) => [
        row.type,
        row.internalSku ?? '',
        row.internalLotNumber ?? '',
        row.quantityChange,
        row.referenceNumber ?? '',
        row.executedBy,
        row.executedAt,
      ])
    );
  };

  const pageWindow = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>([1, totalPages, page]);
    for (let i = page - 2; i <= page + 2; i += 1) {
      if (i >= 1 && i <= totalPages) pages.add(i);
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">報表中心</h2>
          <p className="text-sm text-slate-500">庫存交易 / 稽核查詢</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={items.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="size-4" />
          匯出 CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-600">搜尋</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="料號 / 批號 / 單據 / 操作者"
              className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </label>
        <label className="flex w-44 flex-col gap-1 text-sm">
          <span className="text-slate-600">交易類型</span>
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
          >
            {TX_TYPES.map((type) => (
              <option key={type || 'all'} value={type}>
                {type || '全部'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          <span className="text-slate-600">每頁</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
          <div>
            <h4 className="text-sm font-semibold text-red-800">交易資料載入失敗</h4>
            <p className="mt-1 text-xs text-red-700">請稍後再試或檢查網路連線。</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>
            共 {total.toLocaleString()} 筆
            {isFetching && !isLoading ? ' · 更新中…' : ''}
          </span>
        </div>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-slate-400 italic">
            尚無符合條件的交易
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">類型</th>
                  <th className="px-4 py-3 font-medium">料號</th>
                  <th className="px-4 py-3 font-medium">批號</th>
                  <th className="px-4 py-3 font-medium text-right">數量</th>
                  <th className="px-4 py-3 font-medium">單據</th>
                  <th className="px-4 py-3 font-medium">操作者</th>
                  <th className="px-4 py-3 font-medium">時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.type}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {row.internalSku || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {row.internalLotNumber || '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        row.quantityChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {row.quantityChange > 0 ? '+' : ''}
                      {row.quantityChange.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.referenceNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.executedBy}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.executedAt
                        ? new Date(row.executedAt).toLocaleString('zh-TW')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
                aria-disabled={page <= 1}
                className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
            {pageWindow().map((p, idx, arr) => (
              <PaginationItem key={p}>
                {idx > 0 && p - arr[idx - 1] > 1 ? <PaginationEllipsis /> : null}
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
