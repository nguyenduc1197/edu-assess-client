import { Question } from '../types';
import { isStructuredFormat, toStructuredChoicePayload } from './structuredQuestion';

const choicesPayload = (question: Question, keepIds: boolean) => {
  if (question.questionFormat === 'Essay') return [];
  if (isStructuredFormat(question.questionFormat)) return toStructuredChoicePayload(question.choices || [], keepIds);
  return (question.choices || []).map((choice) => ({
    ...(keepIds ? { id: choice.id || null } : {}),
    optionLabel: choice.optionLabel,
    content: choice.content.trim(),
    isCorrect: !!choice.isCorrect,
  }));
};

/** Request body for POST /questions and POST /questions/bulk. */
export const buildCreateQuestionPayload = (question: Question) => ({
  content: question.content.trim(),
  competencyType: question.competencyType,
  questionFormat: question.questionFormat,
  difficultyLevel: question.difficultyLevel,
  passageText: question.passageText?.trim() || undefined,
  passageGroupKey: question.passageGroupKey?.trim() || undefined,
  statementOrder: question.statementOrder ?? undefined,
  sourceEvidence: question.sourceEvidence?.trim() || undefined,
  choices: choicesPayload(question, false),
  ...(question.questionFormat === 'Matching' ? { matchingPrompts: (question.matchingPrompts || []).map((p) => p.trim()) } : {}),
  ...(question.questionFormat === 'Essay'
    ? question.rubricItems && question.rubricItems.length > 0
      ? {
          // Rubric ("danh sách ý"): max points = sum of ý points (computed by the backend).
          rubricItems: question.rubricItems.map((item) => ({ content: item.content.trim(), points: item.points ?? null })),
        }
      : {
          maxPoints: question.maxPoints ?? 1,
          sampleAnswer: question.sampleAnswer?.trim() || '',
        }
    : {}),
});

/**
 * Request body for PUT /questions/{id}. Same as create, but every existing choice keeps its id so the
 * backend updates it in place (choices without id are added, missing ones are removed).
 */
export const buildUpdateQuestionPayload = (question: Question) => ({
  ...buildCreateQuestionPayload(question),
  // Essays can clear their shared situation: send explicit nulls instead of omitting the fields.
  ...(question.questionFormat === 'Essay'
    ? { passageText: question.passageText?.trim() || null, passageGroupKey: question.passageGroupKey?.trim() || null }
    : {}),
  choices: choicesPayload(question, true),
});
