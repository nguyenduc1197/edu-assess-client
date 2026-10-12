import { Question } from '../types';

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
  choices:
    question.questionFormat === 'Essay'
      ? []
      : (question.choices || []).map((choice) => ({
          optionLabel: choice.optionLabel,
          content: choice.content.trim(),
          isCorrect: !!choice.isCorrect,
        })),
  ...(question.questionFormat === 'Essay'
    ? {
        maxPoints: question.maxPoints ?? 1,
        sampleAnswer: question.sampleAnswer?.trim() || '',
      }
    : {}),
});

/**
 * Request body for PUT /questions/{id}. Same as create, but every existing choice keeps its id so the
 * backend updates it in place (choices without id are added, missing ones are removed).
 */
export const buildUpdateQuestionPayload = (question: Question) => {
  const base = buildCreateQuestionPayload(question);
  return {
    ...base,
    choices:
      question.questionFormat === 'Essay'
        ? []
        : (question.choices || []).map((choice) => ({
            id: choice.id || null,
            optionLabel: choice.optionLabel,
            content: choice.content.trim(),
            isCorrect: !!choice.isCorrect,
          })),
  };
};
