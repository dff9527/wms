import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import {
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ScanLine,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  getVendors,
  getPatterns,
  createPattern,
  togglePattern,
  updatePattern,
  deletePattern,
  parseBarcode,
  learnPattern,
  Vendor,
  BarcodePattern,
  ParseResult,
} from '../api/barcodes';
import { getRole } from '../api/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const Badge = ({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'destructive' | 'default';
}) => {
  let className = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ';
  switch (variant) {
    case 'success':
      className += 'bg-green-100 text-green-800';
      break;
    case 'warning':
      className += 'bg-yellow-100 text-yellow-800';
      break;
    case 'destructive':
      className += 'bg-red-100 text-red-800';
      break;
    default:
      className += 'bg-slate-100 text-slate-800';
  }
  return <span className={className}>{children}</span>;
};

export default function BarcodeRuleModule() {
  // State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [patterns, setPatterns] = useState<BarcodePattern[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // Loading/Error States
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [newPatternName, setNewPatternName] = useState('');
  const [newRegex, setNewRegex] = useState('');
  const [newFieldMapping, setNewFieldMapping] = useState('{}');
  const [newPriority, setNewPriority] = useState<number>(10);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<boolean>(false);

  // AI Learn States
  const [aiSamples, setAiSamples] = useState('');
  const [aiResult, setAiResult] = useState<{ regex?: string; message?: string } | null>(null);
  const [isLearning, setIsLearning] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);

  // Parse Test States
  const [testBarcode, setTestBarcode] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Toggle States
  const [togglingPatternId, setTogglingPatternId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // 顯示已停用規則(預設隱藏:is_active=false)
  const [showInactive, setShowInactive] = useState(false);

  // 編輯對話框
  const [editTarget, setEditTarget] = useState<BarcodePattern | null>(null);
  const [editPatternName, setEditPatternName] = useState('');
  const [editRegex, setEditRegex] = useState('');
  const [editFieldMapping, setEditFieldMapping] = useState('{}');
  const [editPriority, setEditPriority] = useState<number>(10);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 刪除確認對話框
  const [deleteTarget, setDeleteTarget] = useState<BarcodePattern | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 權限檢查
  const isAdmin = getRole() === 'admin';

  // Fetch Vendors on Mount
  useEffect(() => {
    async function fetchVendors() {
      try {
        setLoadingVendors(true);
        const data = await getVendors();
        setVendors(data);
        if (data.length > 0) {
          setSelectedVendorId(data[0].vendor_id);
        }
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to load vendors');
      } finally {
        setLoadingVendors(false);
      }
    }
    fetchVendors();
  }, []);

  // Fetch Patterns when Vendor or showInactive Changes
  useEffect(() => {
    async function fetchPatterns() {
      if (!selectedVendorId) return;

      try {
        setLoadingPatterns(true);
        setError(null);
        const data = await getPatterns(selectedVendorId, showInactive);
        setPatterns(data);
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to load patterns');
      } finally {
        setLoadingPatterns(false);
      }
    }

    if (selectedVendorId) {
      fetchPatterns();
    } else {
      setPatterns([]);
    }
  }, [selectedVendorId, showInactive]);

  // Handlers
  const handleTogglePattern = async (patternId: string, currentActive: boolean) => {
    setTogglingPatternId(patternId);
    setToggleError(null);
    try {
      await togglePattern(patternId, !currentActive);
      // Optimistic update or refetch? Refetch is safer for consistency with plan
      const updatedPatterns = await getPatterns(selectedVendorId);
      setPatterns(updatedPatterns);
    } catch (err: unknown) {
      setToggleError((err as Error).message || '切換狀態失敗');
    } finally {
      setTogglingPatternId(null);
    }
  };

  const handleCreatePattern = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(false);

    let parsedMapping: Record<string, string>;
    try {
      parsedMapping = JSON.parse(newFieldMapping);
    } catch {
      setCreateError('Invalid JSON in field mapping');
      setIsCreating(false);
      return;
    }

    try {
      await createPattern({
        vendor_id: selectedVendorId || null,
        pattern_name: newPatternName,
        regex_rule: newRegex,
        field_mapping: parsedMapping,
        priority: newPriority,
      });

      // Reset Form
      setNewPatternName('');
      setNewRegex('');
      setNewFieldMapping('{}');
      setNewPriority(10);

      // Refetch
      if (selectedVendorId) {
        const data = await getPatterns(selectedVendorId);
        setPatterns(data);
      }
      setCreateSuccess(true);
      setTimeout(() => setCreateSuccess(false), 3000);
    } catch (err: unknown) {
      const errObj = err as Error & { status?: number };
      if (errObj.status === 400) {
        setCreateError(errObj.message || 'Invalid Regex or Payload');
      } else {
        setCreateError(errObj.message || 'Failed to create pattern');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleLearnPattern = async () => {
    setIsLearning(true);
    setAiResult(null);
    setLearnError(null);

    const samples = aiSamples
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (samples.length === 0) {
      setLearnError('請至少輸入一筆樣本條碼');
      setIsLearning(false);
      return;
    }

    try {
      const result = await learnPattern(selectedVendorId || null, samples, true);
      setAiResult({ regex: (result as any).inferred_regex || '', message: 'Success' });
    } catch (err: unknown) {
      const errObj = err as Error & { status?: number };
      if (errObj.status === 503) {
        setLearnError('AI 服務未設定（缺 CLAUDE_API_KEY）');
      } else {
        setLearnError(errObj.message || 'Failed to learn pattern');
      }
    } finally {
      setIsLearning(false);
    }
  };

  const handleParseTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsParsing(true);
    setParseResult(null);
    setParseError(null);

    try {
      const result = await parseBarcode(testBarcode, selectedVendorId || null);
      setParseResult(result);
    } catch (err: unknown) {
      const errObj = err as Error & { status?: number };
      if (errObj.status === 422) {
        setParseError('此條碼不符合任何規則');
      } else {
        setParseError(errObj.message || 'Failed to parse barcode');
      }
    } finally {
      setIsParsing(false);
    }
  };

  // --- Edit handlers ---
  const openEditDialog = (pattern: BarcodePattern) => {
    setEditTarget(pattern);
    setEditPatternName(pattern.pattern_name);
    setEditRegex(pattern.regex_rule);
    setEditFieldMapping(JSON.stringify(pattern.field_mapping, null, 2));
    setEditPriority(pattern.priority);
    setEditError(null);
  };

  const closeEditDialog = () => {
    setEditTarget(null);
    setEditPatternName('');
    setEditRegex('');
    setEditFieldMapping('{}');
    setEditPriority(10);
    setEditError(null);
  };

  const handleUpdatePattern = async () => {
    if (!editTarget) return;
    setEditError(null);
    setIsEditing(true);

    let parsedMapping: Record<string, string>;
    try {
      parsedMapping = JSON.parse(editFieldMapping);
    } catch {
      setEditError('欄位對應不是有效的 JSON');
      setIsEditing(false);
      return;
    }

    try {
      await updatePattern(String(editTarget.pattern_id), {
        pattern_name: editPatternName,
        regex_rule: editRegex,
        field_mapping: parsedMapping,
        priority: editPriority,
      });
      closeEditDialog();
      if (selectedVendorId) {
        const data = await getPatterns(selectedVendorId, showInactive);
        setPatterns(data);
      }
    } catch (err: unknown) {
      setEditError((err as Error).message || '編輯失敗');
    } finally {
      setIsEditing(false);
    }
  };

  // --- Delete handlers ---
  const openDeleteDialog = (pattern: BarcodePattern) => {
    setDeleteTarget(pattern);
    setDeleteError(null);
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleDeletePattern = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deletePattern(String(deleteTarget.pattern_id));
      closeDeleteDialog();
      // 如果停用後清單為空且 showInactive 為 false,保持不變;否則 refetch
      const data = await getPatterns(selectedVendorId, showInactive);
      setPatterns(data);
    } catch (err: unknown) {
      setDeleteError((err as Error).message || '刪除失敗');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6">
      {/* Header / Vendor Selector */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <ScanLine className="w-5 h-5" />
          條碼規則管理
        </h2>

        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-md">
            <label
              htmlFor="vendor-select"
              className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"
            >
              選擇供應商 {loadingVendors && <Loader2 className="inline w-3 h-3 animate-spin" />}
            </label>
            <select
              id="vendor-select"
              value={selectedVendorId || ''}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              disabled={loadingVendors}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="" disabled>
                {loadingVendors
                  ? '載入中...'
                  : vendors.length === 0
                    ? '無可用供應商'
                    : '請選擇供應商'}
              </option>
              {vendors.map((v) => (
                <option key={v.vendor_id} value={v.vendor_id}>
                  {v.vendor_name} ({v.vendor_code})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-red-600 text-sm flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Patterns Table */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-base font-medium text-slate-900">規則列表</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="show-inactive-toggle" className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
              <input
                id="show-inactive-toggle"
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-300"
              />
              顯示已停用
            </label>
          </div>
        </div>

        {toggleError && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {toggleError}
          </div>
        )}

        {loadingPatterns ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">此供應商尚無條碼規則</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                  >
                    規則名稱
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                  >
                    正則表達式
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                  >
                    優先級
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                  >
                    狀態
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
                  >
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {patterns.map((pattern) => (
                  <tr key={pattern.pattern_id} className={pattern.is_active ? '' : 'opacity-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {pattern.pattern_name}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono max-w-xs truncate"
                      title={pattern.regex_rule}
                    >
                      {pattern.regex_rule}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {pattern.priority}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={pattern.is_active ? 'success' : 'default'}>
                        {pattern.is_active ? '啟用' : '停用'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditDialog(pattern)}
                          className="inline-flex items-center text-blue-600 hover:text-blue-900 text-sm font-medium cursor-pointer"
                          aria-label={`編輯 ${pattern.pattern_name}`}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          編輯
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() =>
                                handleTogglePattern(pattern.pattern_id, Boolean(pattern.is_active))
                              }
                              disabled={togglingPatternId === pattern.pattern_id}
                              className="inline-flex items-center text-slate-600 hover:text-slate-900 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label={`切換 ${pattern.pattern_name} 狀態`}
                            >
                              {togglingPatternId === pattern.pattern_id ? (
                                <Loader2 className="inline w-4 h-4 animate-spin mr-1" />
                              ) : (
                                '切換'
                              )}
                            </button>
                            <button
                              onClick={() => openDeleteDialog(pattern)}
                              disabled={isDeleting}
                              className="inline-flex items-center text-red-600 hover:text-red-900 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label={`刪除 ${pattern.pattern_name}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              刪除
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-lg inline-flex mb-6">
          <TabsTrigger
            value="ai"
            className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 transition-all"
          >
            AI 學習(建議)
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 transition-all"
          >
            手動新增規則(進階)
          </TabsTrigger>
        </TabsList>

        {/* Manual Add Tab */}
        <TabsContent value="manual" className="mt-0">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm max-w-2xl">
            <h3 className="text-base font-medium text-slate-900 mb-4">新增條碼規則</h3>

            {/* SOP 說明 */}
            <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">建立規則 SOP</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>拿一張該供應商的實際標籤,掃描或抄下完整條碼內容。</li>
                <li>
                  用「正則表達式」描述條碼結構,並以{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">(?P&lt;名稱&gt;...)</code>{' '}
                  把要擷取的段落命名。
                </li>
                <li>
                  在「欄位對應」把每個命名段落對到系統欄位:
                  <code className="font-mono bg-slate-100 px-1 rounded">vendor_pn</code>
                  (供應商料號)、<code className="font-mono bg-slate-100 px-1 rounded">qty</code>
                  (數量)、<code className="font-mono bg-slate-100 px-1 rounded">lot_code</code>
                  (批號)、<code className="font-mono bg-slate-100 px-1 rounded">date_code</code>
                  (日期碼)。
                </li>
                <li>儲存後到「收貨管理」掃同一張標籤驗證解析結果。</li>
              </ol>
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 font-mono leading-relaxed">
                <p>範例條碼:1PTPS54331DRCR1T30009D2024W15</p>
                <p>{'正則:^1P(?P<pn>[A-Z0-9]{10,15})1T(?P<q>\\d+)9D(?P<dc>\\w+)$'}</p>
                <p>{'欄位對應:{"pn": "vendor_pn", "q": "qty", "dc": "lot_code"}'}</p>
              </div>
              <p className="text-xs text-slate-500">
                不熟悉正則表達式時,建議改用「AI 學習」:貼上 3–5 個實際條碼,系統會自動產生規則。
              </p>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {createError}
              </div>
            )}

            {createSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                規則已成功建立
              </div>
            )}

            <form onSubmit={handleCreatePattern} className="space-y-4">
              <div>
                <label
                  htmlFor="pattern-name"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  規則名稱
                </label>
                <input
                  id="pattern-name"
                  type="text"
                  required
                  value={newPatternName}
                  onChange={(e) => setNewPatternName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., Standard Vendor PN"
                />
              </div>

              <div>
                <label
                  htmlFor="regex-rule"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  正則表達式
                </label>
                <p className="text-xs text-slate-500 mb-1">
                  描述條碼結構的比對規則,用 (?P&lt;名稱&gt;...) 命名要擷取的段落
                </p>
                <input
                  id="regex-rule"
                  type="text"
                  required
                  value={newRegex}
                  onChange={(e) => setNewRegex(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="^([A-Z]{2})(\d{4})$"
                />
              </div>

              <div>
                <label
                  htmlFor="field-mapping"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  欄位對應 (JSON)
                </label>
                <p className="text-xs text-slate-500 mb-1">
                  左邊是正則裡的段落名稱,右邊是系統欄位(vendor_pn / qty / lot_code / date_code)
                </p>
                <textarea
                  id="field-mapping"
                  rows={3}
                  value={newFieldMapping}
                  onChange={(e) => setNewFieldMapping(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder='{"vendor_pn": "group_1", "lot_code": "group_2"}'
                />
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-slate-700 mb-1">
                  優先級
                </label>
                <p className="text-xs text-slate-500 mb-1">
                  同一供應商有多條規則時,數字大的先嘗試比對
                </p>
                <input
                  id="priority"
                  type="number"
                  min="1"
                  max="100"
                  value={newPriority}
                  onChange={(e) => setNewPriority(Number(e.target.value))}
                  className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating || !selectedVendorId}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    建立中...
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    建立規則
                  </>
                )}
              </button>
            </form>
          </div>
        </TabsContent>

        {/* AI Learn Tab */}
        <TabsContent value="ai" className="mt-0">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm max-w-2xl">
            <h3 className="text-base font-medium text-slate-900 mb-4">AI 規則學習</h3>

            <p className="text-sm text-slate-500 mb-4">
              請在下方輸入樣本條碼（每行一筆），系統將嘗試推斷正則表達式規則。
            </p>

            {learnError && (
              <div
                className={`mb-4 p-3 border text-sm rounded flex items-center gap-2 ${learnError.includes('CLAUDE_API_KEY') ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-red-50 border-red-200 text-red-700'}`}
              >
                <AlertTriangle className="w-4 h-4" />
                {learnError}
              </div>
            )}

            <label htmlFor="ai-samples" className="block text-sm font-medium text-slate-700 mb-1">
              樣本條碼（每行一筆）
            </label>
            <textarea
              id="ai-samples"
              rows={6}
              value={aiSamples}
              onChange={(e) => setAiSamples(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-4"
              placeholder={'ABC12345\nDEF67890'}
            />

            <button
              onClick={handleLearnPattern}
              disabled={isLearning || !selectedVendorId || aiSamples.trim().length === 0}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLearning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  學習中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  學習並儲存
                </>
              )}
            </button>

            {aiResult && aiResult.regex && (
              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="text-sm font-medium text-slate-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  推斷規則
                </h4>
                <code className="block bg-white p-3 rounded border border-slate-200 text-sm font-mono break-all">
                  {aiResult.regex}
                </code>
                <p className="text-xs text-slate-500 mt-2">規則已儲存至資料庫。</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Pattern Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯條碼規則</DialogTitle>
            <DialogDescription>
              修改「{editTarget?.pattern_name}」的規則設定。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-pattern-name">規則名稱</Label>
              <Input
                id="edit-pattern-name"
                type="text"
                value={editPatternName}
                onChange={(e) => setEditPatternName(e.target.value)}
                placeholder="輸入規則名稱"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-regex">正則表達式</Label>
              <Input
                id="edit-regex"
                type="text"
                value={editRegex}
                onChange={(e) => setEditRegex(e.target.value)}
                placeholder="^([A-Z]{2})(\\d{4})$"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-field-mapping">欄位對應 (JSON)</Label>
              <textarea
                id="edit-field-mapping"
                rows={4}
                value={editFieldMapping}
                onChange={(e) => setEditFieldMapping(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder='{"pn": "vendor_pn", "q": "qty"}'
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-priority">優先級</Label>
              <Input
                id="edit-priority"
                type="number"
                min="1"
                max="100"
                value={editPriority}
                onChange={(e) => setEditPriority(Number(e.target.value))}
                className="w-32"
              />
            </div>

            {editError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditDialog}>
              取消
            </Button>
            <Button
              type="button"
              onClick={handleUpdatePattern}
              disabled={isEditing}
            >
              {isEditing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  儲存中...
                </>
              ) : (
                '儲存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除條碼規則</DialogTitle>
            <DialogDescription>
              確定要停用「{deleteTarget?.pattern_name}」嗎？此操作會將規則設為停用狀態，可在「顯示已停用」中重新啟用。
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDeleteDialog}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeletePattern}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  確認停用
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Parse Box */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm max-w-2xl self-start">
        <h3 className="text-base font-medium text-slate-900 mb-4">測試解析</h3>

        <form onSubmit={handleParseTest} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="test-barcode" className="block text-sm font-medium text-slate-700 mb-1">
              條碼
            </label>
            <input
              id="test-barcode"
              type="text"
              value={testBarcode}
              onChange={(e) => setTestBarcode(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="輸入條碼進行測試..."
            />
          </div>
          <button
            type="submit"
            disabled={isParsing || !selectedVendorId || !testBarcode.trim()}
            className="inline-flex items-center justify-center rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
          >
            {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : '解析'}
          </button>
        </form>

        {/* Parse Results */}
        {(parseResult || parseError) && (
          <div className="mt-4">
            {parseError ? (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {parseError}
              </div>
            ) : parseResult ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <span className="block text-xs font-medium text-green-800 uppercase tracking-wider">
                    供應商料號
                  </span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {parseResult.vendor_pn}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-green-800 uppercase tracking-wider">
                    數量
                  </span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {parseResult.qty}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-green-800 uppercase tracking-wider">
                    批號
                  </span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {parseResult.lot_code || '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-green-800 uppercase tracking-wider">
                    日期碼
                  </span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {parseResult.date_code || '-'}
                  </span>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <span className="block text-xs font-medium text-green-800 uppercase tracking-wider">
                    使用規則
                  </span>
                  <span className="inline-block mt-1 px-2 py-1 bg-white border border-green-200 rounded text-xs font-mono text-slate-700">
                    {parseResult.pattern_used}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
