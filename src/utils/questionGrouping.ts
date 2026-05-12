import { Question } from '../types';

export type QuestionBlock = {
  key: string;
  type: 'single' | 'group';
  questions: Question[];
  passageText?: string | null;
};

export const buildQuestionBlocks = (questions: Question[]): QuestionBlock[] => {
  const processedGroups = new Set<string>();

  return questions.reduce<QuestionBlock[]>((blocks, question) => {
    const groupKey = question.passageGroupKey?.trim();

    if (question.questionFormat === 'TrueFalse' && groupKey) {
      if (processedGroups.has(groupKey)) {
        return blocks;
      }

      const groupedQuestions = questions.filter(
        (item) =>
          item.questionFormat === 'TrueFalse' &&
          item.passageGroupKey?.trim() === groupKey
      );

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
