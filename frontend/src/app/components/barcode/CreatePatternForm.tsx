import type { FormEvent } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { PlusCircle, AlertTriangle, Loader2 } from 'lucide-react';
import AutoPatternForm from './AutoPatternForm';

interface CreatePatternFormProps {
  selectedVendorId: string;
  onPatternCreated: () => void;
  newPatternName: string;
  setNewPatternName: (value: string) => void;
  newRegex: string;
  setNewRegex: (value: string) => void;
  newFieldMapping: string;
  setNewFieldMapping: (value: string) => void;
  newPriority: number;
  setNewPriority: (value: number) => void;
  createError: string | null;
  isCreating: boolean;
  onCreatePattern: (e: FormEvent) => void;
}

export default function CreatePatternForm({
  selectedVendorId,
  onPatternCreated,
  newPatternName,
  setNewPatternName,
  newRegex,
  setNewRegex,
  newFieldMapping,
  setNewFieldMapping,
  newPriority,
  setNewPriority,
  createError,
  isCreating,
  onCreatePattern,
}: CreatePatternFormProps) {
  return (
    <Tabs defaultValue="auto" className="w-full">
      <TabsList className="bg-slate-100 p-1 rounded-lg inline-flex mb-6">
        <TabsTrigger
          value="auto"
          className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 transition-all"
        >
          自動產生(建議)
        </TabsTrigger>
        <TabsTrigger
          value="manual"
          className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 transition-all"
        >
          手動新增規則(進階)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="auto" className="mt-0">
        <AutoPatternForm selectedVendorId={selectedVendorId} onCreated={onPatternCreated} />
      </TabsContent>

      <TabsContent value="manual" className="mt-0">
        <ManualPatternForm
          selectedVendorId={selectedVendorId}
          newPatternName={newPatternName}
          setNewPatternName={setNewPatternName}
          newRegex={newRegex}
          setNewRegex={setNewRegex}
          newFieldMapping={newFieldMapping}
          setNewFieldMapping={setNewFieldMapping}
          newPriority={newPriority}
          setNewPriority={setNewPriority}
          createError={createError}
          isCreating={isCreating}
          onCreatePattern={onCreatePattern}
        />
      </TabsContent>
    </Tabs>
  );
}

function ManualPatternForm({
  selectedVendorId,
  newPatternName,
  setNewPatternName,
  newRegex,
  setNewRegex,
  newFieldMapping,
  setNewFieldMapping,
  newPriority,
  setNewPriority,
  createError,
  isCreating,
  onCreatePattern,
}: Omit<CreatePatternFormProps, 'onPatternCreated'>) {
  return (
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
      </div>

      {createError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {createError}
        </div>
      )}

      <form onSubmit={onCreatePattern} className="space-y-4">
        <div>
          <label htmlFor="pattern-name" className="block text-sm font-medium text-slate-700 mb-1">
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
          <label htmlFor="regex-rule" className="block text-sm font-medium text-slate-700 mb-1">
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
          <label htmlFor="field-mapping" className="block text-sm font-medium text-slate-700 mb-1">
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
          <p className="text-xs text-slate-500 mb-1">同一供應商有多條規則時,數字大的先嘗試比對</p>
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
  );
}
