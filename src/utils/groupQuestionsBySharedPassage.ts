import { Question } from '../types';

export type SharedPassageQuestionGroup = {
  key: string;
  type: 'single' | 'group';
  groupKind?: 'trueFalse' | 'passage';
  questions: Question[];
  passageText?: string | null;
};

const normalizeValue = (value?: string | null) => value?.trim() || null;

const getNonEmptyPassageGroupKey = (question: Question) => normalizeValue(question.passageGroupKey);

const getNonEmptyPassageText = (question: Question) => normalizeValue(question.passageText);

const isGroupedTrueFalseQuestion = (question: Question) =>
  question.questionFormat === 'TrueFalse' && !!getNonEmptyPassageGroupKey(question);

const getStandaloneGroup = (question: Question): SharedPassageQuestionGroup => ({
  key: question.id,
  type: 'single',
  questions: [question],
  passageText: getNonEmptyPassageText(question),
});

const sortGroupedQuestions = (questions: Question[]) => {
  if (!questions.some((question) => question.statementOrder !== null && question.statementOrder !== undefined)) {
    return questions;
  }

  return [...questions].sort(
    (left, right) =>
      (left.statementOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.statementOrder ?? Number.MAX_SAFE_INTEGER)
  );
};

export const buildQuestionRenderGroups = (questions: Question[]): SharedPassageQuestionGroup[] => {
  const trueFalseGroups = new Map<string, { questions: Question[]; passageText?: string | null }>();
  const nonTrueFalseGroups = new Map<string, { questions: Question[]; passageText?: string | null }>();

  questions.forEach((question) => {
    if (isGroupedTrueFalseQuestion(question)) {
      const groupKey = `group-key:${getNonEmptyPassageGroupKey(question)}`;
      const existingGroup = trueFalseGroups.get(groupKey);
      if (existingGroup) {
        existingGroup.questions.push(question);
        if (!existingGroup.passageText) {
          existingGroup.passageText = getNonEmptyPassageText(question);
        }
        return;
      }

      trueFalseGroups.set(groupKey, {
        questions: [question],
        passageText: getNonEmptyPassageText(question),
      });
      return;
    }

    if (question.questionFormat === 'TrueFalse') {
      return;
    }

    const passageGroupKey = getNonEmptyPassageGroupKey(question);
    const passageText = getNonEmptyPassageText(question);
    const groupKey = passageGroupKey
      ? `group-key:${passageGroupKey}`
      : passageText
        ? `passage-text:${passageText}`
        : null;

    if (!groupKey) {
      return;
    }

    const existingGroup = nonTrueFalseGroups.get(groupKey);
    if (existingGroup) {
      existingGroup.questions.push(question);
      if (!existingGroup.passageText && passageText) {
        existingGroup.passageText = passageText;
      }
      return;
    }

    nonTrueFalseGroups.set(groupKey, {
      questions: [question],
      passageText,
    });
  });

  const processedNonTrueFalseKeys = new Set<string>();
  const processedTrueFalseKeys = new Set<string>();
  const leadingGroups: SharedPassageQuestionGroup[] = [];
  const trailingTrueFalseGroups: SharedPassageQuestionGroup[] = [];

  questions.forEach((question) => {
    if (isGroupedTrueFalseQuestion(question)) {
      const groupKey = `group-key:${getNonEmptyPassageGroupKey(question)}`;
      if (processedTrueFalseKeys.has(groupKey)) {
        return;
      }

      const group = trueFalseGroups.get(groupKey);
      const items = sortGroupedQuestions(group?.questions || [question]);

      if (items.length === 1) {
        trailingTrueFalseGroups.push(getStandaloneGroup(items[0]));
      } else {
        trailingTrueFalseGroups.push({
          key: groupKey,
          type: 'group',
          groupKind: 'trueFalse',
          questions: items,
          passageText:
            group?.passageText || items.find((item) => getNonEmptyPassageText(item))?.passageText || null,
        });
      }

      processedTrueFalseKeys.add(groupKey);
      return;
    }

    if (question.questionFormat === 'TrueFalse') {
      leadingGroups.push(getStandaloneGroup(question));
      return;
    }

    const passageGroupKey = getNonEmptyPassageGroupKey(question);
    const passageText = getNonEmptyPassageText(question);
    const groupKey = passageGroupKey
      ? `group-key:${passageGroupKey}`
      : passageText
        ? `passage-text:${passageText}`
        : null;

    if (!groupKey) {
      leadingGroups.push(getStandaloneGroup(question));
      return;
    }

    if (processedNonTrueFalseKeys.has(groupKey)) {
      return;
    }

    const group = nonTrueFalseGroups.get(groupKey);
    const items = sortGroupedQuestions(group?.questions || [question]);

    if (items.length === 1) {
      leadingGroups.push(getStandaloneGroup(items[0]));
    } else {
      leadingGroups.push({
        key: groupKey,
        type: 'group',
        groupKind: 'passage',
        questions: items,
        passageText:
          group?.passageText || items.find((item) => getNonEmptyPassageText(item))?.passageText || null,
      });
    }

    processedNonTrueFalseKeys.add(groupKey);
  });

  return [...leadingGroups, ...trailingTrueFalseGroups];
};

export const groupQuestionsBySharedPassage = buildQuestionRenderGroups;