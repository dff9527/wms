/**
 * Modules smoke test — render only, no backend required
 * 用 happy-dom 測試 React 組件是否能成功渲染且標題文字可見
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock axios — get/post 一律回 resolved 空資料
vi.mock('axios', () => ({
  default: {
    get: vi.fn((url) => {
      // Special mock for /api/v1/receiving/list endpoint (回特定格式)
      if (url && url.includes('/api/v1/receiving/list')) {
        return Promise.resolve({ data: { items: [], total: 0 } });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: [] }),
    defaults: { headers: { common: {} as Record<string, string> } },
    interceptors: { response: { use: vi.fn(() => 1), eject: vi.fn() } },
  },
}));

// Import modules AFTER mocking
import DashboardModule from '../DashboardModule';
import ReceivingModule from '../ReceivingModule';
import InventoryModule from '../InventoryModule';
import PickingModule from '../PickingModule';
import TraceabilityModule from '../TraceabilityModule';
import BarcodeRuleModule from '../BarcodeRuleModule';

// Helper to create QueryClient wrapper
function withQueryClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('Modules smoke test', () => {
  describe('DashboardModule', () => {
    it('render 不拋例外且可找到「總庫存量」', async () => {
      render(withQueryClient(<DashboardModule />));
      // 等待「總庫存量」文字出現
      const title = await screen.findByText('總庫存量');
      expect(title).toBeInTheDocument();
    });
  });

  describe('ReceivingModule', () => {
    it('render 不拋例外且可找到「條碼掃描與解析」', async () => {
      render(withQueryClient(<ReceivingModule />));
      const title = await screen.findByText('條碼掃描與解析');
      expect(title).toBeInTheDocument();
    });
  });

  describe('InventoryModule', () => {
    it('render 不拋例外且可找到「庫存明細 (Lot 級別)」', async () => {
      render(withQueryClient(<InventoryModule />));
      const title = await screen.findByText('庫存明細 (Lot 級別)');
      expect(title).toBeInTheDocument();
    });
  });

  describe('PickingModule', () => {
    it('render 不拋例外且可找到「銷售訂單」', async () => {
      render(withQueryClient(<PickingModule />));
      const title = await screen.findByText('銷售訂單');
      expect(title).toBeInTheDocument();
    });
  });

  describe('TraceabilityModule', () => {
    it('render 不拋例外且可找到「批次追溯查詢」', async () => {
      render(withQueryClient(<TraceabilityModule />));
      const title = await screen.findByText('批次追溯查詢');
      expect(title).toBeInTheDocument();
    });
  });

  describe('BarcodeRuleModule', () => {
    it('render 不拋例外且可找到「條碼規則管理」', async () => {
      render(withQueryClient(<BarcodeRuleModule />));
      const title = await screen.findByText('條碼規則管理');
      expect(title).toBeInTheDocument();
    });
  });
});