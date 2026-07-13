import type { RefObject } from 'react';
import {
  Calendar,
  CheckCircle,
  MapPin,
  Play,
  Printer,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { PickWaveTask } from '../../types/wms-inventory';
import { StatusBadge } from './StatusBadge';
import type { PickWaveTaskWithPicking } from './types';

interface PickWaveSectionProps {
  pickWave: PickWaveTask[];
  pickWaveWithPicking: PickWaveTaskWithPicking[];
  isPickingMode: boolean;
  isAdmin: boolean;
  pickBarcode: string;
  setPickBarcode: (value: string) => void;
  pickScanRef: RefObject<HTMLInputElement>;
  totalTasks: number;
  confirmedTasks: number;
  pendingTasks: number;
  canConfirmShipment: boolean;
  confirmLoading: boolean;
  onPrintPickWave: () => void;
  onTogglePickingMode: () => void;
  onPickScan: () => void;
  onConfirmShipment: () => void;
  onPickedQtyChange: (taskId: number, value: string) => void;
  onConfirmTask: (task: PickWaveTaskWithPicking) => void;
  onCancelError: (taskId: number) => void;
  onCancelTask: (task: PickWaveTask) => void;
}

function PickingTaskRow({
  task,
  totalTasks,
  onPickedQtyChange,
  onConfirmTask,
  onCancelError,
}: {
  task: PickWaveTaskWithPicking;
  totalTasks: number;
  onPickedQtyChange: (taskId: number, value: string) => void;
  onConfirmTask: (task: PickWaveTaskWithPicking) => void;
  onCancelError: (taskId: number) => void;
}) {
  return (
    <tr
      key={task.sequence}
      className={`border-b border-slate-100 ${task.isConfirmed ? 'bg-green-50/50' : 'bg-white'}`}
    >
      <td className="py-3 px-3">
        <span
          className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-2 py-1 font-bold text-xs ${task.isConfirmed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}
        >
          第 {task.sequence} 站 / 共 {totalTasks} 站
        </span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-blue-600 shrink-0" />
          <span className="text-sm font-mono font-semibold text-blue-600">
            {task.location ?? '—'}
          </span>
        </div>
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">
        {task.internalSku}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">
        {task.internalLotNumber}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-800 whitespace-nowrap">
        {task.internalBarcode}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-700 whitespace-nowrap">
        {task.vendorLotCode}
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={task.pickedQty}
            onChange={(e) => onPickedQtyChange(task.taskId, e.target.value)}
            disabled={task.isConfirmed || task.isConfirming}
            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-xs text-slate-500">/ {task.pickQty.toLocaleString()}</span>
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1 text-sm text-slate-700 whitespace-nowrap">
          <Calendar className="size-3 text-slate-500 shrink-0" />
          {task.receiveDate}
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center justify-center gap-2">
          {task.isConfirmed ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
              <CheckCircle className="size-3" />
              已確認
            </span>
          ) : (
            <>
              <StatusBadge status={task.status} />
              <button
                type="button"
                onClick={() => onConfirmTask(task)}
                disabled={task.isConfirming}
                className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {task.isConfirming ? '確認中...' : '確認'}
              </button>
            </>
          )}
        </div>
        {task.confirmError && (
          <div className="mt-2 flex items-start gap-2">
            <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
              <span className="font-semibold">錯誤: </span>
              {task.confirmError}
            </div>
            <button
              type="button"
              onClick={() => onCancelError(task.taskId)}
              className="text-red-400 hover:text-red-600"
            >
              <span className="text-lg">&times;</span>
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function ReadOnlyTaskRow({
  task,
  totalTasks,
  isAdmin,
  onCancelTask,
}: {
  task: PickWaveTask;
  totalTasks: number;
  isAdmin: boolean;
  onCancelTask: (task: PickWaveTask) => void;
}) {
  return (
    <tr key={task.sequence} className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-3 px-3">
        <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
          第 {task.sequence} 站 / 共 {totalTasks} 站
        </span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-blue-600 shrink-0" />
          <span className="text-sm font-mono font-semibold text-blue-600">
            {task.location ?? '—'}
          </span>
        </div>
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">
        {task.internalSku}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-900 whitespace-nowrap">
        {task.internalLotNumber}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-800 whitespace-nowrap">
        {task.internalBarcode}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-slate-700 whitespace-nowrap">
        {task.vendorLotCode}
      </td>
      <td className="py-3 px-3 text-sm text-right font-semibold text-slate-900">
        {task.pickQty.toLocaleString()} PCS
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1 text-sm text-slate-700 whitespace-nowrap">
          <Calendar className="size-3 text-slate-500 shrink-0" />
          {task.receiveDate}
        </div>
      </td>
      <td className="py-3 px-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <StatusBadge status={task.status} />
          {isAdmin && String(task.status).toUpperCase() !== 'CANCELLED' && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onCancelTask(task)}
            >
              <Trash2 className="size-3" />
              取消
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function PickWaveSection({
  pickWave,
  pickWaveWithPicking,
  isPickingMode,
  isAdmin,
  pickBarcode,
  setPickBarcode,
  pickScanRef,
  totalTasks,
  confirmedTasks,
  pendingTasks,
  canConfirmShipment,
  confirmLoading,
  onPrintPickWave,
  onTogglePickingMode,
  onPickScan,
  onConfirmShipment,
  onPickedQtyChange,
  onConfirmTask,
  onCancelError,
  onCancelTask,
}: PickWaveSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">揀貨波次</h2>
          <p className="text-sm text-slate-500">已依儲位路徑優化排序 · 揀貨時請掃描內部條碼</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrintPickWave}
            disabled={pickWave.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="size-4" />
            列印揀貨單
          </button>
          {isPickingMode ? (
            <button
              type="button"
              onClick={onTogglePickingMode}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              <XCircle className="size-4" />
              離開揀貨模式
            </button>
          ) : (
            <button
              type="button"
              onClick={onTogglePickingMode}
              disabled={
                pickWave.length === 0 ||
                !pickWave.some((t) => String(t.status).toUpperCase() === 'PENDING')
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="size-4" />
              開始揀貨
            </button>
          )}
        </div>
      </div>

      {pickWave.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500">
          無揀貨任務，請先執行配貨
        </div>
      ) : (
        <>
          {isPickingMode && (
            <div className="sticky top-2 z-20 mb-4 rounded-xl border-2 border-blue-300 bg-white p-3 shadow-lg">
              <label className="mb-2 block text-sm font-semibold text-blue-900">
                掃描目前揀貨批次條碼
              </label>
              <div className="flex gap-2">
                <input
                  ref={pickScanRef}
                  autoFocus
                  autoComplete="off"
                  value={pickBarcode}
                  onChange={(event) => setPickBarcode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onPickScan();
                    }
                  }}
                  placeholder="掃描內部條碼後按 Enter"
                  className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 font-mono text-base outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={onPickScan}
                  className="min-h-12 min-w-20 rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
                >
                  確認
                </button>
              </div>
            </div>
          )}

          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-slate-700">
                  <span className="font-semibold">總任務數:</span> {totalTasks}
                </span>
                <span className="text-green-700">
                  <span className="font-semibold">已完成:</span> {confirmedTasks}
                </span>
                <span className="text-orange-700">
                  <span className="font-semibold">待完成:</span> {pendingTasks}
                </span>
              </div>
              {isPickingMode && canConfirmShipment && (
                <button
                  type="button"
                  onClick={onConfirmShipment}
                  disabled={confirmLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-semibold text-lg"
                >
                  <CheckCircle className="size-5" />
                  確認出貨
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[1320px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    序號
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    儲位
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    料號
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    內部批號
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    內部條碼
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    供應商批號
                  </th>
                  <th className="text-right py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    揀貨量
                  </th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    收貨日期
                  </th>
                  <th className="text-center py-3 px-3 text-sm font-medium text-slate-600 whitespace-nowrap">
                    狀態
                  </th>
                </tr>
              </thead>
              <tbody>
                {pickWaveWithPicking.map((task) =>
                  isPickingMode ? (
                    <PickingTaskRow
                      key={task.taskId}
                      task={task}
                      totalTasks={pickWaveWithPicking.length}
                      onPickedQtyChange={onPickedQtyChange}
                      onConfirmTask={onConfirmTask}
                      onCancelError={onCancelError}
                    />
                  ) : (
                    <ReadOnlyTaskRow
                      key={task.taskId}
                      task={task}
                      totalTasks={pickWaveWithPicking.length}
                      isAdmin={isAdmin}
                      onCancelTask={onCancelTask}
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="size-5 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-white text-xs">ⓘ</span>
          </div>
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">路徑優化提示</p>
            <p className="text-blue-700">揀貨路徑已依儲位編號排序，減少行走距離。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
