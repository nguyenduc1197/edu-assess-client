import React from 'react';
import { 
  LayoutDashboard, 
  Calculator, 
  BookOpen, 
  History, 
  CalendarDays, 
  GraduationCap, 
  Settings,
  X,
  LogOut
} from 'lucide-react';
import { User } from '../../../types';

interface SidebarProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, isOpen, onClose, onLogout }) => {
  const navItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', active: true, href: 'teacherdashboard' },
    //{ icon: Calculator, label: 'Toán học', active: false, href: '#' },
    //{ icon: BookOpen, label: 'Văn học', active: false, href: '#' },
    //{ icon: History, label: 'Lịch sử', active: false, href: '#' },
    //{ icon: CalendarDays, label: 'Lịch học', active: false, href: '#' },
    //{ icon: GraduationCap, label: 'Điểm số', active: false, href: '#' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-64 flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-background-dark lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:shadow-sm lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header: Profile & Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 lg:border-none">
            <div className="flex items-center gap-3 overflow-hidden">
              <div 
                className="aspect-square size-10 shrink-0 rounded-full bg-cover bg-center ring-2 ring-gray-100 dark:ring-gray-700"
                style={{ backgroundImage: `url("${user.avatarUrl}")` }}
                aria-label={`Avatar of ${user.name}`}
              />
              <div className="flex flex-col overflow-hidden">
                <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {`${localStorage.getItem('name')}`}
                </h1>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Close Button (Mobile Only) */}
            <button 
                onClick={onClose}
                className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden dark:text-gray-400 dark:hover:bg-white/10"
                aria-label="Close sidebar"
            >
                <X size={20} />
            </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* Main Navigation */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                  ${item.active 
                    ? 'bg-blue-50 text-primary dark:bg-primary/10 dark:text-primary' 
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
              >
                <item.icon size={20} className={item.active ? 'text-primary' : 'text-gray-500 dark:text-gray-400'} />
                {item.label}
              </a>
            ))}
          </nav>

          {/* System Actions (Settings & Logout) - Moved up to be part of flow */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-1">
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <Settings size={20} className="text-gray-500 dark:text-gray-400" />
              Cài đặt
            </a>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10 transition-colors"
            >
              <LogOut size={20} />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;