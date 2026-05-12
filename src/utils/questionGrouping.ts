import { Question } from '../types';

export type QuestionBlock = {
  key: string;
  type: 'single' | 'group';
  questions: Question[];
  passageText?: string | null;
};

export const buildQuestionBlocks = (questions: Question[]): QuestionBlock[] => {
  const groupQuestions = new Map<string, Question[]>();

  questions.forEach((question) => {
    const groupKey = question.passageGroupKey?.trim();

    if (question.questionFormat !== 'TrueFalse' || !groupKey) {
      return;
    }

    const items = groupQuestions.get(groupKey);
    if (items) {
      items.push(question);
      return;
    }

    groupQuestions.set(groupKey, [question]);
  });

  const processedGroups = new Set<string>();

  return questions.reduce<QuestionBlock[]>((blocks, question) => {
    const groupKey = question.passageGroupKey?.trim();

    if (question.questionFormat === 'TrueFalse' && groupKey) {
      if (processedGroups.has(groupKey)) {
        return blocks;
      }

      const groupedQuestions = groupQuestions.get(groupKey) || [question];

      blocks.push({
        key: groupKey,
        type: 'group',
        questions: groupedQuestions,
        passageText:
          groupedQuestions.find((item) => item.passageText)?.passageText || question.passageText,
      });

      processedGroups.add(groupKey);
      return blocks;
    }

    blocks.push({ key: question.id, type: 'single', questions: [question] });
    return blocks;
  }, []);
};
