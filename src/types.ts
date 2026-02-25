export interface Choice {
  id: string;        
  content: string;
  isCorrect?: boolean; 
}

export interface Question {
  id: string;        
  content: string;
  choices?: Choice[];
}

export interface Subject {
  id: string;        
  name: string;
}

export interface Class {
  id: string;
  name: string;
}

export type AppView = 'dashboard' | 'exam-session';

export type AnswerState = {
  content?: string;
  choiceId?: string;
};

export enum AssignmentStatus {
  NEW = 'Mới giao',
  IN_PROGRESS = 'Đang làm',
  SUBMITTED = 'Đã nộp',
  GRADED = 'Đã chấm điểm',
  LATE = 'Trễ hạn'
}

export enum SubjectLabel {
  HISTORY = 'Lịch sử',
  LITERATURE = 'Văn học',
  GD_KTPL = 'Giáo dục KT-PT',
  PHYSICS = 'Vật lý',
  ENGLISH = 'Tiếng Anh'
}

export interface Assignment {
  id: string;
  title: string;
  subject: SubjectLabel;
  deadline: string; // ISO date string or formatted string
  deadlineDisplay: string; // The pretty string shown in UI
  status: AssignmentStatus;
  isOverdue?: boolean;
  score?: number | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface LoginProps {
  onLogin?: (role: string) => void;
  onLogout?: () => void;
}