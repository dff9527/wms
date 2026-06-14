'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { ScanBarcodeIcon } from 'lucide-react'; // Assuming lucide icons are used per common shadcn projects

interface BarcodeScannerProps {
  /**
   * When value is provided, the parent is responsible for clearing it (e.g. inside the onScan handler).
   * The component will not auto-clear via onChange.
   */
  value?: string;
  onChange?: (v: string) => void;
  onScan: (barcode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Controlled, keyboard-wedge-friendly barcode input component.
 *
 * Features:
 * - Captures scanned or typed barcode strings.
 * - Submits on Enter key press (standard for keyboard wedges).
 * - Provides a manual "Scan" button for UI interaction.
 * - Ignores empty/whitespace-only inputs.
 * - Uses existing shadcn Input and Button components.
 * - Provides visual feedback (green ring) and text confirmation after a successful scan.
 */
export function BarcodeScanner({
  value,
  onChange,
  onScan,
  placeholder = '請掃描或輸入條碼...',
  disabled = false,
  autoFocus = false,
}: BarcodeScannerProps) {
  const [internalValue, setInternalValue] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const [lastScanned, setLastScanned] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal state if controlled via props
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleSubmit = () => {
    const trimmedValue = internalValue.trim();

    if (!trimmedValue) {
      return; // No-op for empty input
    }

    onScan(trimmedValue);

    // Set success state and last scanned value
    setLastScanned(trimmedValue);
    setScanSuccess(true);

    // Schedule reset of success state
    setTimeout(() => {
      setScanSuccess(false);
    }, 800);

    // Clear input after successful scan if not strictly controlled externally preventing it
    // If 'value' prop is provided, the parent controls clearing.
    // If uncontrolled (no value prop), we clear locally.
    if (value === undefined) {
      setInternalValue('');
    }

    // Refocus input for rapid scanning
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex w-full max-w-full items-center gap-2">
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="text"
            value={internalValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 font-mono text-sm"
            aria-label="Barcode Input"
            autoComplete="off"
            autoFocus={autoFocus}
          />
          <Button
            onClick={handleSubmit}
            disabled={disabled || !internalValue.trim()}
            variant="outline"
            size="icon"
            title="解析條碼"
            className={`min-h-[44px] min-w-[44px] ${scanSuccess ? 'ring-2 ring-green-500' : ''}`}
          >
            <ScanBarcodeIcon className="h-4 w-4" />
            <span className="sr-only">解析</span>
          </Button>
        </div>
        {lastScanned && (
          <p className="mt-1 text-xs text-slate-500">
            上次掃描: <span className="font-mono text-slate-700">{lastScanned}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default BarcodeScanner;
