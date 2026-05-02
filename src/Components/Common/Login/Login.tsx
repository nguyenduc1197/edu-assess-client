import React, { useState } from 'react';
import { ArrowRight, BookOpen, Eye, EyeOff, Lock, ShieldCheck, Sparkles, User } from 'lucide-react';
import { API_BASE_URL } from '../../../config/env';
import { LoginProps } from '../../../types';
import { decodeJwtPayload } from '../../../api/fetchClient';
interface LoginData {
  name: string;
  role: string;
  token?: string;
  email: string;
  accesstoken?: string;
  accountId?: string;
  profileId?: string;
}

interface LoginAPIResponse {
  loginResponse: LoginData;
}
const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          password: password
        })
      });

      if (response.ok) {
        const data: LoginAPIResponse = await response.json();
        const loginResponse = data?.loginResponse;
        const token = loginResponse?.token || loginResponse?.accesstoken || '';

        if (!loginResponse || !token) {
          throw new Error('Phản hồi đăng nhập không hợp lệ.');
        }

        localStorage.setItem('token', token);
        localStorage.setItem('name', loginResponse.name);
        localStorage.setItem('role', loginResponse.role);
        localStorage.setItem('email', loginResponse.email);

        if (loginResponse.accountId) {
          localStorage.setItem('accountId', loginResponse.accountId);
          localStorage.setItem('userId', loginResponse.accountId);
        }

        if (loginResponse.profileId) {
          localStorage.setItem('profileId', loginResponse.profileId);
        }

        const payload = decodeJwtPayload(token);
        const fallbackUserId =
          payload?.nameid ||
          payload?.sub ||
          payload?.userId ||
          payload?.id ||
          payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];

        if (!localStorage.getItem('userId') && typeof fallbackUserId === 'string' && fallbackUserId.trim()) {
          localStorage.setItem('userId', fallbackUserId);
        }

        if (onLogin) {
          onLogin(loginResponse.role);
        }
      } else {
        setError('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError('Đã xảy ra lỗi kết nối. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.25),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.22),_transparent_30%)]" />
      <div className="absolute left-[-80px] top-10 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute bottom-0 right-[-40px] h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="hidden lg:flex lg:flex-col lg:justify-center">
            <div className="max-w-xl space-y-6 text-white">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                Nền tảng học tập thông minh
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
                  Chào mừng đến với StudentHub
                </h1>
                <p className="max-w-lg text-base text-slate-300 xl:text-lg">
                  Đăng nhập để quản lý bài thi, chấm điểm AI và theo dõi tiến độ học tập.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" />
                  <p className="font-semibold">Đăng nhập an toàn</p>
                  <p className="mt-1 text-sm text-slate-300">Bảo mật theo vai trò giáo viên và học sinh.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <BookOpen className="mb-3 h-5 w-5 text-violet-300" />
                  <p className="font-semibold">Theo dõi kết quả</p>
                  <p className="mt-1 text-sm text-slate-300">Xem phản hồi chi tiết và tiến trình ngay trong hệ thống.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-[2rem] border border-white/30 bg-white/90 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl dark:border-gray-800 dark:bg-gray-900/95 sm:p-8">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Đăng nhập
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Nhập thông tin để tiếp tục vào hệ thống
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="username" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Tên đăng nhập
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <User className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </div>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:ring-blue-900/30"
                        placeholder="Nhập tên đăng nhập"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 bg-white pl-11 pr-11 py-3 text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:ring-blue-900/30"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="remember-me" className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="ml-2">Ghi nhớ đăng nhập</span>
                  </label>

                  <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                    Quên mật khẩu?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.01] hover:from-blue-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Đang xử lý...</span>
                    </div>
                  ) : (
                    <>
                      <span>Vào hệ thống</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
