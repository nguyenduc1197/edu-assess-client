import { WrongAnswerReview } from '../types';

export type WrongAnswerSection =
  | { type: 'single'; key: string; item: WrongAnswerReview }
  | {
      type: 'group';
      key: string;
      groupKind: 'trueFalse' | 'passage';
      passageText?: string | null;
      items: WrongAnswerReview[];
    };

const normalizePassageText = (value?: string | null) => value?.trim() || null;

export const buildWrongAnswerSections = (items: WrongAnswerReview[]): WrongAnswerSection[] => {
  const sections: WrongAnswerSection[] = [];
  const processedTrueFalseKeys = new Set<string>();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const trueFalseGroupKey = item.questionFormat === 'TrueFalse' ? item.passageGroupKey?.trim() : null;

    if (trueFalseGroupKey) {
      if (processedTrueFalseKeys.has(trueFalseGroupKey)) {
        continue;
      }

      const groupItems = items
        .filter(
          (candidate) =>
            candidate.questionFormat === 'TrueFalse' &&
            candidate.passageGroupKey?.trim() === trueFalseGroupKey
        )
        .sort(
          (left, right) =>
            (left.statementOrder ?? Number.MAX_SAFE_INTEGER) -
            (right.statementOrder ?? Number.MAX_SAFE_INTEGER)
        );

      sections.push({
        type: 'group',
        key: trueFalseGroupKey,
        groupKind: 'trueFalse',
        passageText:
          groupItems.find((candidate) => normalizePassageText(candidate.passageText))?.passageText ||
          item.passageText,
        items: groupItems,
      });
      processedTrueFalseKeys.add(trueFalseGroupKey);
      continue;
    }

    const passageText = item.questionFormat === 'SingleChoice' ? normalizePassageText(item.passageText) : null;

    if (passageText) {
      const groupedItems = [item];
      let nextIndex = index + 1;

      while (nextIndex < items.length) {
        const nextItem = items[nextIndex];
        if (
          nextItem.questionFormat !== 'SingleChoice' ||
          normalizePassageText(nextItem.passageText) !== passageText
        ) {
          break;
        }

        groupedItems.push(nextItem);
        nextIndex += 1;
      }

      if (groupedItems.length > 1) {
        sections.push({
          type: 'group',
          key: `passage-${item.questionId}-${index}`,
          groupKind: 'passage',
          passageText,
          items: groupedItems,
        });
        index = nextIndex - 1;
        continue;
      }
    }

    sections.push({ type: 'single', key: item.questionId, item });
  }

  return sections;
};