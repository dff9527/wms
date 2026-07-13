import { Plus } from 'lucide-react';
import type { Customer, Item } from './types';

interface CreateSODialogProps {
  soNumber: string;
  setSoNumber: (value: string) => void;
  customerId: number | '';
  setCustomerId: (value: number | '') => void;
  strategy: 'FIFO' | 'FEFO';
  setStrategy: (value: 'FIFO' | 'FEFO') => void;
  orderLines: { internalSku: string; orderedQty: number }[];
  customers: Customer[];
  items: Item[];
  createLoading: boolean;
  showAddCustomerForm: boolean;
  setShowAddCustomerForm: (value: boolean) => void;
  addCustomerCode: string;
  setAddCustomerCode: (value: string) => void;
  addCustomerName: string;
  setAddCustomerName: (value: string) => void;
  addCustomerLoading: boolean;
  addCustomerError: string | null;
  setAddCustomerError: (value: string | null) => void;
  onClose: () => void;
  onAddCustomer: () => void;
  onCreateSO: () => void;
  onAddOrderLine: () => void;
  onRemoveOrderLine: (index: number) => void;
  onUpdateOrderLine: (index: number, field: 'internalSku' | 'orderedQty', value: string | number) => void;
}

export default function CreateSODialog({
  soNumber,
  setSoNumber,
  customerId,
  setCustomerId,
  strategy,
  setStrategy,
  orderLines,
  customers,
  items,
  createLoading,
  showAddCustomerForm,
  setShowAddCustomerForm,
  addCustomerCode,
  setAddCustomerCode,
  addCustomerName,
  setAddCustomerName,
  addCustomerLoading,
  addCustomerError,
  setAddCustomerError,
  onClose,
  onAddCustomer,
  onCreateSO,
  onAddOrderLine,
  onRemoveOrderLine,
  onUpdateOrderLine,
}: CreateSODialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">建立銷售訂單</h3>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Order Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">訂單編號 *</label>
            <input
              type="text"
              value={soNumber}
              onChange={(e) => setSoNumber(e.target.value)}
              placeholder="例如: SO-2026-001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={createLoading}
            />
          </div>

          {/* Customer with inline add form */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">客戶</label>
            <div className="flex gap-2">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                disabled={createLoading || showAddCustomerForm}
              >
                <option value="">請選擇客戶</option>
                {customers.map((customer) => (
                  <option key={customer.customer_id} value={customer.customer_id}>
                    {customer.customer_name} ({customer.customer_code})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setShowAddCustomerForm(true);
                  setAddCustomerError(null);
                }}
                disabled={createLoading || showAddCustomerForm}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors shrink-0 flex items-center gap-1 text-sm"
                title="新增客戶"
              >
                <Plus className="size-4" />
                新增
              </button>
            </div>

            {/* Inline add customer form */}
            {showAddCustomerForm && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700">新增客戶</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCustomerForm(false);
                      setAddCustomerCode('');
                      setAddCustomerName('');
                      setAddCustomerError(null);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <span className="text-lg">&times;</span>
                  </button>
                </div>
                {addCustomerError && (
                  <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                    {addCustomerError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-600 mb-0.5">客戶代碼 *</label>
                    <input
                      type="text"
                      value={addCustomerCode}
                      onChange={(e) => setAddCustomerCode(e.target.value)}
                      placeholder="例如: C001"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-0.5">客戶名稱 *</label>
                    <input
                      type="text"
                      value={addCustomerName}
                      onChange={(e) => setAddCustomerName(e.target.value)}
                      placeholder="例如: 測試客戶"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onAddCustomer}
                  disabled={addCustomerLoading}
                  className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addCustomerLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                      建立中...
                    </>
                  ) : (
                    <>
                      <Plus className="size-3" />
                      確認新增
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">配貨策略</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as 'FIFO' | 'FEFO')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={createLoading}
            >
              <option value="FIFO">FIFO (先進先出)</option>
              <option value="FEFO">FEFO (先到期先出)</option>
            </select>
          </div>

          {/* Order Lines */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">明細列</label>
            <div className="space-y-3">
              {orderLines.map((line, index) => (
                <div key={index} className="flex gap-3 items-start">
                  {/* SKU Dropdown */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      料號 * {index + 1}
                    </label>
                    <select
                      value={line.internalSku}
                      onChange={(e) => onUpdateOrderLine(index, 'internalSku', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      disabled={createLoading}
                    >
                      <option value="">請選擇料號</option>
                      {items.map((item) => (
                        <option key={item.internalSku} value={item.internalSku}>
                          {item.internalSku} - {item.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="w-32">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      數量 *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={line.orderedQty}
                      onChange={(e) =>
                        onUpdateOrderLine(index, 'orderedQty', Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      disabled={createLoading}
                    />
                  </div>

                  {/* Remove Button */}
                  {orderLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveOrderLine(index)}
                      className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      disabled={createLoading}
                    >
                      <span className="text-lg">&times;</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onAddOrderLine}
              disabled={createLoading}
              className="mt-3 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
            >
              + 新增明細
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50 rounded-b-lg">
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            disabled={createLoading}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onCreateSO}
            disabled={createLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {createLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                建立中...
              </>
            ) : (
              <>
                <Plus className="size-4" />
                建立訂單
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
