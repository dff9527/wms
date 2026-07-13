import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, CheckCircle, XCircle, Pencil, Trash2, ListChecks } from 'lucide-react';
import { getRole } from '../api/auth';
import { getVendors, type Vendor } from '../api/barcodes';
import {
  listCustomers,
  parseApprovedVendorIds,
  updateCustomer,
  type Customer,
} from '../api/customers';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

export default function CustomerModule() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [avlTarget, setAvlTarget] = useState<Customer | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<number[]>([]);
  const [avlLoading, setAvlLoading] = useState(false);
  const [avlSaving, setAvlSaving] = useState(false);

  const isAdmin = getRole() === 'admin';

  const fetchCustomers = async () => {
    try {
      const data = await listCustomers(showInactive);
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers', err);
      toast.error('載入客戶清單失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const handleCreateCustomer = async () => {
    if (!customerCode.trim()) {
      toast.error('客戶代碼不可空白');
      return;
    }
    if (!customerName.trim()) {
      toast.error('客戶名稱不可空白');
      return;
    }

    setCreateLoading(true);
    try {
      await axios.post('/api/v1/customers/', {
        customer_code: customerCode.trim(),
        customer_name: customerName.trim(),
        is_active: true,
      });
      toast.success('客戶建立成功');
      setCustomerCode('');
      setCustomerName('');
      setShowCreateDialog(false);
      await fetchCustomers();
    } catch (err: any) {
      const detail = err.response?.data?.detail || '建立客戶失敗';
      toast.error(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setCreateLoading(false);
    }
  };

  const openEdit = (customer: Customer) => {
    setEditTarget(customer);
    setEditName(customer.customer_name);
    setEditActive(customer.is_active);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      toast.error('客戶名稱不可空白');
      return;
    }
    setEditLoading(true);
    try {
      await updateCustomer(editTarget.customer_id, {
        customer_name: editName.trim(),
        is_active: editActive,
      });
      toast.success('客戶已更新');
      setEditTarget(null);
      await fetchCustomers();
    } catch (err: any) {
      const detail = err.response?.data?.detail || '更新失敗';
      toast.error(Array.isArray(detail) ? detail.join(', ') : String(detail));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`/api/v1/customers/${deleteTarget.customer_id}`);
      toast.success('客戶已停用');
      setDeleteTarget(null);
      await fetchCustomers();
    } catch (err: any) {
      const detail = err.response?.data?.detail || '刪除失敗';
      toast.error(Array.isArray(detail) ? detail.join(', ') : String(detail));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openAvl = async (customer: Customer) => {
    setAvlTarget(customer);
    setSelectedVendorIds(parseApprovedVendorIds(customer.approved_avl));
    setAvlLoading(true);
    try {
      const list = await getVendors();
      setVendors(list.filter((v) => v.is_active));
    } catch {
      toast.error('載入供應商清單失敗');
      setAvlTarget(null);
    } finally {
      setAvlLoading(false);
    }
  };

  const toggleVendor = (vendorId: number) => {
    setSelectedVendorIds((current) =>
      current.includes(vendorId)
        ? current.filter((id) => id !== vendorId)
        : [...current, vendorId]
    );
  };

  const handleSaveAvl = async () => {
    if (!avlTarget) return;
    setAvlSaving(true);
    try {
      await updateCustomer(avlTarget.customer_id, {
        approved_avl:
          selectedVendorIds.length === 0
            ? null
            : { approved_vendors: selectedVendorIds },
      });
      toast.success('AVL 已更新');
      setAvlTarget(null);
      await fetchCustomers();
    } catch (err: any) {
      const detail = err.response?.data?.detail || '更新 AVL 失敗';
      toast.error(Array.isArray(detail) ? detail.join(', ') : String(detail));
    } finally {
      setAvlSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">客戶管理</h2>
            <p className="text-sm text-slate-500 mt-1">管理所有客戶資料</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-300"
              />
              顯示已停用
            </label>
            <button
              type="button"
              onClick={() => {
                setShowCreateDialog(true);
                setCustomerCode('');
                setCustomerName('');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="size-4" />
              新增客戶
            </button>
          </div>
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
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">客戶代碼</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">客戶名稱</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">核可供應商</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">啟用狀態</th>
                  {isAdmin && (
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const avlCount = parseApprovedVendorIds(customer.approved_avl).length;
                  return (
                    <tr
                      key={customer.customer_id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 text-sm font-mono text-slate-900">
                        {customer.customer_code}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900">{customer.customer_name}</td>
                      <td className="py-3 px-4 text-center text-sm text-slate-700">
                        {avlCount === 0 ? '未設定' : `${avlCount} 家`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {customer.is_active ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700"
                            title="is_active=true"
                          >
                            <CheckCircle className="size-3" />
                            啟用
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700"
                            title="is_active=false"
                          >
                            <XCircle className="size-3" />
                            停用
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openAvl(customer)}
                            >
                              <ListChecks className="size-3" />
                              AVL 設定
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(customer)}
                            >
                              <Pencil className="size-3" />
                              編輯
                            </Button>
                            {customer.is_active && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setDeleteTarget(customer)}
                              >
                                <Trash2 className="size-3" />
                                刪除
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">新增客戶</h3>
              <button
                type="button"
                onClick={() => setShowCreateDialog(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">客戶代碼 *</label>
                <input
                  type="text"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  placeholder="例如: C001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={createLoading}
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => setShowCreateDialog(false)}
                disabled={createLoading}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={createLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="size-4" />
                {createLoading ? '建立中...' : '建立客戶'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯客戶</DialogTitle>
            <DialogDescription>
              修改「{editTarget?.customer_code}」的名稱與啟用狀態。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">客戶名稱 *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={editLoading}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                disabled={editLoading}
              />
              啟用
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              取消
            </Button>
            <Button type="button" onClick={handleEdit} disabled={editLoading}>
              {editLoading ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要停用「{deleteTarget?.customer_name}」嗎？此操作會將客戶設為停用，可在「顯示已停用」中重新啟用。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              <Trash2 className="size-4" />
              {deleteLoading ? '處理中...' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AVL settings */}
      <Dialog open={!!avlTarget} onOpenChange={(open) => !open && setAvlTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AVL 設定</DialogTitle>
            <DialogDescription>
              設定「{avlTarget?.customer_code}」核可供應商。未設定 AVL = 不過濾,配貨時所有供應商批次皆可用
            </DialogDescription>
          </DialogHeader>
          {avlLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : vendors.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">尚無供應商資料</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {vendors.map((vendor) => {
                const id = Number(vendor.vendor_id);
                return (
                  <label
                    key={vendor.vendor_id}
                    className="flex items-center gap-3 rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedVendorIds.includes(id)}
                      onChange={() => toggleVendor(id)}
                      disabled={avlSaving}
                    />
                    <span className="font-mono text-slate-800">{vendor.vendor_code}</span>
                    <span className="text-slate-600">{vendor.vendor_name}</span>
                  </label>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAvlTarget(null)}>
              取消
            </Button>
            <Button type="button" onClick={handleSaveAvl} disabled={avlLoading || avlSaving}>
              {avlSaving ? '儲存中...' : '儲存 AVL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
