import { ArrowRight } from 'lucide-react';
import type { FifoAllocationSummary } from '../../types/wms-inventory';
import AllocationResult from './AllocationResult';

interface AllocationSectionProps {
  allocation: FifoAllocationSummary | null;
  loading: boolean;
  error: string | null;
  confirmLoading: boolean;
  onConfirmAllocation: () => void;
}

export default function AllocationSection({
  allocation,
  loading,
  error,
  confirmLoading,
  onConfirmAllocation,
}: AllocationSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <ArrowRight className="size-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">FIFO 配貨結果</h2>
          {allocation && (
            <p className="text-sm text-slate-500">
              訂單: {allocation.soNumber} | 策略: {allocation.strategy}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>
      ) : allocation ? (
        <>
          <AllocationResult allocation={allocation} />

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-600">
                ✓ 依據 <span className="font-semibold">{allocation.strategy}</span> 自動分配
                {allocation.strategy === 'FIFO' && ' · 最早收貨優先'}
                {allocation.strategy === 'FEFO' && ' · 最早到期優先'}
              </p>
              <button
                type="button"
                onClick={onConfirmAllocation}
                disabled={confirmLoading}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {confirmLoading ? '刷新中...' : '刷新波次'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500">
          請選擇訂單以執行配貨
        </div>
      )}
    </div>
  );
}
