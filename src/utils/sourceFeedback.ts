import { CompetencyComment, QuestionFormat } from '../types';

/** One option of an exam question matched to the re-scanned file (POST /exams/{id}/source-feedback/match). */
export interface SourceFeedbackChoice {
  choiceId: string;
  content: string;
  isCorrect: boolean;
  /** Feedback found in the file (null = none). */
  feedback?: string | null;
  /** Feedback stored now. */
  currentFeedback?: string | null;
}

export interface SourceFeedbackQuestion {
  questionId: string;
  examOrder?: number | null;
  questionFormat: QuestionFormat;
  questionContent: string;
  matched: boolean;
  scannedNumber?: string | null;
  explanation?: string | null;
  currentExplanation?: string | null;
  choices: SourceFeedbackChoice[];
}

export interface SourceFeedbackPreview {
  questions: SourceFeedbackQuestion[];
  competencyComments: CompetencyComment[];
  matchedCount: number;
  withFeedbackCount: number;
  unmatchedScanned: string[];
}

/** True when the matched question brings at least one feedback / explanation from the file. */
export const hasFileFeedback = (question: SourceFeedbackQuestion) =>
  question.matched && (!!question.explanation?.trim() || question.choices.some((choice) => !!choice.feedback?.trim()));

/**
 * Body of POST /exams/{id}/source-feedback/apply: only matched questions that carry feedback from the file
 * (nothing else is touched); "nhận xét theo bài" replaced only when the file has some.
 */
export const buildApplySourceFeedbackPayload = (preview: SourceFeedbackPreview, competencyComments: CompetencyComment[]) => {
  const comments = competencyComments
    .map((item) => ({ competencyType: item.competencyType, comment: item.comment.trim() }))
    .filter((item) => item.comment);
  return {
    questions: preview.questions.filter(hasFileFeedback).map((question) => ({
      questionId: question.questionId,
      // No explanation in the file: keep the current one.
      explanation: question.explanation?.trim() || question.currentExplanation || null,
      choices: question.choices
        .filter((choice) => !!choice.feedback?.trim())
        .map((choice) => ({ choiceId: choice.choiceId, feedback: choice.feedback!.trim() })),
    })),
    competencyComments: comments.length > 0 ? comments : null,
  };
};
