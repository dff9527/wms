import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Warehouse,
  TruckIcon,
  Search,
  BarChart3,
  ScanLine,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  Building2,
  Users,
  ClipboardCheck,
  FileText,
} from 'lucide-react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import ChangePasswordDialog from './components/ChangePasswordDialog';
import ReceivingModule from './components/ReceivingModule';
import InventoryModule from './components/InventoryModule';
import PickingModule from './components/PickingModule';
import TraceabilityModule from './components/TraceabilityModule';
import DashboardModule from './components/DashboardModule';
import BarcodeRuleModule from './components/BarcodeRuleModule';
import UserAdminModule from './components/UserAdminModule';
import CustomerModule from './components/CustomerModule';
import CycleCountModule from './components/CycleCountModule';
import ReportsModule from './components/ReportsModule';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from './components/ui/sidebar';
import {
  login,
  logout,
  initAuth,
  setupAuthInterceptor,
  removeAuthInterceptor,
  fetchCurrentUser,
  getRole,
} from './api/auth';
import { Toaster } from './components/ui/sonner';
import ScanFlashOverlay from './components/common/ScanFlashOverlay';

function TraceRoute() {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <TraceabilityModule
      initialLot={searchParams.get('lot') ?? ''}
      onLotChange={(lot) => setSearchParams({ lot })}
    />
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showPwDialog, setShowPwDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

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
      setShowPassword(false);
      setCapsLockOn(false);
    } catch (error) {
      setLoginError('登入失敗，請檢查帳號密碼是否正確。');
    }
  };

  // Handle logout
  const handleLogout = useCallback(() => {
    logout();
    setIsAuthenticated(false);
    setUsername('');
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  // Render login form when not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Warehouse className="size-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">WMS 系統</h1>
                <p className="text-sm text-slate-500">Warehouse Management System</p>
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
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    onKeyDown={(e) => setCapsLockOn(Boolean(e.getModifierState?.('CapsLock')))}
                    onKeyUp={(e) => setCapsLockOn(Boolean(e.getModifierState?.('CapsLock')))}
                    onClick={(e) => setCapsLockOn(Boolean(e.getModifierState?.('CapsLock')))}
                    onBlur={() => setCapsLockOn(false)}
                    className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="請輸入密碼"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                    aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {capsLockOn && <p className="mt-1 text-xs text-amber-600">Caps Lock 已開啟</p>}
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
        <Toaster />
        <ScanFlashOverlay />
      </>
    );
  }

  // Render main app when authenticated
  const roleLabel =
    { admin: '管理員', qc: '品管', supervisor: '主管', operator: '作業員' }[getRole()] ?? '';

  const navigationGroups = [
    {
      label: '作業',
      items: [
        { path: '/receiving', label: '收貨管理', icon: Package },
        { path: '/picking', label: '揀貨出庫', icon: TruckIcon },
        { path: '/cycle-counts', label: '盤點管理', icon: ClipboardCheck },
      ],
    },
    {
      label: '查詢',
      items: [
        { path: '/dashboard', label: '總覽', icon: BarChart3 },
        { path: '/inventory', label: '庫存管理', icon: Warehouse },
        { path: '/trace', label: '追溯管理', icon: Search },
        { path: '/reports', label: '報表中心', icon: FileText },
      ],
    },
    {
      label: '設定',
      items: [
        { path: '/barcode-rules', label: '條碼規則', icon: ScanLine },
        { path: '/customers', label: '客戶管理', icon: Building2 },
        ...(getRole() === 'admin' ? [{ path: '/users', label: '使用者管理', icon: Users }] : []),
      ],
    },
  ];

  return (
    <>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border p-3">
            <Link to="/dashboard" className="flex items-center gap-3 overflow-hidden">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                <Warehouse className="size-5 text-white" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-bold">WMS</p>
                <p className="truncate text-xs text-sidebar-foreground/60">Warehouse Management</p>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            {navigationGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === item.path}
                          tooltip={item.label}
                        >
                          <Link to={item.path}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-2">
            <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{username}</p>
              <p className="text-xs text-sidebar-foreground/60">{roleLabel}</p>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="修改密碼" onClick={() => setShowPwDialog(true)}>
                  <KeyRound />
                  <span>修改密碼</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="登出" onClick={handleLogout}>
                  <LogOut />
                  <span>登出</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0 bg-slate-50">
          <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 md:hidden">
            <SidebarTrigger />
            <span className="ml-2 font-semibold text-slate-900">WMS 系統</span>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
            <Routes>
              <Route path="/dashboard" element={<DashboardModule />} />
              <Route path="/receiving" element={<ReceivingModule />} />
              <Route path="/inventory" element={<InventoryModule />} />
              <Route path="/picking" element={<PickingModule />} />
              <Route path="/cycle-counts" element={<CycleCountModule />} />
              <Route path="/trace" element={<TraceRoute />} />
              <Route path="/reports" element={<ReportsModule />} />
              <Route path="/barcode-rules" element={<BarcodeRuleModule />} />
              <Route path="/customers" element={<CustomerModule />} />
              <Route
                path="/users"
                element={
                  getRole() === 'admin' ? <UserAdminModule /> : <Navigate to="/dashboard" replace />
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </SidebarInset>

        <ChangePasswordDialog open={showPwDialog} onClose={() => setShowPwDialog(false)} />
      </SidebarProvider>
      <Toaster />
      <ScanFlashOverlay />
    </>
  );
}
