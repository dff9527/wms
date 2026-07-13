export type ScanFeedbackKind = 'success' | 'error';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume = 0.18
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/** Web Audio 短音：成功偏高、失敗偏低雙音。AudioContext 被擋時靜默略過。 */
export function playScanSound(kind: ScanFeedbackKind): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    void ctx.resume();
    const now = ctx.currentTime;
    if (kind === 'success') {
      playTone(ctx, 880, now, 0.12);
      playTone(ctx, 1175, now + 0.1, 0.14);
    } else {
      playTone(ctx, 220, now, 0.16, 0.22);
      playTone(ctx, 180, now + 0.18, 0.2, 0.22);
    }
  } catch {
    // ignore autoplay / unsupported audio failures
  }
}

type FlashListener = (kind: ScanFeedbackKind) => void;
const flashListeners = new Set<FlashListener>();

export function subscribeScanFlash(listener: FlashListener): () => void {
  flashListeners.add(listener);
  return () => {
    flashListeners.delete(listener);
  };
}

function emitScanFlash(kind: ScanFeedbackKind): void {
  flashListeners.forEach((listener) => listener(kind));
}

/** 掃描結果回饋：音效 + 全螢幕色塊閃爍（需掛載 ScanFlashOverlay）。 */
export function notifyScanResult(kind: ScanFeedbackKind): void {
  playScanSound(kind);
  emitScanFlash(kind);
}
