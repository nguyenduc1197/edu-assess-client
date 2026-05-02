import React, { useState, useEffect, useCallback } from 'react';
import { AccountMe, User } from '../../../types';
import Sidebar from '../Sidebar/Sidebar';
import { fetchClient } from '../../../api/fetchClient';
import { MobileBottomNav, MobileHeaderBar } from '../MobileAppChrome/MobileAppChrome';

interface SettingsPageProps {
  onLogout?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [account, setAccount] = useState<AccountMe | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

  // Profile form
  const [profileName, setProfileName] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const sidebarUser: User = {
    id: account?.profileId || '',
    name: account?.name || localStorage.getItem('name') || '',
    email: account?.email || localStorage.getItem('email') || '',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj',
  };

  const fetchAccount = useCallback(async () => {
    setIsLoadingAccount(true);
    try {
      const response = await fetchClient('/accounts/me');
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data: AccountMe = await response.json();
      setAccount(data);
      setProfileName(data.name || '');
    } catch (err) {
      console.error('Failed to fetch account info', err);
    } finally {
      setIsLoadingAccount(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!profileName.trim()) {
      setProfileError('Tên không được để trống.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const response = await fetchClient('/accounts/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName.trim() }),
      });

      if (response.status === 204) {
        localStorage.setItem('name', profileName.trim());
        setProfileSuccess('Cập nhật tên thành công.');
        setAccount((prev) => (prev ? { ...prev, name: profileName.trim() } : prev));
      } else {
        const body = await response.json().catch(() => ({}));
        setProfileError(body.message || 'Cập nhật thất bại.');
      }
    } catch (err) {
      setProfileError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

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
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      <MobileHeaderBar
        title="Cài đặt tài khoản"
        subtitle="Cập nhật thông tin và bảo mật theo phong cách app trên điện thoại."
        onOpenMenu={() => setIsSidebarOpen(true)}
      />

      <Sidebar
        user={sidebarUser}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
      />
      <MobileBottomNav onOpenMenu={() => setIsSidebarOpen(true)} />

      <main className="mobile-safe-bottom min-h-[calc(100dvh-var(--mobile-app-header-height))] flex-1 overflow-x-hidden overflow-y-auto px-3 py-5 sm:px-6 sm:py-7 lg:h-screen lg:p-8 lg:pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-cyan-50 to-blue-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Cài Đặt
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Quản lý thông tin tài khoản và bảo mật.
            </p>
          </div>

          {isLoadingAccount ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
            </div>
          ) : (
            <>
              {/* Account Info Card */}
              {account && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thông tin tài khoản</h2>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Tên đăng nhập</p>
                      <p className="font-medium text-gray-900 dark:text-white">{account.username}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Vai trò</p>
                      <p className="font-medium text-gray-900 dark:text-white">{account.role}</p>
                    </div>
                    {account.email && (
                      <div className="col-span-2">
                        <p className="text-gray-500 dark:text-gray-400">Email</p>
                        <p className="font-medium text-gray-900 dark:text-white">{account.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Profile Name Form */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Cập Nhật Tên Hiển Thị</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  {profileError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                      {profileSuccess}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label htmlFor="profileName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tên hiển thị
                    </label>
                    <input
                      id="profileName"
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      placeholder="Nhập tên hiển thị"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUpdatingProfile ? 'Đang lưu...' : 'Lưu tên'}
                  </button>
                </form>
              </div>

              {/* Password Form */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Đổi Mật Khẩu</h2>
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
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      placeholder="Xác nhận mật khẩu mới"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUpdatingPassword ? 'Đang lưu...' : 'Đổi mật khẩu'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
