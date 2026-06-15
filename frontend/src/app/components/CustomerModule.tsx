import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, CheckCircle, XCircle } from 'lucide-react';

interface Customer {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  is_active: boolean;
}

export default function CustomerModule() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/v1/customers/');
      setCustomers(response.data);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreateCustomer = async () => {
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);

    if (!customerCode.trim()) {
      setCreateError('客戶代碼不可空白');
      setCreateLoading(false);
      return;
    }
    if (!customerName.trim()) {
      setCreateError('客戶名稱不可空白');
      setCreateLoading(false);
      return;
    }

    try {
      await axios.post('/api/v1/customers/', {
        customer_code: customerCode.trim(),
        customer_name: customerName.trim(),
        is_active: true,
      });

      setCreateSuccess('客戶建立成功！');
      setCustomerCode('');
      setCustomerName('');

      // Refresh list
      await fetchCustomers();

      // Close dialog after a short delay
      setTimeout(() => {
        setShowCreateDialog(false);
        setCreateSuccess(null);
      }, 1000);
    } catch (err: any) {
      const detail = err.response?.data?.detail || '建立客戶失敗';
      setCreateError(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">客戶管理</h2>
            <p className="text-sm text-slate-500 mt-1">管理所有客戶資料</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreateDialog(true);
              setCreateError(null);
              setCreateSuccess(null);
              setCustomerCode('');
              setCustomerName('');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="size-4" />
            新增客戶
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500">尚無客戶資料</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                    客戶代碼
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                    客戶名稱
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">
                    啟用狀態
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.customer_id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-4 text-sm font-mono text-slate-900">
                      {customer.customer_code}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900">{customer.customer_name}</td>
                    <td className="py-3 px-4 text-center">
                      {customer.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="size-3" />
                          啟用
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                          <XCircle className="size-3" />
                          停用
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Customer Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">新增客戶</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateDialog(false);
                  setCreateError(null);
                  setCreateSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {createError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 text-sm">
                  {createSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">客戶代碼 *</label>
                <input
                  type="text"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  placeholder="例如: C001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  disabled={createLoading}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">客戶名稱 *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="例如: 測試客戶"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  disabled={createLoading}
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => {
                  setShowCreateDialog(false);
                  setCreateError(null);
                  setCreateSuccess(null);
                }}
                disabled={createLoading}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
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
                    建立客戶
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
