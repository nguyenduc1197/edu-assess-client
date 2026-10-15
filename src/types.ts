export type QuestionFormat = 'SingleChoice' | 'TrueFalse' | 'Essay' | 'FillInBlank' | 'Matching';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
/** How a true/false passage group is scored, chosen per exam. */
export type TrueFalseScoringMode = 'Tiered' | 'PerStatement';

export interface Choice {
  id?: string;
  optionLabel: string;
  content: string;
  isCorrect?: boolean;
  /** Fill-in-the-blank: blank number this word fills; matching: column A number. Null = distractor. Never sent to students. */
  correctSlot?: number | null;
}

/** One "ý" of an essay rubric: content + points (multiple of 0.25). */
export interface EssayRubricItem {
  content: string;
  points?: number | null;
}

/** AI points for one ý of an essay answer (teachers only). */
export interface EssayRubricResult {
  order: number;
  points: number;
  maxPoints?: number | null;
  comment?: string | null;
}

/** Fill-in-the-blank: slot = blank number; matching: slot = column A number. */
export interface SlotAnswer {
  slot: number;
  choiceId: string | null;
}

export interface Question {
  id: string;        
  content: string;
  startedAt?: string | null;
  attemptDeadlineUtc?: string | null;
  durationMinutes?: number;
  competencyType?: string;
  competencyLabel?: string;
  questionFormat?: QuestionFormat;
  questionFormatLabel?: string;
  difficultyLevel?: DifficultyLevel;
  difficultyLabel?: string;
  passageText?: string | null;
  passageGroupKey?: string | null;
  statementOrder?: number | null;
  /** Position in the exam for exams created from a scanned file (original order is kept). */
  examOrder?: number | null;
  sourceEvidence?: string;
  choices?: Choice[];
  dateCreated?: string;
  /** Essay: max points (0 < x <= 10). Other formats always weigh 1 point. */
  maxPoints?: number;
  /** Essay: sample answer / grading criteria (teacher only, never sent to students). */
  sampleAnswer?: string | null;
  /** True when students already answered this question: its format can no longer be changed. */
  hasStudentAnswers?: boolean;
  /** Matching: column A items in order. */
  matchingPrompts?: string[];
  /** Essay: rubric ("danh sách ý"); teachers only. maxPoints = sum of points. */
  rubricItems?: EssayRubricItem[];
}

export interface AIQuestionGenerateResponse {
  sourceType?: string;
  sourceTitle?: string;
  sourcePreview?: string;
  extractedCharacterCount?: number;
  requestedCompetencies?: string[];
  questions?: Question[];
  savedQuestionIds?: string[];
}

export interface AIExamVariant {
  variantIndex: number;
  examName: string;
  targetTopic?: string;
  generationNotes?: string;
  questions: Question[];
  savedQuestionIds?: string[];
}

export interface AIExamScanGenerateResponse {
  sourceType?: string;
  sourceTitle?: string;
  variantCount?: number;
  inferredSubject?: string;
  inferredGradeLevel?: string;
  inferredOriginalTopic?: string;
  originalStructureSummary?: string;
  examVariants?: AIExamVariant[];
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

export interface MissingExamsClassInfo {
  id?: string;
  name?: string;
}

export interface MissingExamAssignment {
  studentExamId: string;
  examId: string;
  examName: string;
  start: string | null;
  end: string | null;
}

export interface MissingExamStudent {
  studentId: string;
  studentName: string;
  missingExamCount: number;
  missingExams: MissingExamAssignment[];
}

export interface ClassMissingExamsSummary {
  schoolClass: MissingExamsClassInfo | null;
  totalActiveStudents: number;
  studentsWithMissingExamsCount: number;
  totalMissingExamAssignments: number;
  students: MissingExamStudent[];
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
  /** Essay answer text typed by the student. */
  essayAnswer?: string;
  /** Fill-in-the-blank / matching: chosen word / option per slot. */
  slotAnswers?: SlotAnswer[];
};

export enum AssignmentStatus {
  NEW = 'Mới giao',
  IN_PROGRESS = 'Đang làm',
  EXPIRED = 'Hết giờ',
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
  deadline: string;
  deadlineDisplay: string;
  status: AssignmentStatus;
  isOverdue?: boolean;
  start?: string;
  end?: string;
  durationMinutes?: number;
  startedAt?: string | null;
  attemptDeadlineUtc?: string | null;
  isAttemptExpired?: boolean;
  canStartAttempt?: boolean;
  score?: number | null;
  assessmentStatus?: 'NotStarted' | 'Pending' | 'Completed' | 'Failed';
  canRetry?: boolean;
  canRetryAssessment?: boolean;
  assessmentError?: string | null;
  statusMessage?: string;
  studentExamId?: string | null;
  isSubmitted?: boolean;
  antiCheatEnabled?: boolean;
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
  avatarUrl?: string | null;
  dateCreated?: string;
  dateModified?: string;
  isActive?: boolean;
  isDeleted?: boolean;
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
  antiCheatStatus?: AntiCheatStatus | null;
  behaviorAdjustmentAccumulation?: CompetencyAccumulation | null;
  selfDevelopmentAccumulation?: CompetencyAccumulation | null;
  economicSocialParticipationAccumulation?: CompetencyAccumulation | null;
  finishedAt?: string;
  assessedAt?: string | null;
  assessmentError?: string | null;
  canRetryAssessment?: boolean;
  pendingEssayCount?: number;
  awaitingTeacherEssayCount?: number;
}

export type AntiCheatStatus = 'Normal' | 'Suspicious' | 'Violated';

export interface AntiCheatDetailSummary {
  studentExamId: string;
  isEnabled?: boolean;
  violationStatus: AntiCheatStatus;
  suspiciousScore: number | null;
  totalEventCount: number;
  hiddenIncidentCount: number;
  blurIncidentCount: number;
  pasteCount: number;
  copyCount: number;
  tabSwitchCount: number;
  fullscreenExitCount: number;
  reloadCount: number;
  offlineCount: number;
  totalHiddenSeconds: number;
  totalBlurSeconds: number;
  lastUpdatedAt: string | null;
}

export interface AntiCheatBreakdownItem {
  eventType: string;
  acceptedCount: number;
  duplicateCount: number;
  totalReceivedCount: number;
  lastOccurredAt: string | null;
}

export interface AntiCheatRecentEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  receivedAt: string;
  isDuplicate: boolean;
  metadata?: string | null;
}

export interface AntiCheatDetailsResponse {
  isEnabled?: boolean;
  summary: AntiCheatDetailSummary;
  breakdown: AntiCheatBreakdownItem[];
  recentEvents: AntiCheatRecentEvent[];
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
  startedAt?: string | null;
  finishedAt?: string | null;
  assessedAt?: string | null;
  canRetryAssessment?: boolean;
  canReactivateAttempt?: boolean;
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

export interface AccountMe {
  accountId: string;
  username: string;
  name: string;
  role: string;
  email?: string;
  profileId?: string;
}

export interface CompletedExam {
  studentExamId: string;
  examId: string;
  examName: string;
  start: string;
  end: string;
  finishedAt: string;
  assessedAt: string | null;
  score: number | null;
  behaviorAdjustmentScore: number | null;
  selfDevelopmentScore: number | null;
  economicSocialParticipationScore: number | null;
  assessmentStatus: 'NotStarted' | 'Pending' | 'Completed' | 'Failed';
  overallFeedback: string | null;
  canRetryAssessment: boolean;
  antiCheatEnabled?: boolean;
}

export interface AnalyticsProgressItem {
  studentExamId: string;
  examName: string;
  finishedAt: string;
  score: number;
  behaviorAdjustmentScore: number | null;
  selfDevelopmentScore: number | null;
  economicSocialParticipationScore: number | null;
}

export interface StudentAnalytics {
  studentId: string;
  studentName: string;
  completedExamCount: number;
  overallAverageScore: number;
  behaviorAdjustmentAverageScore: number | null;
  selfDevelopmentAverageScore: number | null;
  economicSocialParticipationAverageScore: number | null;
  progressOverTime: AnalyticsProgressItem[];
}

export interface ScoreDistributionItem {
  label: string;
  rangeMin: number;
  rangeMax: number;
  count: number;
}

export interface ExamAnalytics {
  examId: string;
  examName: string;
  totalStudents: number;
  submittedCount: number;
  notSubmittedCount: number;
  averageScore: number;
  averageBehaviorAdjustmentScore: number | null;
  averageSelfDevelopmentScore: number | null;
  averageEconomicSocialParticipationScore: number | null;
  highestScore: number;
  lowestScore: number;
  scoreDistribution: ScoreDistributionItem[];
}

export interface ClassReportProgressItem {
  studentExamId: string;
  examName: string;
  finishedAt: string;
  score: number;
  behaviorAdjustmentScore: number | null;
  selfDevelopmentScore: number | null;
  economicSocialParticipationScore: number | null;
}

export interface ClassReportStudent {
  studentId: string;
  studentName: string;
  totalExams: number;
  completedExams: number;
  completionRate: number;
  averageScore: number | null;
  averageBehaviorAdjustmentScore: number | null;
  averageSelfDevelopmentScore: number | null;
  averageEconomicSocialParticipationScore: number | null;
  progressOverTime: ClassReportProgressItem[];
}

export interface ClassReport {
  classId: string;
  className: string;
  totalExams: number;
  students: ClassReportStudent[];
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
  essayAnswers?: EssayAnswerReview[];
  /** Fill-in-the-blank / matching answers with per-slot correctness (submitted attempts only). */
  structuredAnswers?: StructuredAnswerReview[];
  pendingEssayCount?: number;
  awaitingTeacherEssayCount?: number;
  assessmentError: string | null;
  finishedAt: string;
  assessedAt: string | null;
  canRetryAssessment?: boolean;
}

export type EssayGradingStatus =
  | 'NotApplicable'
  | 'Pending'
  | 'AiGraded'
  | 'AwaitingTeacher'
  | 'TeacherGraded'
  | 'NoAnswer';

/** One essay answer in a result. score / maxPoints are POINTS; score is null while pending or awaiting teacher. */
export interface EssayAnswerReview {
  answerId: string;
  questionId: string;
  questionContent: string;
  competencyType?: string;
  competencyLabel?: string;
  difficultyLevel?: DifficultyLevel;
  difficultyLabel?: string;
  maxPoints: number;
  studentAnswer?: string | null;
  score: number | null;
  gradingStatus: EssayGradingStatus;
  gradingStatusLabel?: string;
  gradingFeedback?: string | null;
  gradedAt?: string | null;
  gradedByTeacherId?: string | null;
  isTeacherGraded?: boolean;
  canRegradeWithAi?: boolean;
  /** Only returned for teachers. */
  sampleAnswer?: string | null;
  /** Rubric and AI points per ý; teachers only. */
  rubricItems?: EssayRubricItem[];
  rubricResults?: EssayRubricResult[];
  /** Shared situation of an essay group (displayed once above the group). */
  passageText?: string | null;
  passageGroupKey?: string | null;
}

export interface StructuredSlotReview {
  slot: number;
  /** Matching: column A text. */
  prompt?: string | null;
  selectedChoiceId?: string | null;
  selectedText?: string | null;
  correctText?: string | null;
  isCorrect: boolean;
}

export interface StructuredAnswerReview {
  questionId: string;
  questionFormat: QuestionFormat;
  questionFormatLabel?: string;
  /** Fill-in-the-blank: passage with [[n]] markers. Matching: instruction. */
  questionContent: string;
  passageText?: string | null;
  competencyType?: string;
  competencyLabel?: string;
  /** Earned fraction 0..1 (the question weighs 1 unit). */
  score: number;
  correctCount: number;
  slotCount: number;
  slots: StructuredSlotReview[];
}

export interface EssayGradeResult {
  studentExamId: string;
  answer: EssayAnswerReview;
  score: number | null;
  behaviorAdjustmentScore: number | null;
  selfDevelopmentScore: number | null;
  economicSocialParticipationScore: number | null;
  pendingEssayCount: number;
  awaitingTeacherEssayCount: number;
}

// ---- "Tạo đề thi từ file" (exam scan) ----
export interface ScannedChoice {
  optionLabel: string;
  content: string;
  isCorrect: boolean;
  /** Fill-in-the-blank: blank number; matching: column A number; null = distractor / not set. */
  correctSlot?: number | null;
}

/** One question extracted from an exam file (true/false groups are flattened: one item per statement). */
export interface ScannedQuestion {
  order: number;
  sourceNumber?: string | null;
  questionFormat: QuestionFormat;
  content: string;
  competencyType: string;
  difficultyLevel: DifficultyLevel;
  passageText?: string | null;
  passageGroupKey?: string | null;
  statementOrder?: number | null;
  choices: ScannedChoice[];
  /** Correct answer proposed by AI (not in the file): "AI đoán – cần kiểm tra". */
  isAnswerAiGuessed: boolean;
  hasFigure: boolean;
  figureDescription?: string | null;
  sampleAnswer?: string | null;
  statedPoints?: number | null;
  maxPoints?: number | null;
  /** Essay: rubric from the marking guide; points null when not convertible (teacher must fill). */
  rubricItems?: EssayRubricItem[];
  /** Matching: column A items in order. */
  matchingPrompts?: string[];
  missingCorrectAnswer?: boolean;
  missingSampleAnswer?: boolean;
  missingMaxPoints?: boolean;
}

export interface SkippedScanQuestion {
  number?: string | null;
  excerpt: string;
  reason: string;
}

export interface ExamScanResult {
  sourceFileNames: string[];
  sourceType: string;
  suggestedTitle?: string | null;
  suggestedSubject?: string | null;
  suggestedDurationMinutes?: number | null;
  singleChoicePoints?: number | null;
  trueFalseGroupPoints?: number | null;
  questions: ScannedQuestion[];
  skippedQuestions: SkippedScanQuestion[];
  warnings: string[];
}
