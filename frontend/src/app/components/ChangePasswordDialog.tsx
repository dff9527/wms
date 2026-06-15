import { useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const API_BASE_URL = '/api/v1';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordDialog({ open, onClose }: Props) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 前端驗證
    if (newPassword.length < 8) {
      setError('新密碼至少需要 8 個字元');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('兩次新密碼不一致');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/me/password`, {
        old_password: oldPassword,
        new_password: newPassword,
      });

      // 更新 token（後端會換發新 token）
      const token = response.data.access_token;
      const tokenType = response.data.token_type || 'bearer';
      localStorage.setItem('wms_token', token);
      axios.defaults.headers.common['Authorization'] = `${tokenType} ${token}`;

      setError('');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);
      setSuccess('密碼已更新');

      // 顯示成功訊息後 1 秒關閉
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1000);
    } catch (err) {
      setLoading(false);
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 400) {
        setError(typeof detail === 'string' ? detail : '舊密碼不正確');
      } else {
        setError(typeof detail === 'string' ? detail : '密碼更新失敗，請稍後再試');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改密碼</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="old-password">舊密碼</Label>
            <Input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="請輸入舊密碼"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">新密碼</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="請輸入新密碼（至少 8 個字元）"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">確認新密碼</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="請再輸入一次新密碼"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '更新中...' : '更新密碼'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
