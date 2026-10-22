import { AnswerState, EssayGradingStatus, EssayRubricItem, Question, SlotAnswer } from '../types';
import { isStructuredQuestion, sanitizeSlotAnswers } from './structuredQuestion';

export const ESSAY_DEFAULT_MAX_POINTS = 1;
export const ESSAY_MAX_ALLOWED_POINTS = 40;
export const ESSAY_SAMPLE_ANSWER_MAX_LENGTH = 4000;
export const ESSAY_FEEDBACK_MAX_LENGTH = 2000;

/** Question text limits (same as backend QuestionTextRules). */
export const QUESTION_CONTENT_MAX_LENGTH = 4000;
export const QUESTION_PASSAGE_MAX_LENGTH = 8000;
export const QUESTION_CONTENT_TOO_LONG_MESSAGE = 'Nội dung câu hỏi không được vượt quá 4000 ký tự.';
export const QUESTION_PASSAGE_TOO_LONG_MESSAGE = 'Đoạn tư liệu không được vượt quá 8000 ký tự.';

export const isEssayQuestion = (question?: Pick<Question, 'questionFormat'> | null) =>
  question?.questionFormat === 'Essay';

/** True when the student actually answered (a choice picked, non-blank essay text, or at least one slot filled). */
export const hasAnswerContent = (answer?: AnswerState | null) =>
  !!answer && (!!answer.choiceId || !!answer.essayAnswer?.trim() || !!answer.slotAnswers?.some((item) => !!item.choiceId));

export interface SubmitAnswerPayload {
  questionId: string;
  choiceId: string | null;
  essayAnswer: string | null;
  slotAnswers?: SlotAnswer[] | null;
}

/** Builds the `answers` array sent to save-draft / submit (essay text included, trimmed; blank => null). */
export const buildAnswerPayload = (answers: Record<string, AnswerState>): SubmitAnswerPayload[] =>
  Object.entries(answers).map(([questionId, value]) => {
    const essayText = value.essayAnswer?.trim();
    return {
      questionId,
      choiceId: value.choiceId ? value.choiceId : null,
      essayAnswer: essayText ? essayText : null,
      ...(value.slotAnswers ? { slotAnswers: value.slotAnswers.filter((item) => !!item.choiceId) } : {}),
    };
  });

const parseDecimal = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(',', '.');
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
};

const hasAtMostTwoDecimals = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-9;

/** True when value is a multiple of 0.25 (0.25, 0.5, 0.75, ...). */
const isQuarterStep = (value: number) => Math.abs(Math.round(value * 4) - value * 4) < 1e-9;

export const ESSAY_MAX_POINTS_STEP_MESSAGE = 'Điểm tối đa của câu tự luận phải là bội số của 0.25 (ví dụ 0.25, 0.5, 1.75).';

/** Validates the teacher-entered max points of an essay. Returns an error message or null. */
export const validateEssayMaxPoints = (value: string | number | null | undefined): string | null => {
  const parsed = parseDecimal(value);
  if (parsed === null) return 'Vui lòng nhập điểm tối đa hợp lệ cho câu tự luận.';
  if (parsed <= 0 || parsed > ESSAY_MAX_ALLOWED_POINTS) {
    return 'Điểm tối đa của câu tự luận phải lớn hơn 0 và không vượt quá 40.';
  }
  if (!isQuarterStep(parsed)) {
    return ESSAY_MAX_POINTS_STEP_MESSAGE;
  }
  return null;
};

export const ESSAY_RUBRIC_MAX_ITEMS = 20;
export const ESSAY_RUBRIC_ITEM_MAX_LENGTH = 2000;

/** Rubric item being edited: points kept as raw text. */
export interface RubricItemInput {
  content: string;
  points: string;
  /** Competency of this ý; '' / undefined = same as the question. */
  competencyType?: string;
}

export const toRubricInputs = (items: EssayRubricItem[] | null | undefined): RubricItemInput[] =>
  (items || []).map((item) => ({
    content: item.content,
    points: item.points != null ? String(item.points) : '',
    competencyType: item.competencyType || '',
  }));

/**
 * Rubric of an existing essay for editing; a legacy essay without rubric becomes one ý
 * (sample answer, old max points) as the backend does.
 */
export const rubricInputsForQuestion = (question: Pick<Question, 'rubricItems' | 'sampleAnswer' | 'maxPoints'>): RubricItemInput[] => {
  if (question.rubricItems && question.rubricItems.length > 0) return toRubricInputs(question.rubricItems);
  if (question.sampleAnswer?.trim()) {
    return [{ content: question.sampleAnswer, points: String(question.maxPoints ?? ESSAY_DEFAULT_MAX_POINTS) }];
  }
  return [{ content: '', points: '' }];
};

/** Sum of valid item points (invalid items count as 0). */
export const rubricTotal = (items: RubricItemInput[]) =>
  items.reduce((sum, item) => sum + (parseDecimal(item.points) ?? 0), 0);

/** Validates a rubric (same rules as backend EssayRubricRules). Returns the first error message or null. */
export const validateRubric = (items: RubricItemInput[]): string | null => {
  if (items.length === 0) return 'Câu tự luận phải có ít nhất một ý trong danh sách ý (đáp án / tiêu chí chấm).';
  if (items.length > ESSAY_RUBRIC_MAX_ITEMS) return 'Danh sách ý tối đa 20 ý.';
  for (const item of items) {
    const content = item.content.trim();
    if (!content) return 'Nội dung mỗi ý không được để trống.';
    if (content.length > ESSAY_RUBRIC_ITEM_MAX_LENGTH) return 'Nội dung mỗi ý không được vượt quá 2000 ký tự.';
    const points = parseDecimal(item.points);
    if (points === null || points <= 0 || !isQuarterStep(points)) return 'Điểm của mỗi ý phải lớn hơn 0 và là bội số của 0.25.';
  }
  const total = rubricTotal(items);
  if (total <= 0 || total > ESSAY_MAX_ALLOWED_POINTS) return 'Tổng điểm các ý phải lớn hơn 0 và không vượt quá 40.';
  return null;
};

export const toRubricPayload = (items: RubricItemInput[]): EssayRubricItem[] =>
  items.map((item) => ({
    content: item.content.trim(),
    points: parseDecimal(item.points),
    ...(item.competencyType ? { competencyType: item.competencyType } : {}),
  }));

/** Validates the sample answer / grading criteria. Returns an error message or null. */
export const validateEssaySampleAnswer = (value: string | null | undefined): string | null => {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Câu tự luận bắt buộc phải có đáp án mẫu / tiêu chí chấm.';
  if (trimmed.length > ESSAY_SAMPLE_ANSWER_MAX_LENGTH) {
    return 'Đáp án mẫu / tiêu chí chấm không được vượt quá 4000 ký tự.';
  }
  return null;
};

/** Validates a teacher override score (0..maxPoints, max 2 decimals). Returns an error message or null. */
export const validateEssayScore = (value: string | number | null | undefined, maxPoints: number): string | null => {
  const parsed = parseDecimal(value);
  if (parsed === null) return 'Vui lòng nhập điểm hợp lệ.';
  if (parsed < 0 || parsed > maxPoints) return `Điểm phải nằm trong khoảng 0 đến ${formatPoints(maxPoints)}.`;
  if (!hasAtMostTwoDecimals(parsed)) return 'Điểm chỉ được có tối đa 2 chữ số thập phân.';
  return null;
};

export const parseEssayNumber = (value: string | number | null | undefined): number | null => parseDecimal(value);

/** Formats points without trailing zeros (1 -> "1", 1.5 -> "1.5", 0.25 -> "0.25"). */
export const formatPoints = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return String(Math.round(value * 100) / 100);
};

export const getEssayGradingStatusLabel = (status?: EssayGradingStatus | string | null) => {
  switch (status) {
    case 'Pending':
      return 'Đang chấm';
    case 'AiGraded':
      return 'AI đã chấm';
    case 'AwaitingTeacher':
      return 'Chờ giáo viên chấm';
    case 'TeacherGraded':
      return 'Giáo viên đã chấm';
    case 'NoAnswer':
      return 'Không trả lời';
    default:
      return '';
  }
};

/** Text shown in place of the score: "Đang chấm" / "Chờ giáo viên chấm" or "x / max điểm". */
export const formatEssayScore = (score: number | null | undefined, maxPoints: number, status?: EssayGradingStatus | string | null) => {
  if (status === 'Pending') return 'Đang chấm';
  if (status === 'AwaitingTeacher' || score === null || score === undefined) return 'Chờ giáo viên chấm';
  return `${formatPoints(score)} / ${formatPoints(maxPoints)} điểm`;
};

/** One saved draft answer from GET /exams/{examId}/draft. */
export interface DraftAnswer {
  questionId: string;
  choiceId?: string | null;
  essayAnswer?: string | null;
  slotAnswers?: SlotAnswer[] | null;
}

/**
 * Rebuilds the exam UI answer state from saved draft answers. Only questions of the current exam are kept;
 * a choice must still exist on its question; essay text is restored for essay questions.
 */
export const restoreDraftAnswers = (
  draftAnswers: DraftAnswer[] | null | undefined,
  questions: Question[]
): Record<string, AnswerState> => {
  const restored: Record<string, AnswerState> = {};
  const questionById = new Map(questions.map((question) => [question.id, question]));

  for (const draft of draftAnswers || []) {
    const question = questionById.get(draft.questionId);
    if (!question) continue;

    if (isEssayQuestion(question)) {
      if (draft.essayAnswer && draft.essayAnswer.trim()) {
        restored[question.id] = { content: draft.essayAnswer, essayAnswer: draft.essayAnswer };
      }
      continue;
    }

    if (isStructuredQuestion(question)) {
      const slotAnswers = sanitizeSlotAnswers(question, draft.slotAnswers);
      if (slotAnswers.length > 0) restored[question.id] = { slotAnswers };
      continue;
    }

    const choice = draft.choiceId ? (question.choices || []).find((c) => c.id === draft.choiceId) : undefined;
    if (choice?.id) {
      restored[question.id] = { choiceId: choice.id, content: choice.content };
    }
  }

  return restored;
};
