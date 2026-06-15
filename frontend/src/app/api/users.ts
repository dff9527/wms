import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// 一律走相對路徑(dev 由 Vite proxy、正式由 nginx 轉發),不依賴 VITE_API_URL
const API_BASE_URL = '/api/v1';

export interface User {
  user_id: number;
  username: string;
  full_name?: string | null;
  role: 'admin' | 'qc' | 'supervisor' | 'operator';
  is_active: boolean;
}

export async function getUsers(): Promise<User[]> {
  const response = await axios.get(`${API_BASE_URL}/users`);
  return response.data;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: 'admin' | 'qc' | 'supervisor' | 'operator';
  full_name?: string;
}): Promise<User> {
  const response = await axios.post(`${API_BASE_URL}/users`, payload);
  return response.data;
}

export async function updateUser(userId: number, payload: Partial<Pick<User, 'role' | 'full_name' | 'is_active'>>): Promise<User> {
  const response = await axios.patch(`${API_BASE_URL}/users/${userId}`, payload);
  return response.data;
}

export async function updateUserPassword(userId: number, newPassword: string): Promise<{ success: true }> {
  const response = await axios.post(`${API_BASE_URL}/users/${userId}/password`, { new_password: newPassword });
  return response.data;
}

// React Query Hooks

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createUser>[0]) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUserPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
      updateUserPassword(userId, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
