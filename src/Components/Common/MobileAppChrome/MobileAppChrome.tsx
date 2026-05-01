import React from 'react';
import { Menu, Sparkles } from 'lucide-react';
import { getDockNavigationItems } from '../Navigation/navigation';

interface MobileHeaderBarProps {
  title: string;
  subtitle?: string;
  onOpenMenu: () => void;
}

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

const isPathActive = (currentPath: string, href: string) =>
  currentPath === href ||
  currentPath.startsWith(`${href}/`) ||
  (currentPath === '/' && href.endsWith('dashboard'));

export const MobileHeaderBar: React.FC<MobileHeaderBarProps> = ({
  title,
  subtitle,
  onOpenMenu,
}) => (
  <div className="sticky top-0 z-30 border-b border-white/60 bg-white/75 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)] shadow-[0_12px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 lg:hidden">
    <div className="flex items-start gap-3">
      <button
        type="button"
        className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
        onClick={onOpenMenu}
        aria-label="Mở menu"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-cyan-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200">
          <Sparkles size={12} />
          StudentHub
        </div>
        <h1 className="mt-2 truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  </div>
);

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const currentPath = window.location.pathname;
  const isTeacher = localStorage.getItem('role') === 'Teacher';
  const items = getDockNavigationItems(isTeacher);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] lg:hidden">
      <div
        className="pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-[2rem] border border-white/60 bg-white/85 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/85"
        role="navigation"
        aria-label="Điều hướng nhanh trên di động"
      >
        {items.map((item) => {
          const active = isPathActive(currentPath, item.href);

          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[1.35rem] px-2 py-2 text-[11px] font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              <item.icon size={18} />
              <span className="truncate">{item.label}</span>
            </a>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-1 rounded-[1.35rem] px-3 py-2 text-[11px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Mở thêm điều hướng"
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </div>
    </div>
  );
};
