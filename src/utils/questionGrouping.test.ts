import { Question } from '../types';
import { buildQuestionBlocks, buildQuestionPreviewBlocks } from './questionGrouping';

describe('questionGrouping', () => {
  it('renders normal questions first and pushes grouped true-false passages to the end', () => {
    const questions: Question[] = [
      { id: 'q-1', content: 'Câu 1', questionFormat: 'SingleChoice' },
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
      { id: 'q-2', content: 'Câu 2', questionFormat: 'SingleChoice' },
    ];

    const blocks = buildQuestionBlocks(questions);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ key: 'q-1', type: 'single', questionNumbers: [1] });
    expect(blocks[1]).toMatchObject({ key: 'q-2', type: 'single', questionNumbers: [2] });
    expect(blocks[2]).toMatchObject({
      key: 'group-key:passage-1',
      type: 'group',
      groupKind: 'trueFalse',
      passageText: 'Đoạn văn',
      questionNumbers: [3, 4],
    });
    expect(blocks[2].questions).toHaveLength(2);
    expect(blocks[2].questions.map((question) => question.id)).toEqual(['q-4', 'q-3']);
  });

  it('keeps true-false questions without a group key as standalone items in normal flow', () => {
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
    expect(blocks[0]).toMatchObject({ key: 'q-1', type: 'single', questionNumbers: [1] });
    expect(blocks[1]).toMatchObject({ key: 'q-2', type: 'single', questionNumbers: [2] });
    expect(blocks[1].questions.map((question) => question.id)).toEqual(['q-2']);
  });

  it('preserves passage text on standalone single-choice exam blocks', () => {
    const questions: Question[] = [
      {
        id: 'q-1',
        content: 'Câu có đoạn văn',
        questionFormat: 'SingleChoice',
        passageText: 'Đoạn văn dùng cho câu hỏi đơn',
      },
    ];

    const blocks = buildQuestionBlocks(questions);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      key: 'q-1',
      type: 'single',
      passageText: 'Đoạn văn dùng cho câu hỏi đơn',
      questionNumbers: [1],
    });
  });

  it('groups non-true-false questions by shared passage text even when separated', () => {
    const questions: Question[] = [
      {
        id: 'q-1',
        content: 'Câu 1',
        questionFormat: 'SingleChoice',
        passageText: 'Đoạn văn chung',
      },
      {
        id: 'q-middle',
        content: 'Câu độc lập ở giữa',
        questionFormat: 'SingleChoice',
      },
      {
        id: 'q-2',
        content: 'Câu 2',
        questionFormat: 'SingleChoice',
        passageText: ' Đoạn văn chung ',
      },
      {
        id: 'q-3',
        content: 'Câu 3',
        questionFormat: 'SingleChoice',
      },
    ];

    const blocks = buildQuestionBlocks(questions);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({
      key: 'passage-text:Đoạn văn chung',
      type: 'group',
      groupKind: 'passage',
      passageText: 'Đoạn văn chung',
      questionNumbers: [1, 2],
    });
    expect(blocks[0].questions.map((question) => question.id)).toEqual(['q-1', 'q-2']);
    expect(blocks[1]).toMatchObject({ key: 'q-middle', type: 'single', questionNumbers: [3] });
    expect(blocks[2]).toMatchObject({ key: 'q-3', type: 'single', questionNumbers: [4] });
  });

  it('groups non-true-false questions by shared passageGroupKey even when not adjacent', () => {
    const questions: Question[] = [
      {
        id: 'q-2',
        content: 'Câu 2',
        questionFormat: 'SingleChoice',
        passageGroupKey: 'group-1',
        passageText: 'Đoạn văn nhóm',
      },
      {
        id: 'q-single',
        content: 'Câu độc lập',
        questionFormat: 'SingleChoice',
      },
      {
        id: 'q-1',
        content: 'Câu 1',
        questionFormat: 'SingleChoice',
        passageGroupKey: ' group-1 ',
      },
    ];

    const blocks = buildQuestionBlocks(questions);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      key: 'group-key:group-1',
      type: 'group',
      groupKind: 'passage',
      passageText: 'Đoạn văn nhóm',
      questionNumbers: [1, 2],
    });
    expect(blocks[0].questions.map((question) => question.id)).toEqual(['q-2', 'q-1']);
    expect(blocks[1]).toMatchObject({ key: 'q-single', type: 'single', questionNumbers: [3] });
  });

  it('sorts grouped true-false statements by statementOrder and renders them last', () => {
    const questions: Question[] = [
      { id: 'q-standalone', content: 'Câu thường', questionFormat: 'SingleChoice' },
      {
        id: 'q-tf-2',
        content: 'Mệnh đề 2',
        questionFormat: 'TrueFalse',
        passageGroupKey: 'tf-group',
        statementOrder: 2,
        passageText: 'Đoạn văn mệnh đề',
      },
      {
        id: 'q-tf-1',
        content: 'Mệnh đề 1',
        questionFormat: 'TrueFalse',
        passageGroupKey: 'tf-group',
        statementOrder: 1,
      },
    ];

    const blocks = buildQuestionBlocks(questions);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ key: 'q-standalone', type: 'single', questionNumbers: [1] });
    expect(blocks[1]).toMatchObject({
      key: 'group-key:tf-group',
      type: 'group',
      groupKind: 'trueFalse',
      passageText: 'Đoạn văn mệnh đề',
      questionNumbers: [2, 3],
    });
    expect(blocks[1].questions.map((question) => question.id)).toEqual(['q-tf-1', 'q-tf-2']);
  });

  it('groups adjacent single-choice questions with the same passage text in preview blocks', () => {
    const questions: Question[] = [
      {
        id: 'q-1',
        content: 'Câu 1',
        questionFormat: 'SingleChoice',
        passageText: 'Tổng vốn đầu tư nước ngoài đăng ký vào Việt Nam...',
      },
      {
        id: 'q-2',
        content: 'Câu 2',
        questionFormat: 'SingleChoice',
        passageText: '  Tổng vốn đầu tư nước ngoài đăng ký vào Việt Nam...  ',
      },
      {
        id: 'q-3',
        content: 'Câu 3',
        questionFormat: 'SingleChoice',
      },
    ];

    const blocks = buildQuestionPreviewBlocks(questions);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      key: 'passage-q-1-0',
      type: 'passage-group',
      passageText: 'Tổng vốn đầu tư nước ngoài đăng ký vào Việt Nam...',
    });
    expect(blocks[0].type).toBe('passage-group');
    if (blocks[0].type !== 'passage-group') {
      throw new Error('Expected first preview block to be a grouped passage block');
    }
    expect(blocks[0].questions.map((question) => question.id)).toEqual(['q-1', 'q-2']);
    expect(blocks[1]).toMatchObject({ key: 'q-3', type: 'single' });
  });
});
