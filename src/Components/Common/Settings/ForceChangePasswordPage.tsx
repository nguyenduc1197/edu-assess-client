import React from 'react';
import { ShieldCheck } from 'lucide-react';
import ChangePasswordForm from './ChangePasswordForm';

export const MUST_CHANGE_PASSWORD_KEY = 'mustChangePassword';

interface ForceChangePasswordPageProps {
  onChanged: () => void;
  onLogout: () => void;
}

const ForceChangePasswordPage: React.FC<ForceChangePasswordPageProps> = ({ onChanged, onLogout }) => {
  const name = localStorage.getItem('name');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-5 flex items-start gap-3">
          <ShieldCheck className="mt-0.5 flex-shrink-0 text-primary" size={28} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Đổi mật khẩu lần đầu</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {name ? `Chào ${name}! ` : ''}Tài khoản của bạn đang dùng mật khẩu do giáo viên cấp. Hãy đặt mật khẩu mới để tiếp tục.
            </p>
          </div>
        </div>

        <ChangePasswordForm
          submitLabel="Đổi mật khẩu và tiếp tục"
          onSuccess={() => {
            localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
            onChanged();
          }}
        />

        <button
          type="button"
          onClick={onLogout}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  );
};

export default ForceChangePasswordPage;
