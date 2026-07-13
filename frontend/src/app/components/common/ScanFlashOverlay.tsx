import { useEffect, useState } from 'react';
import { subscribeScanFlash, type ScanFeedbackKind } from '../../utils/scanFeedback';

const FLASH_MS = 220;

/**
 * 全螢幕掃描回饋色塊（pointer-events-none）。
 * 需掛在 App 與 Toaster 同級，訂閱 notifyScanResult。
 */
export default function ScanFlashOverlay() {
  const [flash, setFlash] = useState<ScanFeedbackKind | null>(null);

  useEffect(() => subscribeScanFlash((kind) => setFlash(kind)), []);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  if (!flash) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[200] transition-opacity duration-150 ${
        flash === 'success' ? 'bg-emerald-500/35' : 'bg-red-600/40'
      }`}
    />
  );
}
