import { CheckCircle, Clock, Package } from 'lucide-react';

export function StatusBadge({ status }: { status: string | undefined | null }) {
  const statusConfig = {
    pending: { label: '待配貨', className: 'bg-slate-100 text-slate-700', icon: Clock },
    allocated: { label: '已配貨', className: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    picking: { label: '揀貨中', className: 'bg-yellow-100 text-yellow-700', icon: Package },
    completed: { label: '已完成', className: 'bg-green-100 text-green-700', icon: CheckCircle },
    in_progress: { label: '進行中', className: 'bg-orange-100 text-orange-700', icon: Clock },
    picked: { label: '已揀貨', className: 'bg-indigo-100 text-indigo-700', icon: CheckCircle },
    confirmed: { label: '已確認', className: 'bg-teal-100 text-teal-700', icon: CheckCircle },
    cancelled: { label: '已取消', className: 'bg-red-100 text-red-700', icon: Clock },
    open: { label: '開啟', className: 'bg-gray-100 text-gray-700', icon: Clock },
    shipped: { label: '已出貨', className: 'bg-purple-100 text-purple-700', icon: CheckCircle },
    closed: { label: '已關閉', className: 'bg-slate-200 text-slate-600', icon: Clock },
  };

  const key = String(status).toLowerCase();
  const config = statusConfig[key as keyof typeof statusConfig] || {
    label: status || '—',
    className: 'bg-slate-100 text-slate-700',
    icon: Clock,
  };

  const Icon = config.icon;
  return (
    <span
      title={status || undefined}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.className}`}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}
