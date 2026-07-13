import axios from 'axios';

export interface CountLine {
  lineId: number;
  locationId: number;
  locationCode: string;
  lotId: number;
  internalSku: string;
  internalLotNumber: string;
  expectedQuantity: number | null;
  countedQuantity: number | null;
  variance: number | null;
  notes: string | null;
}

export interface CycleCount {
  cycleCountId: number;
  countNumber: string;
  status: string;
  createdBy: string;
  reviewedBy: string | null;
  createdAt: string;
  lines: CountLine[];
}

const base = '/api/v1/cycle-counts';

export const listCycleCounts = () => axios.get<CycleCount[]>(base).then((r) => r.data);
export const listCountLocations = () =>
  axios
    .get<Array<{ locationId: number; locationCode: string }>>(`${base}/locations`)
    .then((r) => r.data);
export const createCycleCount = (locationIds: number[], internalSkus?: string[]) =>
  axios.post<CycleCount>(base, { locationIds, internalSkus }).then((r) => r.data);
export const freezeCycleCount = (id: number) =>
  axios.post<CycleCount>(`${base}/${id}/freeze`).then((r) => r.data);
export const saveCountEntries = (
  id: number,
  entries: Array<{ lineId: number; countedQuantity: number }>
) => axios.put<CycleCount>(`${base}/${id}/entries`, { entries }).then((r) => r.data);
export const submitCycleCount = (id: number) =>
  axios.post<CycleCount>(`${base}/${id}/submit`).then((r) => r.data);
export const reviewCycleCount = (id: number, approve: boolean) =>
  axios.post<CycleCount>(`${base}/${id}/${approve ? 'approve' : 'reject'}`).then((r) => r.data);
