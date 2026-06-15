import { useState } from 'react';
import { Search, Plus, UserCog, LockKeyhole, Loader2, AlertCircle, Save } from 'lucide-react';
import type { User } from '../api/users';
import {
  useUsers,
  useCreateUserMutation,
  useUpdateUserMutation,
  useUpdateUserPasswordMutation,
} from '../api/users';
import { getCurrentUser } from '../api/auth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

// 角色選項
const ROLE_OPTIONS = [
  { value: 'admin', label: '管理員' },
  { value: 'qc', label: '品管' },
  { value: 'supervisor', label: '主管' },
  { value: 'operator', label: '作業員' },
] as const;

export default function UserAdminModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState<{
    open: boolean;
    userId: number;
  } | null>(null);

  // 新增使用者表單
  type NewUserForm = {
    username: string;
    password: string;
    role: 'admin' | 'qc' | 'supervisor' | 'operator';
    full_name: string;
  };

  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    username: '',
    password: '',
    role: 'operator',
    full_name: '',
  });
  const [addError, setAddError] = useState<string | null>(null);

  // 重設密碼表單
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 錯誤訊息處理
  const errDetail = (err: unknown): string => {
    const detail = (err as any)?.response?.data?.detail;
    const status = (err as any)?.response?.status;
    if (status === 403) return '權限不足:需要管理員權限';
    return typeof detail === 'string' ? detail : '操作失敗,請稍後再試';
  };

  // 查詢使用者列表
  const { data: usersData, isPending, isError, error } = useUsers();

  // Mutations
  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const passwordMutation = useUpdateUserPasswordMutation();

  // 取得當前使用者
  const currentUser = getCurrentUser();
  const currentUsername = currentUser?.username;

  // 資料處理
  const users: User[] = usersData ?? [];

  // 搜尋過濾
  const term = searchTerm.trim().toLowerCase();
  const filteredUsers = term
    ? users.filter((u) =>
        [u.username, u.full_name ?? ''].some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(term)
        )
      )
    : users;

  // 關閉新增使用者對話框
  const closeAddDialog = () => {
    setShowAddDialog(false);
    setNewUserForm({
      username: '',
      password: '',
      role: 'operator',
      full_name: '',
    });
    setAddError(null);
  };

  // 關閉重設密碼對話框
  const closePasswordDialog = () => {
    setShowPasswordDialog(null);
    setNewPassword('');
    setPasswordError(null);
  };

  // 處理新增使用者
  const handleCreateUser = async () => {
    setAddError(null);

    // 前端驗證密碼長度
    if (newUserForm.password.length < 8) {
      setAddError('密碼長度至少 8 個字元');
      return;
    }

    try {
      await createMutation.mutateAsync({
        username: newUserForm.username.trim(),
        password: newUserForm.password,
        role: newUserForm.role,
        full_name: newUserForm.full_name.trim() || undefined,
      });
      closeAddDialog();
    } catch (err) {
      setAddError(errDetail(err));
    }
  };

  // 處理更新使用者
  const handleUpdateUser = async (userId: number, field: keyof User, value: any) => {
    try {
      await updateMutation.mutateAsync({ userId, payload: { [field]: value } });
    } catch (err) {
      // 不顯示錯誤(避免干擾使用者),只在控制台記錄
      console.error(errDetail(err));
    }
  };

  // 處理重設密碼
  const handleUpdatePassword = async (userId: number) => {
    setPasswordError(null);

    // 前端驗證密碼長度
    if (newPassword.length < 8) {
      setPasswordError('密碼長度至少 8 個字元');
      return;
    }

    try {
      await passwordMutation.mutateAsync({ userId, newPassword });
      closePasswordDialog();
    } catch (err) {
      setPasswordError(errDetail(err));
    }
  };

  // 加載狀態
  if (isPending) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-500">載入使用者資料中...</span>
      </div>
    );
  }

  // 錯誤狀態
  if (isError) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">無法載入使用者資料</p>
            <p className="mt-1 text-amber-800/90">
              {error instanceof Error ? error.message : '發生未知錯誤'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 工具列 */}
      <Card>
        <CardContent className="flex flex-col md:flex-row gap-4 pt-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋帳號或姓名…"
              className="pl-9"
            />
          </div>
          <Button type="button" onClick={() => setShowAddDialog(true)}>
            <Plus className="size-4" />
            新增使用者
          </Button>
        </CardContent>
      </Card>

      {/* 使用者列表 */}
      <Card>
        <CardHeader>
          <CardTitle>使用者管理</CardTitle>
          <p className="text-sm text-slate-500">
            總計 {filteredUsers.length} 位使用者{term ? `(已過濾,全部 ${users.length})` : ''}
          </p>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <UserCog className="size-12 mb-2" />
              <p className="text-sm">暫無使用者資料</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1024px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>帳號</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead className="text-center">狀態</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isSelf = user.username === currentUsername;
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div className="text-sm font-medium text-slate-900">{user.username}</div>
                          {isSelf && <div className="text-xs text-blue-600">您自己</div>}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {user.full_name ?? '—'}
                        </TableCell>
                        <TableCell>
                          {isSelf ? (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                              {ROLE_OPTIONS.find((r) => r.value === user.role)?.label}
                            </span>
                          ) : (
                            <Select
                              value={user.role}
                              onValueChange={(value) =>
                                handleUpdateUser(user.user_id, 'role', value as User['role'])
                              }
                              disabled={updateMutation.isPending}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={(checked) =>
                                handleUpdateUser(user.user_id, 'is_active', checked)
                              }
                              disabled={isSelf || updateMutation.isPending}
                            />
                            <span className="text-xs text-slate-600">
                              {user.is_active ? '啟用' : '停用'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {isSelf ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setShowPasswordDialog({ open: true, userId: user.user_id })
                              }
                              disabled={passwordMutation.isPending}
                              className="text-red-600 hover:text-red-700"
                            >
                              <LockKeyhole className="size-3" />
                              重設密碼
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增使用者對話框 */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => (open ? setShowAddDialog(true) : closeAddDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增使用者</DialogTitle>
            <DialogDescription>建立新的使用者帳號並指派角色。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-username">帳號 *</Label>
              <Input
                id="new-username"
                type="text"
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                placeholder="輸入帳號"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">密碼 * (至少 8 個字元)</Label>
              <Input
                id="new-password"
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="輸入密碼"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-role">角色 *</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(value) =>
                  setNewUserForm({ ...newUserForm, role: value as NewUserForm['role'] })
                }
              >
                <SelectTrigger id="new-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-fullname">姓名 (選填)</Label>
              <Input
                id="new-fullname"
                type="text"
                value={newUserForm.full_name}
                onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                placeholder="輸入姓名"
              />
            </div>

            {addError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAddDialog}>
              取消
            </Button>
            <Button type="button" onClick={handleCreateUser} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  確認新增
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重設密碼對話框 */}
      <Dialog
        open={!!showPasswordDialog}
        onOpenChange={(open) => {
          if (!open) closePasswordDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重設密碼</DialogTitle>
            <DialogDescription>為該使用者設定新的登入密碼。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">新密碼 (至少 8 個字元)</Label>
              <Input
                id="reset-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="輸入新密碼"
                autoFocus
              />
            </div>

            {passwordError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePasswordDialog}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => showPasswordDialog && handleUpdatePassword(showPasswordDialog.userId)}
              disabled={passwordMutation.isPending}
            >
              {passwordMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <LockKeyhole className="size-4" />
                  確認重設
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
