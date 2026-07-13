import axios from 'axios';

// 一律走相對路徑(dev 由 Vite proxy、正式由 nginx 轉發),不依賴 VITE_API_URL
const API_BASE_URL = '';

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

export async function createVendor(vendorCode: string, vendorName: string): Promise<Vendor> {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/v1/vendors`, {
      vendor_code: vendorCode,
      vendor_name: vendorName,
    });
    return res.data;
  } catch (err) {
    return handleAxiosError(err);
  }
}

export async function getPatterns(
  vendorId?: string | null,
  includeInactive = false
): Promise<BarcodePattern[]> {
  try {
    const params = new URLSearchParams();
    if (vendorId) params.set('vendor_id', vendorId);
    if (includeInactive) params.set('include_inactive', 'true');
    const qs = params.toString();
    const res = await axios.get(
      `${API_BASE_URL}/api/v1/barcodes/patterns${qs ? `?${qs}` : ''}`
    );
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

export async function createPattern(
  payload: CreatePatternPayload
): Promise<{ pattern_id: string }> {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/v1/barcodes/patterns`, payload);
    return res.data;
  } catch (err) {
    return handleAxiosError(err);
  }
}

export async function togglePattern(patternId: string, isActive: boolean): Promise<void> {
  try {
    await axios.patch(`${API_BASE_URL}/api/v1/barcodes/patterns/${patternId}`, {
      is_active: isActive,
    });
  } catch (err) {
    return handleAxiosError(err);
  }
}

export interface UpdatePatternPayload {
  pattern_name?: string;
  regex_rule?: string;
  field_mapping?: Record<string, string>;
  priority?: number;
}

export async function updatePattern(
  patternId: string,
  payload: UpdatePatternPayload
): Promise<void> {
  try {
    await axios.patch(`${API_BASE_URL}/api/v1/barcodes/patterns/${patternId}`, payload);
  } catch (err) {
    return handleAxiosError(err);
  }
}

export async function deletePattern(patternId: string): Promise<void> {
  try {
    await axios.delete(`${API_BASE_URL}/api/v1/barcodes/patterns/${patternId}`);
  } catch (err) {
    return handleAxiosError(err);
  }
}

export async function parseBarcode(barcode: string, vendorId: string | null): Promise<ParseResult> {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/v1/barcodes/parse`, {
      barcode,
      vendor_id: vendorId,
    });
    return res.data;
  } catch (err) {
    return handleAxiosError(err);
  }
}

export interface LearnPatternResponse {
  inferred_regex?: string;
  [key: string]: unknown;
}

export async function learnPattern(
  vendorId: string | null,
  samples: string[],
  savePattern: boolean
): Promise<LearnPatternResponse> {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/v1/barcodes/learn`, {
      vendor_id: vendorId,
      samples,
      save_pattern: savePattern,
    });
    return res.data;
  } catch (err) {
    return handleAxiosError(err);
  }
}
