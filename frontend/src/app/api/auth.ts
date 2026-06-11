import axios from 'axios';

const API_BASE_URL = (import.meta.env as Record<string, string>).VITE_API_URL || '/api/v1';
const TOKEN_KEY = 'wms_token';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  username: string;
  full_name?: string | null;
  role?: string;
}

// Store current user info
let currentUser: UserInfo | null = null;

// Get current user info
export function getCurrentUser(): UserInfo | null {
  return currentUser;
}

// Clear current user info
function clearCurrentUser() {
  currentUser = null;
}

// Login function - POST /api/v1/auth/login
export async function login(username: string, password: string): Promise<void> {
  const response = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/login`, {
    username,
    password,
  });
  
  const token = response.data.access_token;
  const tokenType = response.data.token_type || 'bearer';
  
  // Store token in localStorage
  localStorage.setItem(TOKEN_KEY, token);
  
  // Set axios default header
  axios.defaults.headers.common['Authorization'] = `${tokenType} ${token}`;
  
  // Store user info (from token payload, we'll just use username for now)
  currentUser = { username };
}

// Logout function - clear localStorage and axios default header
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  delete axios.defaults.headers.common['Authorization'];
  clearCurrentUser();
}

// Initialize auth on app startup - restore token from localStorage
export function initAuth(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return true;
  }
  
  return false;
}

// Setup axios response interceptor for 401 errors
export function setupAuthInterceptor(onUnauthorized: () => void): number {
  return axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem(TOKEN_KEY);
        delete axios.defaults.headers.common['Authorization'];
        clearCurrentUser();
        onUnauthorized();
      }
      return Promise.reject(error);
    }
  );
}

// Remove axios interceptor
export function removeAuthInterceptor(interceptorId: number): void {
  axios.interceptors.response.eject(interceptorId);
}