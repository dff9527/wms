import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Loader2, Wand2 } from 'lucide-react';
import { createPattern, inferPattern, InferResult } from '../../api/barcodes';

interface AutoPatternFormProps {
  selectedVendorId: string;
  onCreated: () => void;
}

const FIELD_INPUTS: { key: string; label: string; required?: boolean }[] = [
  { key: 'vendor_pn', label: '供應商料號', required: true },
  { key: 'qty', label: '數量' },
  { key: 'lot_code', label: '批號' },
  { key: 'date_code', label: '日期碼' },
];

const FIELD_LABELS: Record<string, string> = {
  vendor_pn: '供應商料號',
  qty: '數量',
  lot_code: '批號',
  date_code: '日期碼',
};

export default function AutoPatternForm({ selectedVendorId, onCreated }: AutoPatternFormProps) {
  const [samplesText, setSamplesText] = useState('');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [patternName, setPatternName] = useState('');
  const [result, setResult] = useState<InferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInferring, setIsInferring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const samples = samplesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const firstSample = samples[0] ?? '';

  const handleInfer = async () => {
    setError(null);
    setResult(null);
    if (samples.length === 0) {
      setError('請至少貼上一筆條碼樣本');
      return;
    }
    if (!labels.vendor_pn?.trim()) {
      setError('請填寫「供應商料號」在第一筆樣本中的值');
      return;
    }
    setIsInferring(true);
    try {
      const inferred = await inferPattern(samples, labels);
      setResult(inferred);
    } catch (err) {
      setError((err as Error).message || '推導失敗');
    } finally {
      setIsInferring(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setError(null);
    setIsSaving(true);
    try {
      await createPattern({
        vendor_id: selectedVendorId,
        pattern_name: patternName.trim() || `AUTO_${new Date().toISOString().slice(0, 10)}`,
        regex_rule: result.regex_rule,
        field_mapping: result.field_mapping,
        priority: 10,
      });
      toast.success('規則已建立');
      setSamplesText('');
      setLabels({});
      setPatternName('');
      setResult(null);
      onCreated();
    } catch (err) {
      setError((err as Error).message || '儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm max-w-2xl">
      <h3 className="text-base font-medium text-slate-900 mb-1">自動產生規則</h3>
      <p className="text-sm text-slate-500 mb-4">
        貼上 2–5 個同供應商的條碼,再告訴系統第一筆條碼裡各欄位的「實際值」,
        系統會自動歸納出規則——不需要懂正則表達式。
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <label htmlFor="auto-samples" className="block text-sm font-medium text-slate-700 mb-1">
        條碼樣本(每行一筆,第一筆用來標註)
      </label>
      <textarea
        id="auto-samples"
        rows={5}
        value={samplesText}
        onChange={(e) => {
          setSamplesText(e.target.value);
          setResult(null);
        }}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-4"
        placeholder={'1PTPS54331DRCR1T30009D2024W15\n1PLM358DR1T15009D2023W44'}
      />

      {firstSample && (
        <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-medium text-slate-800 mb-1">
            第一筆樣本:<code className="font-mono">{firstSample}</code>
          </p>
          <p className="text-xs text-slate-500 mb-3">
            從上面這串條碼中,把對應欄位的值原封不動複製到下面(用不到的欄位留空):
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FIELD_INPUTS.map(({ key, label, required }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {label}
                  {required ? <span className="text-red-500"> *</span> : ''}
                </label>
                <input
                  value={labels[key] ?? ''}
                  onChange={(e) => {
                    setLabels((prev) => ({ ...prev, [key]: e.target.value }));
                    setResult(null);
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={key === 'vendor_pn' ? '如 TPS54331DRCR' : ''}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleInfer}
        disabled={isInferring || !selectedVendorId || samples.length === 0}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isInferring ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            推導中...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            產生規則
          </>
        )}
      </button>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="text-sm font-medium text-slate-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              推導結果(已用全部樣本驗證)
            </h4>
            <code className="block bg-white p-3 rounded border border-slate-200 text-xs font-mono break-all">
              {result.regex_rule}
            </code>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">條碼</th>
                  {Object.keys(result.field_mapping).map((field) => (
                    <th key={field} className="px-3 py-2 text-left font-medium text-slate-600">
                      {FIELD_LABELS[field] ?? field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.previews.map((preview) => (
                  <tr key={preview.barcode} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {preview.barcode}
                    </td>
                    {Object.keys(result.field_mapping).map((field) => (
                      <td key={field} className="px-3 py-2 font-mono text-slate-900">
                        {preview.parsed[field]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                規則名稱(選填)
              </label>
              <input
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="預設 AUTO_日期"
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  儲存中...
                </>
              ) : (
                '確認儲存規則'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
