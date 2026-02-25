import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { API_BASE_URL } from '../../../config/env';
import { LoginProps } from '../../../types';
interface LoginData {
  name: string;
  role: string;
  token: string;
  accesstoken:string;
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
        let token = '';

        if (typeof data === 'string') {
            token = data;
        } else if (data.loginResponse.token) {
            token = data.loginResponse.token;
        } else if (data.loginResponse.accesstoken) {
            token = data.loginResponse.accesstoken;
        } else {
            // Fallback: maybe the whole object is the payload? 
            // If the user didn't specify the response format, I'll save the whole thing if it looks like a token, 
            // or just flag success.
            // Let's assume data itself is the token if it has no clear structure, or try to find it.
            token = JSON.stringify(data); 
        }
        localStorage.setItem('token', token);
        localStorage.setItem('name', data.loginResponse.name);
        localStorage.setItem('role', data.loginResponse.role);
        if (onLogin)
            onLogin(data.loginResponse.role);
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
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 dark:bg-background-dark px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-lg dark:bg-gray-900 dark:border dark:border-gray-800">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            StudentHub
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Đăng nhập để tiếp tục vào hệ thống
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tên đăng nhập
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
                  className="block w-full rounded-lg border border-gray-300 pl-10 py-2.5 text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-primary sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                  placeholder="Tên đăng nhập"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mật khẩu
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
                  className="block w-full rounded-lg border border-gray-300 pl-10 pr-10 py-2.5 text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-primary sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-500" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-500" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Ghi nhớ đăng nhập
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary-dark">
                Quên mật khẩu?
              </a>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Đang xử lý...</span>
              </div>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
