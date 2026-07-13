import axios from 'axios';

const API_BASE_URL = '/api/v1';

export interface ReplenishmentTask {
  taskId: number;
  internalSku: string;
  lotId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  status: string;
}

export interface ReplenishmentRuleUpdate {
  internalSku: string;
  minimumQty: number;
  maximumQty: number;
}

export async function listReplenishmentTasks(): Promise<ReplenishmentTask[]> {
  const response = await axios.get<ReplenishmentTask[]>(`${API_BASE_URL}/replenishment/tasks`);
  return response.data;
}

export async function generateReplenishmentTasks(): Promise<ReplenishmentTask[]> {
  const response = await axios.post<ReplenishmentTask[]>(`${API_BASE_URL}/replenishment/generate`);
  return response.data;
}

export async function completeReplenishmentTask(taskId: number): Promise<ReplenishmentTask> {
  const response = await axios.post<ReplenishmentTask>(
    `${API_BASE_URL}/replenishment/tasks/${taskId}/complete`
  );
  return response.data;
}

export async function updateReplenishmentRule(
  locationId: number,
  rule: ReplenishmentRuleUpdate
): Promise<{ success: boolean }> {
  const response = await axios.put(`${API_BASE_URL}/replenishment/locations/${locationId}/rule`, rule);
  return response.data;
}

export async function listStorageLocations(): Promise<
  Array<{ locationId: number; locationCode: string }>
> {
  const response = await axios.get(`${API_BASE_URL}/cycle-counts/locations`);
  return response.data;
}

export async function listItemsForDropdown(): Promise<
  Array<{ internalSku: string; description: string }>
> {
  const response = await axios.get(`${API_BASE_URL}/purchase-orders/items`);
  return response.data;
}
