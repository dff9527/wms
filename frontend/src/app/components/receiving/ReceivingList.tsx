import type { ReactNode } from 'react';
import { Package, Check, Clock, AlertCircle } from 'lucide-react';
import type { ReceivingItem } from '../../types/receiving';

interface ReceivingListProps {
  items: ReceivingItem[];
  onViewDetails: (lotId: number) => void;
}

/**
 * 收貨清單（對齊 CURSOR_INSTRUCTIONS.md）
 * 欄位：採購單號｜供應商｜內部料號｜內部批號（粗體）｜內部條碼（mono）｜供應商批號｜數量｜狀態｜操作
 */
export default function ReceivingList({ items, onViewDetails }: ReceivingListProps) {
  const getStatusBadge = (status: ReceivingItem['lotStatus']) => {
    const statusConfig: Record<
      string,
        { label: string; className: string; icon: ReactNode }
      > = {
      available: {
        label: '已放行',
        className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        icon: <Check className="size-3.5" />,
        },
      reserved: {
        label: '已預留',
        className: 'bg-blue-100 text-blue-900 border border-blue-200',
        icon: <Clock className="size-3.5" />,
        },
      qc_hold: {
        label: 'IQC檢驗中',
        className: 'bg-amber-100 text-amber-900 border border-amber-200',
        icon: <Clock className="size-3.5" />,
        },
      quarantine: {
        label: '隔離',
        className: 'bg-red-100 text-red-800 border border-red-200',
        icon: <AlertCircle className="size-3.5" />,
        },
      expired: {
        label: '已過期',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        icon: <AlertCircle className="size-3.5" />,
        },
      shipped: {
        label: '已出貨',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        icon: <Check className="size-3.5" />,
        },
      };

    const FALLBACK = {
      label: String(status || '—'),
      className: 'bg-slate-100 text-slate-700',
      icon: <AlertCircle className="w-4 h-4" />,
    };

    const key = String(status).toLowerCase();
    const config = statusConfig[key] ?? FALLBACK;

    return (
        <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
        >
          {config.icon}
          {config.label}
        </span>
      );
    };

  const receiveFmt = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('zh-TW');
    };

  return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">採購單號</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">供應商</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">內部料號</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">內部批號</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">內部條碼</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">供應商批號</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">數量</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">狀態</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => (
                <tr key={item.lotId} className="hover:bg-slate-50/80">
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-mono text-slate-900">{item.poNumber}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-700">{item.vendorName}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{item.internalSku}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-900">{item.internalLotNumber}</div>
                    <div className="text-xs text-slate-500">{receiveFmt(item.receiveDate)}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded-md text-slate-900">{item.internalBarcode}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-mono text-sm text-slate-700">{item.vendorLotCode}</div>
                    {item.vendorDateCode && <div className="text-xs text-slate-500">DC: {item.vendorDateCode}</div>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm">
                    <span className="font-semibold text-slate-900">{item.quantityOnHand.toLocaleString()}</span>
                    <div className="text-xs text-slate-500">{item.unit}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{getStatusBadge(item.lotStatus)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm">
                    <button
                    type="button"
                    onClick={() => onViewDetails(item.lotId)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                    詳情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <div className="text-center py-12 border-t border-slate-100">
            <Package className="mx-auto size-12 text-slate-300" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">暫無收貨記錄</h3>
            <p className="mt-1 text-sm text-slate-500">等待掃描條碼或同步採購單…</p>
          </div>
        )}
      </div>
    );
}
