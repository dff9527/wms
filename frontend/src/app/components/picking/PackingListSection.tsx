import { Printer } from 'lucide-react';
import type { PackingList } from './types';

interface PackingListSectionProps {
  packingList: PackingList;
  onPrintPackingList: () => void;
}

export default function PackingListSection({
  packingList,
  onPrintPackingList,
}: PackingListSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">裝箱清單</h2>
          <p className="text-sm text-slate-500 mt-1">訂單: {packingList.soNumber}</p>
        </div>
        <button
          type="button"
          onClick={onPrintPackingList}
          disabled={!packingList.items.length}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className="size-4" />
          列印裝箱單
        </button>
      </div>

      <div className="space-y-4">
        {packingList.items.map((item, itemIndex) => (
          <div key={itemIndex} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <span className="text-sm font-medium text-slate-700">料號: {item.sku}</span>
            </div>
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50/50">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                    內部批號
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                    料號
                  </th>
                  <th className="right py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                    數量
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                    收貨日期
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                    儲位
                  </th>
                </tr>
              </thead>
              <tbody>
                {item.lots.map((lot, lotIndex) => (
                  <tr
                    key={lotIndex}
                    className="border-b border-slate-100 hover:bg-slate-50 last:border-b-0"
                  >
                    <td className="py-2 px-3 text-sm font-mono text-slate-900">
                      {lot.internalLotNumber}
                    </td>
                    <td className="py-2 px-3 text-sm font-mono text-slate-700">
                      {lot.internalSku}
                    </td>
                    <td className="py-2 px-3 text-sm text-right font-semibold text-slate-900">
                      {lot.qty.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-700">{lot.receiveDate}</td>
                    <td className="py-2 px-3 text-sm text-slate-700">{lot.location ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
