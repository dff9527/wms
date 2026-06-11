import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { Package, Warehouse, TruckIcon, Search, BarChart3, ScanLine, LogOut } from 'lucide-react';
import ReceivingModule from './components/ReceivingModule';
import InventoryModule from './components/InventoryModule';
import PickingModule from './components/PickingModule';
import TraceabilityModule from './components/TraceabilityModule';
import DashboardModule from './components/DashboardModule';
import BarcodeRuleModule from './components/BarcodeRuleModule';
import { login, logout, initAuth, setupAuthInterceptor, removeAuthInterceptor, fetchCurrentUser } from './api/auth';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Initialize auth on mount
  useEffect(() => {
    const setupAuth = async () => {
      const hasToken = initAuth();

      if (hasToken) {
        // 重新整理後 currentUser 不在記憶體，打 /auth/me 還原（token 失效則回登入頁）
        const user = await fetchCurrentUser();
        if (user) {
          setUsername(user.username);
          setIsAuthenticated(true);
        } else {
          logout();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }

      setIsLoading(false);
    };
    
    setupAuth();
  }, []);

  // Setup 401 interceptor
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setLoginError('您的登入已過期，請重新登入。');
      setLoginForm({ username: '', password: '' });
    };
    
    const interceptorId = setupAuthInterceptor(handleUnauthorized);
    
    return () => {
      removeAuthInterceptor(interceptorId);
    };
  }, [isAuthenticated]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      await login(loginForm.username, loginForm.password);
      setIsAuthenticated(true);
      setUsername(loginForm.username);
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      setLoginError('登入失敗，請檢查帳號密碼是否正確。');
    }
  };

  // Handle logout
  const handleLogout = useCallback(() => {
    logout();
    setIsAuthenticated(false);
    setUsername('');
    setActiveTab('dashboard');
  }, []);

  // Render login form when not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Warehouse className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">半導體 WMS 系統</h1>
              <p className="text-sm text-slate-500">Semiconductor Warehouse Management System</p>
            </div>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">帳號</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="請輸入帳號"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="請輸入密碼"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登入中...' : '登入'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-slate-400">
            <p>請使用系統分配的帳號密碼登入</p>
          </div>
        </div>
      </div>
    );
  }

  // Render main app when authenticated
  return (
    <div className="size-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Warehouse className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">半導體 WMS 系統</h1>
              <p className="text-sm text-slate-500">Semiconductor Warehouse Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">操作員: {username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="登出"
            >
              <LogOut className="size-4" />
              登出
            </button>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="size-full flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6">
          <TabsList className="flex gap-1">
            <TabsTrigger
              value="dashboard"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <BarChart3 className="size-4" />
              總覽
            </TabsTrigger>
            <TabsTrigger
              value="receiving"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <Package className="size-4" />
              收貨管理
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <Warehouse className="size-4" />
              庫存管理
            </TabsTrigger>
            <TabsTrigger
              value="picking"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <TruckIcon className="size-4" />
              揀貨出庫
            </TabsTrigger>
            <TabsTrigger
              value="traceability"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <Search className="size-4" />
              追溯管理
            </TabsTrigger>
            <TabsTrigger 
              value="barcode-rules" 
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <ScanLine className="size-4" />
              條碼規則
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="dashboard" className="size-full p-0">
            <DashboardModule />
          </TabsContent>
          <TabsContent value="receiving" className="size-full p-0">
            <ReceivingModule />
          </TabsContent>
          <TabsContent value="inventory" className="size-full p-0">
            <InventoryModule />
          </TabsContent>
          <TabsContent value="picking" className="size-full p-0">
            <PickingModule />
          </TabsContent>
          <TabsContent value="traceability" className="size-full p-0">
            <TraceabilityModule />
          </TabsContent>
          <TabsContent value="barcode-rules" className="size-full p-0"><BarcodeRuleModule /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}