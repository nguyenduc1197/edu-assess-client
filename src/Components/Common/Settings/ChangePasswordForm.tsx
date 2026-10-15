import React, { useState } from 'react';
import { fetchClient } from '../../../api/fetchClient';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  submitLabel?: string;
}

const inputClassName =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onSuccess, submitLabel = 'Đổi mật khẩu' }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const response = await fetchClient('/accounts/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.status === 204) {
        setPasswordSuccess('Đổi mật khẩu thành công.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onSuccess?.();
      } else {
        const body = await response.json().catch(() => ({}));
        setPasswordError(body.message || 'Đổi mật khẩu thất bại.');
      }
    } catch (err) {
      setPasswordError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <form onSubmit={handleUpdatePassword} className="space-y-4">
      {passwordError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {passwordError}
        </div>
      )}
      {passwordSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          {passwordSuccess}
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Mật khẩu hiện tại
        </label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClassName}
          placeholder="Nhập mật khẩu hiện tại"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Mật khẩu mới (ít nhất 6 ký tự)
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClassName}
          placeholder="Nhập mật khẩu mới"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Xác nhận mật khẩu mới
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClassName}
          placeholder="Xác nhận mật khẩu mới"
        />
      </div>
      <button
        type="submit"
        disabled={isUpdatingPassword}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isUpdatingPassword ? 'Đang lưu...' : submitLabel}
      </button>
    </form>
  );
};

export default ChangePasswordForm;
