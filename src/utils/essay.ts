import { AnswerState, EssayGradingStatus, Question } from '../types';

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

/** True when the student actually answered (a choice picked, or non-blank essay text). */
export const hasAnswerContent = (answer?: AnswerState | null) =>
  !!answer && (!!answer.choiceId || !!answer.essayAnswer?.trim());

export interface SubmitAnswerPayload {
  questionId: string;
  choiceId: string | null;
  essayAnswer: string | null;
}

/** Builds the `answers` array sent to save-draft / submit (essay text included, trimmed; blank => null). */
export const buildAnswerPayload = (answers: Record<string, AnswerState>): SubmitAnswerPayload[] =>
  Object.entries(answers).map(([questionId, value]) => {
    const essayText = value.essayAnswer?.trim();
    return {
      questionId,
      choiceId: value.choiceId ? value.choiceId : null,
      essayAnswer: essayText ? essayText : null,
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

    const choice = draft.choiceId ? (question.choices || []).find((c) => c.id === draft.choiceId) : undefined;
    if (choice?.id) {
      restored[question.id] = { choiceId: choice.id, content: choice.content };
    }
  }

  return restored;
};
