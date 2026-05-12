import {
  getAiDraftValidationError,
  normalizeAiQuestions,
} from './aiQuestionNormalization';

describe('aiQuestionNormalization', () => {
  it('normalizes single-choice questions to exactly four choices and defaults the first correct answer', () => {
    const [question] = normalizeAiQuestions(
      [
        {
          id: '',
          content: 'Câu hỏi gốc',
          choices: [{ optionLabel: 'A', content: 'Phương án 1' }],
        },
      ],
      { defaultCompetencyType: 'SelfDevelopment', seed: 'test-seed' }
    );

    expect(question).toMatchObject({
      id: 'ai-test-seed-0',
      competencyType: 'SelfDevelopment',
      questionFormat: 'SingleChoice',
      difficultyLevel: 'Medium',
    });
    expect(question.choices).toEqual([
      expect.objectContaining({ optionLabel: 'A', content: 'Phương án 1', isCorrect: true }),
      expect.objectContaining({ optionLabel: 'B', content: '', isCorrect: false }),
      expect.objectContaining({ optionLabel: 'C', content: '', isCorrect: false }),
      expect.objectContaining({ optionLabel: 'D', content: '', isCorrect: false }),
    ]);
  });

  it('keeps the first marked correct choice when one already exists', () => {
    const [question] = normalizeAiQuestions(
      [
        {
          id: '',
          content: 'Câu hỏi có đáp án đúng',
          choices: [
            { optionLabel: 'A', content: 'Phương án 1', isCorrect: false },
            { optionLabel: 'B', content: 'Phương án 2', isCorrect: true },
            { optionLabel: 'C', content: 'Phương án 3', isCorrect: true },
          ],
        },
      ],
      { seed: 'correct-seed' }
    );

    expect(question.choices).toEqual([
      expect.objectContaining({ optionLabel: 'A', isCorrect: false }),
      expect.objectContaining({ optionLabel: 'B', isCorrect: true }),
      expect.objectContaining({ optionLabel: 'C', isCorrect: false }),
      expect.objectContaining({ optionLabel: 'D', isCorrect: false }),
    ]);
  });

  it('normalizes true-false questions to fixed Đúng/Sai options', () => {
    const [question] = normalizeAiQuestions(
      [
        {
          id: 'tf-1',
          content: 'Mệnh đề',
          questionFormat: 'TrueFalse',
          competencyType: 'BehaviorAdjustment',
          difficultyLevel: 'Hard',
          choices: [
            { optionLabel: 'A', content: 'Có', isCorrect: false },
            { optionLabel: 'B', content: 'Không', isCorrect: true },
            { optionLabel: 'C', content: 'Khác', isCorrect: true },
          ],
        },
      ],
      { seed: 'tf-seed' }
    );

    expect(question).toMatchObject({
      id: 'tf-1',
      competencyType: 'BehaviorAdjustment',
      questionFormat: 'TrueFalse',
      difficultyLevel: 'Hard',
    });
    expect(question.choices).toEqual([
      expect.objectContaining({ optionLabel: 'A', content: 'Đúng', isCorrect: false }),
      expect.objectContaining({ optionLabel: 'B', content: 'Sai', isCorrect: true }),
    ]);
  });

  it('validates exact schema expectations for AI drafts', () => {
    expect(
      getAiDraftValidationError({
        id: 'q-1',
        content: 'Câu hỏi',
        competencyType: 'EconomicSocialParticipation',
        questionFormat: 'SingleChoice',
        difficultyLevel: 'Medium',
        choices: [
          { optionLabel: 'A', content: '1', isCorrect: false },
          { optionLabel: 'B', content: '2', isCorrect: true },
          { optionLabel: 'C', content: '3', isCorrect: false },
        ],
      })
    ).toBe('Câu hỏi một đáp án phải có đúng 4 lựa chọn A, B, C, D.');

    expect(
      getAiDraftValidationError({
        id: 'q-2',
        content: 'Mệnh đề',
        competencyType: 'BehaviorAdjustment',
        questionFormat: 'TrueFalse',
        difficultyLevel: 'Medium',
        choices: [
          { optionLabel: 'A', content: 'Sai', isCorrect: true },
          { optionLabel: 'B', content: 'Đúng', isCorrect: false },
        ],
      })
    ).toBe('Câu hỏi Đúng / Sai phải giữ nguyên 2 lựa chọn Đúng và Sai.');
  });
});
