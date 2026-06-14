/**
 * auth.ts 單元測試 — npm test (vitest, happy-dom)
 * axios 全程 mock,不需要後端。
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
    interceptors: { response: { use: vi.fn(() => 1), eject: vi.fn() } },
  },
}));

import axios from 'axios';
import {
  login,
  logout,
  initAuth,
  fetchCurrentUser,
  getCurrentUser,
  setupAuthInterceptor,
} from './auth';

const TOKEN_KEY = 'wms_token';

beforeEach(() => {
  localStorage.clear();
  axios.defaults.headers.common = {};
  vi.clearAllMocks();
  logout(); // 重置模組內的 currentUser
  localStorage.clear();
});

describe('login', () => {
  it('成功後存 token 並設定 Authorization header', async () => {
    (axios.post as Mock).mockResolvedValue({
      data: { access_token: 'tok-123', token_type: 'bearer' },
    });
    (axios.get as Mock).mockResolvedValue({
      data: { username: 'jerry', role: 'admin' },
    });

    await login('jerry', 'pw');

    expect(axios.post).toHaveBeenCalledWith('/api/v1/auth/login', {
      username: 'jerry',
      password: 'pw',
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-123');
    expect(axios.defaults.headers.common['Authorization']).toContain('tok-123');
    expect(getCurrentUser()?.username).toBe('jerry');
  });

  it('失敗時不寫入 token', async () => {
    (axios.post as Mock).mockRejectedValue(new Error('401'));

    await expect(login('x', 'bad')).rejects.toThrow();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
  });
});

describe('logout', () => {
  it('清除 token、header 與 currentUser', async () => {
    (axios.post as Mock).mockResolvedValue({
      data: { access_token: 'tok-123', token_type: 'bearer' },
    });
    await login('jerry', 'pw');

    logout();

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
    expect(getCurrentUser()).toBeNull();
  });
});

describe('initAuth', () => {
  it('localStorage 有 token 時還原 header 並回 true', () => {
    localStorage.setItem(TOKEN_KEY, 'tok-restored');

    expect(initAuth()).toBe(true);
    expect(axios.defaults.headers.common['Authorization']).toBe('Bearer tok-restored');
  });

  it('沒 token 時回 false', () => {
    expect(initAuth()).toBe(false);
    expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
  });
});

describe('fetchCurrentUser', () => {
  it('成功時設定 currentUser', async () => {
    (axios.get as Mock).mockResolvedValue({
      data: { username: 'jerry', role: 'admin' },
    });

    const user = await fetchCurrentUser();

    expect(axios.get).toHaveBeenCalledWith('/api/v1/auth/me');
    expect(user?.username).toBe('jerry');
    expect(getCurrentUser()?.role).toBe('admin');
  });

  it('失敗(token 過期)時回 null 不拋錯', async () => {
    (axios.get as Mock).mockRejectedValue(new Error('401'));

    expect(await fetchCurrentUser()).toBeNull();
  });
});

describe('401 interceptor', () => {
  it('遇到 401 清除 token 並呼叫 onUnauthorized', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-stale');
    axios.defaults.headers.common['Authorization'] = 'Bearer tok-stale';
    const onUnauthorized = vi.fn();

    setupAuthInterceptor(onUnauthorized);
    // 取出註冊進 axios 的 error handler 直接呼叫
    const errorHandler = (axios.interceptors.response.use as Mock).mock.calls[0][1];
    const err = { response: { status: 401 } };

    await expect(errorHandler(err)).rejects.toBe(err);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
  });

  it('非 401 錯誤不動 token', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-keep');
    const onUnauthorized = vi.fn();

    setupAuthInterceptor(onUnauthorized);
    const errorHandler = (axios.interceptors.response.use as Mock).mock.calls[0][1];
    const err = { response: { status: 500 } };

    await expect(errorHandler(err)).rejects.toBe(err);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-keep');
  });
});
