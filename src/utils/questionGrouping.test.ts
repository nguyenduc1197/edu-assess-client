import { Question } from '../types';
import { buildQuestionBlocks } from './questionGrouping';

describe('questionGrouping', () => {
  it('preserves backend question order while grouping true-false passages', () => {
    const questions: Question[] = [
      { id: 'q-1', content: 'Câu 1', questionFormat: 'SingleChoice' },
      { id: 'q-2', content: 'Câu 2', questionFormat: 'SingleChoice' },
      {
        id: 'q-3',
        content: 'Mệnh đề 2',
        questionFormat: 'TrueFalse',
        passageGroupKey: ' passage-1 ',
        statementOrder: 2,
      },
      {
        id: 'q-4',
        content: 'Mệnh đề 1',
        questionFormat: 'TrueFalse',
        passageGroupKey: 'passage-1',
        statementOrder: 1,
        passageText: 'Đoạn văn',
      },
    ];

    const blocks = buildQuestionBlocks(questions);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ key: 'q-1', type: 'single' });
    expect(blocks[1]).toMatchObject({ key: 'q-2', type: 'single' });
    expect(blocks[2]).toMatchObject({
      key: 'passage-1',
      type: 'group',
      passageText: 'Đoạn văn',
    });
    expect(blocks[2].questions.map((question) => question.id)).toEqual(['q-3', 'q-4']);
  });

  it('keeps true-false questions without a group key as standalone items', () => {
    const questions: Question[] = [
      { id: 'q-1', content: 'Mệnh đề lẻ', questionFormat: 'TrueFalse', statementOrder: 1 },
      {
        id: 'q-2',
        content: 'Mệnh đề nhóm',
        questionFormat: 'TrueFalse',
        passageGroupKey: 'group-1',
      },
    ];

    const blocks = buildQuestionBlocks(questions);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ key: 'q-1', type: 'single' });
    expect(blocks[1]).toMatchObject({ key: 'group-1', type: 'group' });
    expect(blocks[1].questions.map((question) => question.id)).toEqual(['q-2']);
  });
});
