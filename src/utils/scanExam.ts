import { ExamScanResult, ScannedChoice, ScannedQuestion } from '../types';
import {
  parseEssayNumber,
  QUESTION_CONTENT_MAX_LENGTH,
  QUESTION_PASSAGE_MAX_LENGTH,
  validateEssayMaxPoints,
  validateEssaySampleAnswer,
} from './essay';

/** "Tạo đề thi từ file": client-side helpers (file checks, review validation, create payload). */

export const SCAN_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const SCAN_MAX_IMAGES = 20;
export const SCAN_CONTENT_MAX_LENGTH = QUESTION_CONTENT_MAX_LENGTH;
export const SCAN_PASSAGE_MAX_LENGTH = QUESTION_PASSAGE_MAX_LENGTH;
export const SCAN_CHOICE_MAX_LENGTH = 500;
export const SCAN_ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif';

export type ScanFileKind = 'pdf' | 'images' | 'docx';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

const extensionOf = (name: string) => (name.split('.').pop() || '').toLowerCase();

export const classifyScanFile = (file: Pick<File, 'name' | 'type'>): ScanFileKind | null => {
  const extension = extensionOf(file.name);
  const type = (file.type || '').toLowerCase();
  if (extension === 'pdf' || type === 'application/pdf') return 'pdf';
  if (extension === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (IMAGE_EXTENSIONS.includes(extension) || ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(type)) {
    return 'images';
  }
  return null;
};

/** Same rules as the backend: 1 PDF, or 1..20 images, or 1 .docx; max 20MB in total. Returns an error or null. */
export const validateScanFiles = (files: Array<Pick<File, 'name' | 'type' | 'size'>>): string | null => {
  if (!files || files.length === 0) return 'Vui lòng chọn file đề thi (PDF, ảnh hoặc Word .docx).';
  const kinds = files.map(classifyScanFile);
  if (kinds.some((kind) => kind === null)) {
    return 'Định dạng file không được hỗ trợ. Chỉ nhận 1 file PDF, nhiều ảnh (JPG, PNG, WEBP, HEIC) hoặc 1 file Word (.docx).';
  }
  if (new Set(kinds).size > 1) {
    return 'Chỉ được tải lên 1 file PDF, hoặc 1 file Word (.docx), hoặc nhiều ảnh cùng lúc — không trộn các loại file.';
  }
  if (files.some((file) => file.size <= 0)) return 'File tải lên bị rỗng.';
  if (files.reduce((sum, file) => sum + file.size, 0) > SCAN_MAX_TOTAL_BYTES) return 'Tổng dung lượng file vượt quá 20MB.';
  if (kinds[0] === 'pdf' && files.length > 1) return 'Chỉ được tải lên 1 file PDF.';
  if (kinds[0] === 'docx' && files.length > 1) return 'Chỉ được tải lên 1 file Word (.docx).';
  if (kinds[0] === 'images' && files.length > SCAN_MAX_IMAGES) return 'Chỉ được tải lên tối đa 20 ảnh.';
  return null;
};

/** A scanned question being reviewed by the teacher. */
export interface ReviewQuestion extends ScannedQuestion {
  key: string;
  /** Raw text of the max points input (essays). */
  maxPointsInput: string;
  /** Teacher confirmed (or changed) an answer that AI guessed. */
  answerConfirmed: boolean;
}

export const toReviewQuestions = (result: ExamScanResult): ReviewQuestion[] =>
  (result.questions || []).map((question, index) => ({
    ...question,
    choices: (question.choices || []).map((choice) => ({ ...choice })),
    key: `scan-${index}-${question.order}`,
    maxPointsInput: question.maxPoints !== null && question.maxPoints !== undefined ? String(question.maxPoints) : '',
    answerConfirmed: !question.isAnswerAiGuessed,
  }));

/** Validation errors of one question (1-based number = position in the exam). */
export const validateReviewQuestion = (question: ReviewQuestion, number: number): string[] => {
  const errors: string[] = [];
  const prefix = `Câu ${number}`;
  const content = (question.content || '').trim();

  if (!content) errors.push(`${prefix}: nội dung câu hỏi không được để trống.`);
  else if (content.length > SCAN_CONTENT_MAX_LENGTH) errors.push(`${prefix}: nội dung câu hỏi không được vượt quá 4000 ký tự.`);
  if ((question.passageText || '').trim().length > SCAN_PASSAGE_MAX_LENGTH) {
    errors.push(`${prefix}: đoạn tư liệu không được vượt quá 8000 ký tự.`);
  }

  if (question.questionFormat === 'Essay') {
    const sampleError = validateEssaySampleAnswer(question.sampleAnswer);
    if (sampleError) errors.push(`${prefix}: ${sampleError}`);
    const maxPointsError = question.maxPointsInput.trim() ? validateEssayMaxPoints(question.maxPointsInput) : 'Câu tự luận chưa có điểm tối đa.';
    if (maxPointsError) errors.push(`${prefix}: ${maxPointsError}`);
    return errors;
  }

  const choices = question.choices || [];
  if (choices.length < 2 || choices.some((choice) => !choice.content.trim())) {
    errors.push(`${prefix}: cần ít nhất 2 phương án và không được để trống phương án.`);
  }
  if (choices.some((choice) => choice.content.trim().length > SCAN_CHOICE_MAX_LENGTH)) {
    errors.push(`${prefix}: phương án không được vượt quá 500 ký tự.`);
  }
  if (choices.filter((choice) => choice.isCorrect).length !== 1) {
    errors.push(`${prefix}: phải chọn đúng một đáp án đúng.`);
  } else if (question.isAnswerAiGuessed && !question.answerConfirmed) {
    errors.push(`${prefix}: đáp án do AI đoán – cần kiểm tra và xác nhận.`);
  }
  return errors;
};

export interface ScanExamFields {
  name: string;
  schoolClassId: string;
  start: string;
  end: string;
  durationMinutes: string;
  antiCheatEnabled: boolean;
}

export const validateScanExamFields = (fields: ScanExamFields): string[] => {
  const errors: string[] = [];
  if (!fields.name.trim()) errors.push('Vui lòng nhập tên bài thi.');
  if (!fields.schoolClassId) errors.push('Vui lòng chọn lớp học.');
  if (!fields.start || !fields.end) errors.push('Vui lòng chọn thời gian bắt đầu và kết thúc giao bài.');
  else if (new Date(fields.end).getTime() <= new Date(fields.start).getTime()) {
    errors.push('Thời gian kết thúc giao bài phải sau thời gian bắt đầu.');
  }
  const duration = fields.durationMinutes.trim();
  if (!/^\d+$/.test(duration) || Number(duration) <= 0) errors.push('Thời lượng làm bài phải là số nguyên lớn hơn 0 phút.');
  return errors;
};

/** All blocking errors (questions + exam fields). Creation is allowed only when this is empty. */
export const collectScanReviewErrors = (questions: ReviewQuestion[], fields: ScanExamFields): string[] => [
  ...(questions.length === 0 ? ['Đề thi cần có ít nhất một câu hỏi.'] : []),
  ...questions.flatMap((question, index) => validateReviewQuestion(question, index + 1)),
  ...validateScanExamFields(fields),
];

const toChoicePayload = (choices: ScannedChoice[]) =>
  choices.map((choice) => ({ optionLabel: choice.optionLabel, content: choice.content.trim(), isCorrect: !!choice.isCorrect }));

/** Body of POST /exams/from-scan (questions keep the reviewed order). */
export const buildCreateFromScanPayload = (questions: ReviewQuestion[], fields: ScanExamFields) => ({
  name: fields.name.trim(),
  start: new Date(fields.start).toISOString(),
  end: new Date(fields.end).toISOString(),
  durationMinutes: Number(fields.durationMinutes),
  antiCheatEnabled: fields.antiCheatEnabled,
  schoolClassId: fields.schoolClassId,
  questions: questions.map((question) => ({
    questionFormat: question.questionFormat,
    content: question.content.trim(),
    competencyType: question.competencyType,
    difficultyLevel: question.difficultyLevel,
    passageText: question.passageText?.trim() || null,
    passageGroupKey: question.passageGroupKey || null,
    statementOrder: question.statementOrder ?? null,
    sourceEvidence: null,
    choices: question.questionFormat === 'Essay' ? [] : toChoicePayload(question.choices || []),
    sampleAnswer: question.questionFormat === 'Essay' ? question.sampleAnswer?.trim() || '' : null,
    maxPoints: question.questionFormat === 'Essay' ? parseEssayNumber(question.maxPointsInput) : null,
  })),
});

/** Marks the given choice as the only correct one (and confirms AI-guessed answers). */
export const setCorrectChoice = (question: ReviewQuestion, choiceIndex: number): ReviewQuestion => ({
  ...question,
  choices: question.choices.map((choice, index) => ({ ...choice, isCorrect: index === choiceIndex })),
  answerConfirmed: true,
});
