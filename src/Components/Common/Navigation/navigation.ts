import {
  BarChart3,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

export const teacherNavItems: NavigationItem[] = [
  { icon: LayoutDashboard, label: 'Tổng quan', href: '/teacherdashboard' },
  { icon: BookOpen, label: 'Câu Hỏi', href: '/teacher/questions' },
  { icon: BarChart3, label: 'Kết Quả', href: '/teacher/results' },
  { icon: GraduationCap, label: 'Lớp Học', href: '/teacher/classes' },
  { icon: UserCog, label: 'Giáo Viên', href: '/teacher/teachers' },
  { icon: Users, label: 'Học Sinh', href: '/teacher/students' },
  { icon: Settings, label: 'Cài đặt', href: '/settings' },
];

export const studentNavItems: NavigationItem[] = [
  { icon: LayoutDashboard, label: 'Tổng quan', href: '/studentdashboard' },
  { icon: BarChart3, label: 'Phân tích', href: '/student/analytics' },
  { icon: Settings, label: 'Cài đặt', href: '/settings' },
];

export const getNavigationItems = (isTeacher: boolean) =>
  isTeacher ? teacherNavItems : studentNavItems;

export const getSidebarNavigationItems = (isTeacher: boolean) =>
  getNavigationItems(isTeacher).filter((item) => item.href !== '/settings');

export const getDockNavigationItems = (isTeacher: boolean) =>
  (isTeacher
    ? [teacherNavItems[0], teacherNavItems[1], teacherNavItems[2], teacherNavItems[5]]
    : studentNavItems
  ).filter(Boolean) as NavigationItem[];
