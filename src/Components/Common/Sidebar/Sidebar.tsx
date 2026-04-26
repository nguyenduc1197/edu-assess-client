import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Users,
  UserCog,
  Settings,
  X,
  LogOut,
  BarChart3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { User } from '../../../types';

interface SidebarProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
  role?: 'Teacher' | 'Student';
}

const Sidebar: React.FC<SidebarProps> = ({ user, isOpen, onClose, onLogout, role }) => {
  const currentPath = window.location.pathname;
  const isTeacher = role === 'Teacher' || localStorage.getItem('role') === 'Teacher';

  const teacherNavItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', href: '/teacherdashboard' },
    { icon: BookOpen, label: 'Câu Hỏi', href: '/teacher/questions' },
    { icon: BarChart3, label: 'Kết Quả', href: '/teacher/results' },
    { icon: GraduationCap, label: 'Lớp Học', href: '/teacher/classes' },
    { icon: UserCog, label: 'Giáo Viên', href: '/teacher/teachers' },
    { icon: Users, label: 'Học Sinh', href: '/teacher/students' },
  ];

  const studentNavItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', href: '/studentdashboard' },
    { icon: BarChart3, label: 'Phân tích', href: '/student/analytics' },
  ];

  const navItems = isTeacher ? teacherNavItems : studentNavItems;
  const email = localStorage.getItem('email');
  const displayEmail = isTeacher ? (email || user.email) : (email || 'Chưa cài đặt');

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-72 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 shadow-2xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-lg shadow-cyan-500/20">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">EduAssess</p>
                <h1 className="text-base font-bold text-white">StudentHub</h1>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
            <div className="flex items-start gap-3 overflow-hidden">
              <div
                className="aspect-square size-11 shrink-0 rounded-2xl bg-cover bg-center ring-2 ring-white/10"
                style={{ backgroundImage: `url("${user.avatarUrl}")` }}
                aria-label={`Avatar of ${user.name}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {localStorage.getItem('name') || user.name}
                </p>
                <p className="truncate text-xs text-slate-400">{displayEmail}</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  {isTeacher ? 'Giáo viên' : 'Học sinh'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Điều hướng
          </p>

          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = currentPath === item.href;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-900/20'
                      : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span className={`rounded-lg p-1.5 ${isActive ? 'bg-white/15' : 'bg-white/5'}`}>
                    <item.icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                  </span>
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-slate-300">
            <div className="mb-2 flex items-center gap-2 text-cyan-300">
              <ShieldCheck size={16} />
              <span className="font-semibold">Hệ thống ổn định</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Theo dõi bài thi, quản lý người dùng và xem phản hồi AI trong một giao diện thống nhất.
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => { window.location.href = '/settings'; }}
            className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/8 hover:text-white"
          >
            <Settings size={18} className="text-slate-400" />
            Cài đặt
          </button>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;