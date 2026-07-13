import axios from 'axios';

export interface WarehouseOption {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  isEsdControlled: boolean;
}

export interface LocationRow {
  locationId: number;
  locationCode: string;
  locationType: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  isQuarantine: boolean;
  capacityKg: number | null;
  capacityCbm: number | null;
  mslLevel: number | null;
  status: string;
}

export interface LocationCreatePayload {
  warehouseId: number;
  locationCode: string;
  locationType: string;
  isQuarantine: boolean;
  capacityKg?: number | null;
  capacityCbm?: number | null;
}

const base = '/api/v1/locations';

export const listLocations = () => axios.get<LocationRow[]>(base).then((r) => r.data);
export const listWarehouses = () =>
  axios.get<WarehouseOption[]>(`${base}/warehouses`).then((r) => r.data);
export const createLocation = (payload: LocationCreatePayload) =>
  axios.post<LocationRow>(base, payload).then((r) => r.data);
