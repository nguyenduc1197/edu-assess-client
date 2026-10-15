import { AnswerState, Choice, Question, QuestionFormat, SlotAnswer } from '../types';

/** Fill-in-the-blank / matching helpers (same rules as backend StructuredQuestionRules). */

export const STRUCTURED_MAX_SLOTS = 20;
export const STRUCTURED_MAX_CHOICES = 20;
export const STRUCTURED_CHOICE_MAX_LENGTH = 500;
export const MATCHING_PROMPT_MAX_LENGTH = 1000;

const BLANK_REGEX = /\[\[\s*(\d+)\s*\]\]/g;

export const isStructuredFormat = (format?: QuestionFormat | null) => format === 'FillInBlank' || format === 'Matching';

export const isStructuredQuestion = (question?: Pick<Question, 'questionFormat'> | null) =>
  isStructuredFormat(question?.questionFormat);

/** Blank numbers in order of appearance ("[[1]] ... [[2]]"). */
export const parseBlankNumbers = (content?: string | null): number[] =>
  Array.from((content || '').matchAll(BLANK_REGEX), (match) => Number(match[1]));

export type PassagePart = { kind: 'text'; text: string } | { kind: 'blank'; slot: number };

/** Splits a fill-in-the-blank passage into text and blank parts. */
export const splitBlankPassage = (content?: string | null): PassagePart[] => {
  const parts: PassagePart[] = [];
  const text = content || '';
  let last = 0;
  for (const match of Array.from(text.matchAll(BLANK_REGEX))) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: 'text', text: text.slice(last, index) });
    parts.push({ kind: 'blank', slot: Number(match[1]) });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
};

/** Number of slots: blanks for fill-in-the-blank, column A items for matching. */
export const slotCountOf = (question: Pick<Question, 'questionFormat' | 'content' | 'matchingPrompts'>) =>
  question.questionFormat === 'FillInBlank'
    ? parseBlankNumbers(question.content).length
    : question.questionFormat === 'Matching'
      ? (question.matchingPrompts || []).length
      : 0;

export const choiceLabelFor = (index: number) => (index >= 0 && index < 26 ? String.fromCharCode(65 + index) : '');

/** Validates a fill-in-the-blank / matching question. Returns the first error message or null. */
export const validateStructuredQuestion = (
  question: Pick<Question, 'questionFormat' | 'content' | 'matchingPrompts' | 'choices'>
): string | null => {
  let slotCount: number;
  if (question.questionFormat === 'FillInBlank') {
    const blanks = parseBlankNumbers(question.content);
    if (blanks.length === 0) return 'Đoạn văn phải có ít nhất một chỗ trống dạng [[1]].';
    if (blanks.length > STRUCTURED_MAX_SLOTS) return 'Tối đa 20 chỗ trống / 20 vế ghép nối.';
    const sorted = [...blanks].sort((a, b) => a - b);
    if (sorted.some((value, index) => value !== index + 1)) {
      return 'Các chỗ trống phải được đánh số liên tiếp [[1]], [[2]], ... và mỗi số chỉ xuất hiện một lần.';
    }
    slotCount = blanks.length;
  } else {
    const prompts = question.matchingPrompts || [];
    if (prompts.length < 2) return 'Câu ghép nối cần ít nhất 2 vế ở cột A.';
    if (prompts.length > STRUCTURED_MAX_SLOTS) return 'Tối đa 20 chỗ trống / 20 vế ghép nối.';
    if (prompts.some((prompt) => !prompt.trim())) return 'Không được để trống vế ở cột A.';
    if (prompts.some((prompt) => prompt.trim().length > MATCHING_PROMPT_MAX_LENGTH)) {
      return 'Mỗi vế ở cột A không được vượt quá 1000 ký tự.';
    }
    slotCount = prompts.length;
  }

  const choices = question.choices || [];
  if (choices.length < slotCount || choices.length > STRUCTURED_MAX_CHOICES) {
    return 'Ngân hàng từ / cột B phải có ít nhất bằng số chỗ trống / số vế cột A và tối đa 20 mục.';
  }
  if (choices.some((choice) => !choice.content.trim())) return 'Không được để trống từ / phương án.';
  if (choices.some((choice) => choice.content.trim().length > STRUCTURED_CHOICE_MAX_LENGTH)) {
    return 'Mỗi từ / phương án không được vượt quá 500 ký tự.';
  }
  const normalized = choices.map((choice) => choice.content.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) return 'Các từ / phương án không được trùng nhau.';
  if (choices.some((choice) => choice.correctSlot != null && (choice.correctSlot < 1 || choice.correctSlot > slotCount))) {
    return 'Đáp án gán cho chỗ trống / vế không tồn tại.';
  }
  for (let slot = 1; slot <= slotCount; slot += 1) {
    if (choices.filter((choice) => choice.correctSlot === slot).length !== 1) {
      return 'Mỗi chỗ trống / vế cột A phải có đúng một đáp án đúng.';
    }
  }
  return null;
};

/** Choice payload for create / update / scan of the new formats. */
export const toStructuredChoicePayload = (choices: Choice[], keepIds: boolean) =>
  choices.map((choice, index) => ({
    ...(keepIds ? { id: choice.id || null } : {}),
    optionLabel: choiceLabelFor(index),
    content: choice.content.trim(),
    isCorrect: choice.correctSlot != null,
    correctSlot: choice.correctSlot ?? null,
  }));

/**
 * Places a choice into a slot (each choice used at most once): a choice already in another slot moves,
 * and the slot's previous choice goes back to the bank. choiceId null clears the slot.
 */
export const placeChoice = (current: SlotAnswer[] | undefined, slot: number, choiceId: string | null): SlotAnswer[] => {
  const next = (current || []).filter((answer) => answer.slot !== slot && (choiceId === null || answer.choiceId !== choiceId));
  if (choiceId !== null) next.push({ slot, choiceId });
  return next.sort((a, b) => a.slot - b.slot);
};

/** True when at least one slot has a choice. */
export const hasSlotAnswers = (answer?: AnswerState | null) => !!answer?.slotAnswers?.some((item) => !!item.choiceId);

/** Draft restore: keeps only slots that exist on the question and choices that still exist. */
export const sanitizeSlotAnswers = (question: Question, slotAnswers: SlotAnswer[] | null | undefined): SlotAnswer[] => {
  const slotCount = slotCountOf(question);
  const choiceIds = new Set((question.choices || []).map((choice) => choice.id));
  let result: SlotAnswer[] = [];
  for (const answer of slotAnswers || []) {
    if (answer.slot >= 1 && answer.slot <= slotCount && answer.choiceId && choiceIds.has(answer.choiceId)) {
      result = placeChoice(result, answer.slot, answer.choiceId);
    }
  }
  return result;
};
