import { ArrowRight } from 'lucide-react';
import type { FifoAllocationSummary } from '../../types/wms-inventory';

interface AllocationResultProps {
  allocation: FifoAllocationSummary | null;
}

export default function AllocationResult({ allocation }: AllocationResultProps) {
  if (!allocation) return null;

  return (
      <>
        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">需求數量</p>
              <p className="text-2xl font-bold text-slate-900">{allocation.requestedQty.toLocaleString()} PCS</p>
            </div>
            <ArrowRight className="size-8 text-slate-400" />
            <div>
              <p className="text-sm text-slate-600">配貨數量</p>
              <p className="text-2xl font-bold text-green-600">{allocation.allocatedQty.toLocaleString()} PCS</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {allocation.details.map((detail) => (
            <div key={detail.rank} className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center justify-center size-8 bg-blue-100 text-blue-700 rounded-full font-bold text-sm shrink-0">
                {detail.rank}
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">內部批號</p>
                  <p className="text-sm font-mono font-semibold text-slate-900 truncate">{detail.internalLotNumber}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">內部條碼</p>
                  <p className="text-sm font-mono text-slate-800 truncate">{detail.internalBarcode}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">供應商批號</p>
                  <p className="text-sm font-mono text-slate-700 truncate">{detail.vendorLotCode}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">配貨數量</p>
                  <p className="text-sm font-bold text-green-600">{detail.qty.toLocaleString()} PCS</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">收貨日期</p>
                  <p className="text-sm text-slate-700">{detail.receiveDate}</p>
                </div>
// FIX: [fix_1] — Complete the truncated 6th column div showing location (儲位) and close all unclosed JSX elements
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">儲位</p>
                  <p className="text-sm text-slate-700">{detail.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
   );
}
