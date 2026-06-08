import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Vendor {
  vendor_id: string;
  vendor_code: string;
  vendor_name: string;
  is_active: boolean;
}

export interface BarcodePattern {
  pattern_id: string;
  vendor_id: string | null;
  pattern_name: string;
  regex_rule: string;
  field_mapping: Record<string, string>;
  validation_rules?: Record<string, unknown>;
  priority: number;
  is_active: boolean;
}

export interface ParseResult {
  vendor_pn: string;
  qty: number;
  lot_code: string;
  date_code: string;
  pattern_used: string;
}

interface ApiError extends Error {
  status?: number;
}

function handleAxiosError(err: unknown): never {
  const apiErr = err as { response?: { data?: { detail?: string }; status?: number } };
  const message = apiErr.response?.data?.detail || 'Unknown error occurred';
  const error: ApiError = new Error(message);
  if (apiErr.response?.status) {
    error.status = apiErr.response.status;
   }
  throw error;
}

export async function getVendors(): Promise<Vendor[]> {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/v1/vendors`);
    return res.data;
   } catch (err) {
    return handleAxiosError(err);
   }
}

export async function getPatterns(vendorId?: string | null): Promise<BarcodePattern[]> {
  try {
    const params = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    const res = await axios.get(`${API_BASE_URL}/api/v1/barcodes/patterns${params}`);
    return res.data;
   } catch (err) {
    return handleAxiosError(err);
   }
}

export interface CreatePatternPayload {
  vendor_id: string | null;
  pattern_name: string;
  regex_rule: string;
  field_mapping: Record<string, string>;
  validation_rules?: Record<string, unknown>;
  priority?: number;
}

export async function createPattern(payload: CreatePatternPayload): Promise<{ pattern_id: string }> {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/v1/barcodes/patterns`, payload);
    return res.data;
   } catch (err) {
    return handleAxiosError(err);
   }
}

export async function togglePattern(patternId: string, isActive: boolean): Promise<void> {
  try {
    await axios.patch(`${API_BASE_URL}/api/v1/barcodes/patterns/${patternId}`, { is_active: isActive });
   } catch (err) {
    return handleAxiosError(err);
   }
}

export async function parseBarcode(barcode: string, vendorId: string | null): Promise<ParseResult> {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/v1/barcodes/parse`, { barcode, vendor_id: vendorId });
    return res.data;
   } catch (err) {
    return handleAxiosError(err);
   }
}

export interface LearnPatternResponse {
  inferred_regex?: string;
   [key: string]: unknown;
}

export async function learnPattern(vendorId: string | null, samples: string[], savePattern: boolean): Promise<LearnPatternResponse> {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/v1/barcodes/learn`, { vendor_id: vendorId, samples, save_pattern: savePattern });
    return res.data;
   } catch (err) {
    return handleAxiosError(err);
   }
}
