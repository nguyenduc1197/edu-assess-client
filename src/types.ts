export type QuestionFormat = 'SingleChoice' | 'TrueFalse';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface Choice {
  id?: string;        
  optionLabel: string;
  content: string;
  isCorrect?: boolean; 
}

export interface Question {
  id: string;        
  content: string;
  competencyType?: string;
  competencyLabel?: string;
  questionFormat?: QuestionFormat;
  questionFormatLabel?: string;
  difficultyLevel?: DifficultyLevel;
  difficultyLabel?: string;
  passageText?: string | null;
  passageGroupKey?: string | null;
  statementOrder?: number | null;
  sourceEvidence?: string;
  choices?: Choice[];
  dateCreated?: string;
}

export interface CompetencyOption {
  value: string;
  label: string;
}

export interface Subject {
  id: string;        
  name: string;
}

export interface Class {
  id: string;
  name: string;
  homeRoomTeacherId?: string;
  homeRoomTeacherName?: string;
  schoolYearId?: string;
  schoolYearStart?: string;
  schoolYearEnd?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface SchoolYear {
  id: string;
  start: string;
  end: string;
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
  LATE = 'Trễ hạn',
  RETRY = 'Làm lại'
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
  assessmentStatus?: 'NotStarted' | 'Pending' | 'Completed' | 'Failed';
  canRetry?: boolean;
  canRetryAssessment?: boolean;
  assessmentError?: string | null;
  statusMessage?: string;
  studentExamId?: string | null;
  isSubmitted?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface Teacher {
  id: string;
  name: string;
  dateOfBirth: string;
  email: string;
  subject: string;
  username?: string;
  dateCreated?: string;
}

export interface Student {
  id: string;
  name: string;
  dateOfBirth: string;
  schoolClassId: string;
  schoolClassName?: string;
  username?: string;
  dateCreated?: string;
}

export interface LoginProps {
  onLogin?: (role: string) => void;
  onLogout?: () => void;
}

export interface StudentResultSummary {
  studentExamId: string;
  examId: string;
  examName: string;
  studentId: string;
  studentName: string;
  schoolClassId: string;
  schoolClassName: string;
  isSubmitted: boolean;
  score: number | null;
  assessmentStatus: 'Pending' | 'Completed' | 'Failed';
  completedExamCount?: number;
  behaviorAdjustmentAccumulation?: CompetencyAccumulation | null;
  selfDevelopmentAccumulation?: CompetencyAccumulation | null;
  economicSocialParticipationAccumulation?: CompetencyAccumulation | null;
  finishedAt?: string;
  assessedAt?: string | null;
}

export interface ExamStudentStatusItem {
  studentId: string;
  studentName: string;
  schoolClassId?: string;
  schoolClassName?: string;
  studentExamId?: string | null;
  isSubmitted?: boolean;
  score?: number | null;
  assessmentStatus?: 'NotStarted' | 'Pending' | 'Completed' | 'Failed' | string;
  canViewResult?: boolean;
  assessmentError?: string | null;
  finishedAt?: string | null;
}

export interface WrongAnswerReview {
  questionId: string;
  questionContent: string;
  competencyType?: string;
  competencyLabel?: string;
  questionFormat?: QuestionFormat;
  questionFormatLabel?: string;
  difficultyLevel?: DifficultyLevel;
  difficultyLabel?: string;
  passageText?: string | null;
  passageGroupKey?: string | null;
  statementOrder?: number | null;
  selectedAnswer?: string | null;
  correctAnswer?: string | null;
  sourceEvidence?: string | null;
  keywordHint?: string | null;
  errorExplanation?: string | null;
  highlightText?: string | null;
  guidanceNote?: string | null;
}

export interface CompetencyAccumulation {
  previousScore: number | null;
  latestScore: number;
  averageScore: number;
  bestScore: number;
  gainVsPreviousAttempt: number | null;
}

export interface AssessmentResult {
  studentExamId: string;
  examId: string;
  examName: string;
  studentId: string;
  studentName: string;
  score: number;
  assessmentStatus: 'Pending' | 'Completed' | 'Failed';
  behaviorAdjustmentScore: number | null;
  selfDevelopmentScore: number | null;
  economicSocialParticipationScore: number | null;
  overallFeedback: string | null;
  behaviorAdjustmentFeedback: string | null;
  selfDevelopmentFeedback: string | null;
  economicSocialParticipationFeedback: string | null;
  completedExamCount: number;
  behaviorAdjustmentAccumulation: CompetencyAccumulation | null;
  selfDevelopmentAccumulation: CompetencyAccumulation | null;
  economicSocialParticipationAccumulation: CompetencyAccumulation | null;
  wrongAnswers?: WrongAnswerReview[];
  assessmentError: string | null;
  finishedAt: string;
  assessedAt: string | null;
  canRetryAssessment?: boolean;
}