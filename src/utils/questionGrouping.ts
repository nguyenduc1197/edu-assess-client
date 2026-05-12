import { Question } from '../types';
import { buildQuestionRenderGroups } from './groupQuestionsBySharedPassage';

export type QuestionBlock = {
  key: string;
  type: 'single' | 'group';
  groupKind?: 'trueFalse' | 'passage';
  questions: Question[];
  passageText?: string | null;
  questionNumbers: number[];
};

export type QuestionPreviewBlock =
  | { key: string; type: 'single'; question: Question }
  | {
      key: string;
      type: 'passage-group' | 'true-false-group';
      leadQuestion: Question;
      questions: Question[];
      passageText?: string | null;
    };

const normalizePassageText = (value?: string | null) => value?.trim() || null;

const getGroupedTrueFalseKey = (question: Question) => {
  const groupKey = question.passageGroupKey?.trim();
  return question.questionFormat === 'TrueFalse' && groupKey ? groupKey : null;
};

export const buildQuestionBlocks = (questions: Question[]): QuestionBlock[] => {
  let nextQuestionNumber = 1;

  return buildQuestionRenderGroups(questions).map((group) => {
    const questionNumbers = group.questions.map(() => nextQuestionNumber++);

    return {
      key: group.key,
      type: group.type,
      groupKind: group.groupKind,
      questions: group.questions,
      passageText: group.passageText,
      questionNumbers,
    };
  });
};

export const buildQuestionPreviewBlocks = (questions: Question[]): QuestionPreviewBlock[] => {
  const blocks: QuestionPreviewBlock[] = [];
  const processedTrueFalseKeys = new Set<string>();

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const trueFalseGroupKey = getGroupedTrueFalseKey(question);

    if (trueFalseGroupKey) {
      if (processedTrueFalseKeys.has(trueFalseGroupKey)) {
        continue;
      }

      const groupedQuestions = questions
        .filter((candidate) => getGroupedTrueFalseKey(candidate) === trueFalseGroupKey)
        .sort(
          (left, right) =>
            (left.statementOrder ?? Number.MAX_SAFE_INTEGER) -
            (right.statementOrder ?? Number.MAX_SAFE_INTEGER)
        );

      blocks.push({
        key: trueFalseGroupKey,
        type: 'true-false-group',
        leadQuestion: question,
        questions: groupedQuestions,
        passageText:
          groupedQuestions.find((candidate) => normalizePassageText(candidate.passageText))?.passageText ||
          question.passageText,
      });
      processedTrueFalseKeys.add(trueFalseGroupKey);
      continue;
    }

    const passageText =
      question.questionFormat === 'SingleChoice' ? normalizePassageText(question.passageText) : null;

    if (passageText) {
      const groupedQuestions = [question];
      let nextIndex = index + 1;

      while (nextIndex < questions.length) {
        const nextQuestion = questions[nextIndex];
        if (
          nextQuestion.questionFormat !== 'SingleChoice' ||
          normalizePassageText(nextQuestion.passageText) !== passageText
        ) {
          break;
        }

        groupedQuestions.push(nextQuestion);
        nextIndex += 1;
      }

      if (groupedQuestions.length > 1) {
        blocks.push({
          key: `passage-${question.id}-${index}`,
          type: 'passage-group',
          leadQuestion: question,
          questions: groupedQuestions,
          passageText,
        });
        index = nextIndex - 1;
        continue;
      }
    }

    blocks.push({ key: question.id, type: 'single', question });
  }

  return blocks;
};
