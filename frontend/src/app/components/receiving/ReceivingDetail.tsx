import { Package, Barcode as BarcodeIcon, Tag, Calendar, MapPin, User } from 'lucide-react';
import Barcode from 'react-barcode';
import type { ReceivingItem } from '../../types/receiving';

interface ReceivingDetailProps {
  item: ReceivingItem;
}

export default function ReceivingDetail({ item }: ReceivingDetailProps) {
  const getIQCBadge = (result?: string) => {
    if (!result) return null;

    const config: Record<string, { label: string; className: string }> = {
      PASS: { label: '合格', className: 'bg-emerald-100 text-emerald-800' },
      FAIL: { label: '不合格', className: 'bg-red-100 text-red-800' },
      PENDING: { label: '待檢驗', className: 'bg-amber-100 text-amber-800' },
    };

    const key = String(result).toUpperCase();
    const badge = config[key] ?? config.PENDING;

    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const receiveFmt = () => {
    const d = new Date(item.receiveDate);
    return Number.isNaN(d.getTime()) ? item.receiveDate : d.toLocaleString('zh-TW');
  };

  const lotStatusZh: Record<string, string> = {
    AVAILABLE: '已放行',
    RESERVED: '已預留',
    QC_HOLD: 'IQC檢驗中',
    QUARANTINE: '隔離',
    EXPIRED: '已過期',
    SHIPPED: '已出貨',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">批次詳情</h2>
            <p className="mt-1 text-sm text-slate-500 font-mono">採購單號: {item.poNumber}</p>
            <p className="mt-1 text-xs text-slate-400">Lot ID #{item.lotId}</p>
          </div>
          <div className="text-right">
            {item.iqcResult ? getIQCBadge(item.iqcResult) : null}
            <p className="mt-2 text-sm text-slate-500">收貨時間: {receiveFmt()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="size-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">內部追溯資訊</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Tag className="size-4" />
                內部料號 (internal_sku)
              </label>
              <div className="text-lg font-mono font-semibold text-slate-900">
                {item.internalSku}
              </div>
              {item.description ? (
                <div className="text-sm text-slate-600 mt-1">{item.description}</div>
              ) : null}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="text-sm text-slate-500 mb-1 block">
                內部批號 (internal_lot_number)
              </label>
              <div className="text-xl font-bold text-slate-900">{item.internalLotNumber}</div>
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                <Calendar className="size-4 shrink-0" />
                收貨日期:{' '}
                {Number.isNaN(Date.parse(item.receiveDate))
                  ? item.receiveDate
                  : new Date(item.receiveDate).toLocaleDateString('zh-TW')}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <BarcodeIcon className="size-4" />
                內部條碼 (internal_barcode)
              </label>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <div className="font-mono text-lg text-center mb-3 text-slate-900">
                  {item.internalBarcode}
                </div>
                <div className="flex justify-center overflow-x-auto">
                  <Barcode
                    value={item.internalBarcode}
                    width={2}
                    height={56}
                    fontSize={12}
                    margin={8}
                    displayValue={false}
                  />
                </div>
              </div>
            </div>

            {item.locationCode ? (
              <div className="border-t border-slate-100 pt-4">
                <label className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <MapPin className="size-4" />
                  儲位
                </label>
                <div className="text-lg font-mono font-semibold text-blue-700">
                  {item.locationCode}
                </div>
              </div>
            ) : null}

            <div className="border-t border-slate-100 pt-4">
              <label className="text-sm text-slate-500 mb-1 block">
                庫存數量 (quantity_on_hand)
              </label>
              <div className="text-2xl font-bold text-slate-900">
                {item.quantityOnHand.toLocaleString()}{' '}
                <span className="text-lg text-slate-500">{item.unit}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                批次狀態: {lotStatusZh[String(item.lotStatus).toUpperCase()] ?? item.lotStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="size-5 text-violet-600" />
            <h3 className="text-lg font-bold text-slate-900">供應商追溯資訊</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-500 mb-1 block">供應商名稱</label>
              <div className="text-lg font-semibold text-slate-900">{item.vendorName}</div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="text-sm text-slate-500 mb-1 block">供應商料號 (vendor_pn)</label>
              <div className="font-mono text-lg text-slate-900">{item.vendorPn}</div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="text-sm text-slate-500 mb-1 block">
                供應商批號 (vendor_lot_code)
              </label>
              <div className="font-mono text-lg text-semibold text-violet-700">
                {item.vendorLotCode}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="text-sm text-slate-500 mb-1 block">
                供應商日期碼 (vendor_date_code)
              </label>
              <div className="font-mono text-lg text-slate-900">{item.vendorDateCode ?? 'N/A'}</div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="text-sm text-slate-500 mb-1 block">
                原始掃描條碼 (original_barcode)
              </label>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg font-mono text-sm text-slate-700 break-all">
                {item.originalBarcode || '—'}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                對應 DB inventory_lots.original_barcode，供逆向追溯。
              </p>
            </div>
          </div>
        </div>
      </div>

      {item.iqcResult ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="size-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-900">IQC 檢驗資訊</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-500 mb-1 block">檢驗結果</label>
              {getIQCBadge(item.iqcResult)}
            </div>

            {item.iqcDate ? (
              <div>
                <label className="text-sm text-slate-500 mb-1 block">檢驗時間</label>
                <div className="text-sm text-slate-900">
                  {Number.isNaN(Date.parse(item.iqcDate))
                    ? item.iqcDate
                    : new Date(item.iqcDate).toLocaleString('zh-TW')}
                </div>
              </div>
            ) : null}

            {item.iqcInspector ? (
              <div>
                <label className="text-sm text-slate-500 mb-1 block">檢驗員</label>
                <div className="text-sm text-slate-900">{item.iqcInspector}</div>
              </div>
            ) : null}
          </div>

          {item.qualityNotes ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="text-sm text-slate-500 mb-1 block">檢驗備註</label>
              <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100">
                {item.qualityNotes}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6">追溯鏈</h3>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center shrink-0">
            <div className="size-24 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-2">
              <Package className="size-12 text-violet-600" />
            </div>
            <div className="text-sm font-medium text-slate-900">供應商</div>
            <div className="text-xs text-slate-500 mt-1 max-w-[140px]">{item.vendorName}</div>
            <div className="font-mono text-xs text-violet-700 mt-1">{item.vendorLotCode}</div>
          </div>

          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 mx-2" />

          <div className="text-center shrink-0">
            <div className="size-24 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
              <BarcodeIcon className="size-12 text-blue-600" />
            </div>
            <div className="text-sm font-medium text-slate-900">內部批次</div>
            <div className="text-xs text-slate-500 mt-1">
              {Number.isNaN(Date.parse(item.receiveDate))
                ? '—'
                : new Date(item.receiveDate).toLocaleDateString('zh-TW')}
            </div>
            <div className="font-mono text-xs text-blue-700 mt-1 max-w-[200px] break-all">
              {item.internalLotNumber}
            </div>
          </div>

          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 mx-2" />

          <div className="text-center shrink-0">
            <div className="size-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
              <MapPin className="size-12 text-emerald-600" />
            </div>
            <div className="text-sm font-medium text-slate-900">儲位</div>
            <div className="text-xs text-slate-500 mt-1">{item.locationCode ?? '待上架'}</div>
            <div className="font-mono text-xs text-emerald-700 mt-1">
              {lotStatusZh[String(item.lotStatus).toUpperCase()] ?? item.lotStatus}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
