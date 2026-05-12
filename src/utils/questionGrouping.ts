import { Question } from '../types';

export type QuestionBlock = {
  key: string;
  type: 'single' | 'group';
  questions: Question[];
  passageText?: string | null;
};

const getGroupedTrueFalseKey = (question: Question) => {
  const groupKey = question.passageGroupKey?.trim();
  return question.questionFormat === 'TrueFalse' && groupKey ? groupKey : null;
};

export const buildQuestionBlocks = (questions: Question[]): QuestionBlock[] => {
  const groupQuestions = new Map<string, Question[]>();
  const questionGroupKeys = new Map<string, string>();

  questions.forEach((question) => {
    const groupKey = getGroupedTrueFalseKey(question);
    if (!groupKey) {
      return;
    }

    questionGroupKeys.set(question.id, groupKey);
    const items = groupQuestions.get(groupKey);
    if (items) {
      items.push(question);
      return;
    }

    groupQuestions.set(groupKey, [question]);
  });

  const processedGroups = new Set<string>();

  return questions.reduce<QuestionBlock[]>((blocks, question) => {
    const groupKey = questionGroupKeys.get(question.id);

    if (groupKey) {
      if (!processedGroups.has(groupKey)) {
        const groupedQuestions = groupQuestions.get(groupKey) || [question];

        blocks.push({
          key: groupKey,
          type: 'group',
          questions: groupedQuestions,
          passageText:
            groupedQuestions.find((item) => item.passageText)?.passageText || question.passageText,
        });

        processedGroups.add(groupKey);
      }

      return blocks;
    }

    blocks.push({ key: question.id, type: 'single', questions: [question] });
    return blocks;
  }, []);
};
