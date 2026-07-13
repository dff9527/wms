import axios from 'axios';

export interface Customer {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  approved_avl?: ApprovedAvl | null;
  is_active: boolean;
}

/** Shape expected by picking AVL filter (`customer_avl.approved_vendors`). */
export interface ApprovedAvl {
  approved_vendors: number[];
}

export function parseApprovedVendorIds(avl: unknown): number[] {
  if (!avl || typeof avl !== 'object') return [];
  const vendors = (avl as ApprovedAvl).approved_vendors;
  if (!Array.isArray(vendors)) return [];
  return vendors.map(Number).filter((id) => Number.isFinite(id));
}

export async function listCustomers(includeInactive = false): Promise<Customer[]> {
  const response = await axios.get('/api/v1/customers/', {
    params: { include_inactive: includeInactive || undefined },
  });
  return response.data;
}

export async function updateCustomer(
  customerId: number,
  payload: {
    customer_name?: string;
    approved_avl?: ApprovedAvl | null;
    is_active?: boolean;
  }
): Promise<Customer> {
  const response = await axios.patch(`/api/v1/customers/${customerId}`, payload);
  return response.data;
}
