import {
  ESSAY_DEFAULT_MAX_POINTS,
  ESSAY_MAX_ALLOWED_POINTS,
  ESSAY_SAMPLE_ANSWER_MAX_LENGTH,
  buildAnswerPayload,
  formatEssayScore,
  formatPoints,
  getEssayGradingStatusLabel,
  hasAnswerContent,
  isEssayQuestion,
  parseEssayNumber,
  validateEssayMaxPoints,
  validateEssaySampleAnswer,
  validateEssayScore,
} from './essay';

// Requirement 9 (pure utils) — mirrors backend rules of requirements 1, 3, 6, 7.
describe('essay constants', () => {
  it('match backend rules', () => {
    expect(ESSAY_DEFAULT_MAX_POINTS).toBe(1);
    expect(ESSAY_MAX_ALLOWED_POINTS).toBe(10);
    expect(ESSAY_SAMPLE_ANSWER_MAX_LENGTH).toBe(4000);
  });
});

describe('isEssayQuestion', () => {
  it.each([
    [{ questionFormat: 'Essay' as const }, true],
    [{ questionFormat: 'SingleChoice' as const }, false],
    [{ questionFormat: 'TrueFalse' as const }, false],
    [null, false],
    [undefined, false],
  ])('%p -> %p', (q, expected) => {
    expect(isEssayQuestion(q as any)).toBe(expected);
  });
});

describe('validateEssayMaxPoints boundaries', () => {
  it.each(['0.25', '0.5', '1', '9.75', '10', '10.00', ' 5 ', '2,5', 0.75, 10, 1.5])('accepts %p', (v) => {
    expect(validateEssayMaxPoints(v as any)).toBeNull();
  });

  it.each(['0', '0.00', '-0.01', '10.01', '11', 0, 10.01, -1])('rejects out of range %p', (v) => {
    expect(validateEssayMaxPoints(v as any)).toBe('Điểm tối đa của câu tự luận phải lớn hơn 0 và không vượt quá 10.');
  });

  // Product owner (round 2): only multiples of 0.25 are allowed.
  it.each(['0.001', '0.01', '1.255', '9.99', '9.999', '1.3', 1.125, 0.1])('rejects non-quarter steps %p', (v) => {
    expect(validateEssayMaxPoints(v as any)).toMatch(/bội số của 0\.25/);
  });

  it.each(['', '   ', 'abc', '1e1', '1..2', null, undefined])('rejects non-numeric %p', (v) => {
    expect(validateEssayMaxPoints(v as any)).toBe('Vui lòng nhập điểm tối đa hợp lệ cho câu tự luận.');
  });
});

describe('validateEssaySampleAnswer', () => {
  it('requires non-blank text (whitespace only rejected)', () => {
    for (const v of ['', '   ', '\n\t ', null, undefined]) {
      expect(validateEssaySampleAnswer(v as any)).toBe('Câu tự luận bắt buộc phải có đáp án mẫu / tiêu chí chấm.');
    }
  });

  it('length is checked after trim (4000 ok, 4001 rejected)', () => {
    expect(validateEssaySampleAnswer('  ' + 'a'.repeat(4000) + '  ')).toBeNull();
    expect(validateEssaySampleAnswer('a'.repeat(4001))).toBe('Đáp án mẫu / tiêu chí chấm không được vượt quá 4000 ký tự.');
  });
});

describe('validateEssayScore (teacher override)', () => {
  it.each([
    ['0', 2],
    ['2', 2],
    ['0.01', 2],
    ['1.33', 2],
    ['1,5', 2],
    [1.75, 2],
    ['10', 10],
  ])('accepts %p for max %p', (v, max) => {
    expect(validateEssayScore(v as any, max)).toBeNull();
  });

  it.each([
    ['-0.01', 2],
    ['2.01', 2],
    ['2.25', 2],
    ['10.5', 10],
  ])('rejects out of range %p (max %p)', (v, max) => {
    expect(validateEssayScore(v, max)).toMatch(/^Điểm phải nằm trong khoảng 0 đến/);
  });

  it('range message shows formatted max', () => {
    expect(validateEssayScore('3', 2.5)).toBe('Điểm phải nằm trong khoảng 0 đến 2.5.');
  });

  it.each(['1.333', '0.001'])('rejects > 2 decimals %p', (v) => {
    expect(validateEssayScore(v, 2)).toBe('Điểm chỉ được có tối đa 2 chữ số thập phân.');
  });

  it.each(['', ' ', 'x', null, undefined])('rejects empty / invalid %p', (v) => {
    expect(validateEssayScore(v as any, 2)).toBe('Vui lòng nhập điểm hợp lệ.');
  });
});

describe('parseEssayNumber', () => {
  it('parses dot and comma decimals and trims', () => {
    expect(parseEssayNumber('1.5')).toBe(1.5);
    expect(parseEssayNumber(' 2,25 ')).toBe(2.25);
    expect(parseEssayNumber(3)).toBe(3);
    expect(parseEssayNumber('')).toBeNull();
    expect(parseEssayNumber('abc')).toBeNull();
    expect(parseEssayNumber(null)).toBeNull();
  });
});

describe('buildAnswerPayload (draft + submit)', () => {
  it('includes essayAnswer, trims it, blank -> null, choiceId -> null when absent', () => {
    expect(
      buildAnswerPayload({
        mc: { choiceId: 'c1', content: 'A' },
        essay: { content: '  x ', essayAnswer: '  Bài làm\n dòng 2  ' },
        blank: { essayAnswer: ' \n\t ' },
        empty: {},
      })
    ).toEqual([
      { questionId: 'mc', choiceId: 'c1', essayAnswer: null },
      { questionId: 'essay', choiceId: null, essayAnswer: 'Bài làm\n dòng 2' },
      { questionId: 'blank', choiceId: null, essayAnswer: null },
      { questionId: 'empty', choiceId: null, essayAnswer: null },
    ]);
  });

  it('every item always has the three keys expected by the API', () => {
    const payload = buildAnswerPayload({ a: { essayAnswer: 'x' } });
    expect(Object.keys(payload[0]).sort()).toEqual(['choiceId', 'essayAnswer', 'questionId']);
  });

  it('empty answers -> empty array', () => {
    expect(buildAnswerPayload({})).toEqual([]);
  });

  it('keeps Vietnamese/unicode text intact', () => {
    expect(buildAnswerPayload({ q: { essayAnswer: 'Pháp luật bảo vệ quyền lợi người tiêu dùng' } })[0].essayAnswer).toBe(
      'Pháp luật bảo vệ quyền lợi người tiêu dùng'
    );
  });
});

describe('hasAnswerContent', () => {
  it('handles choice / essay / blank', () => {
    expect(hasAnswerContent({ choiceId: 'c' })).toBe(true);
    expect(hasAnswerContent({ essayAnswer: ' a ' })).toBe(true);
    expect(hasAnswerContent({ essayAnswer: '' })).toBe(false);
    expect(hasAnswerContent({ content: 'typed', essayAnswer: '   ' })).toBe(false);
    expect(hasAnswerContent({})).toBe(false);
    expect(hasAnswerContent(null)).toBe(false);
  });
});

describe('formatting', () => {
  it.each([
    [1, '1'],
    [1.5, '1.5'],
    [0.25, '0.25'],
    [10, '10'],
    [0, '0'],
    [1.234, '1.23'],
    [null, '—'],
    [undefined, '—'],
    [NaN, '—'],
  ])('formatPoints(%p) = %p', (v, expected) => {
    expect(formatPoints(v as any)).toBe(expected);
  });

  it('formatEssayScore shows states and score / max', () => {
    expect(formatEssayScore(null, 2, 'Pending')).toBe('Đang chấm');
    expect(formatEssayScore(1, 2, 'Pending')).toBe('Đang chấm');
    expect(formatEssayScore(null, 2, 'AwaitingTeacher')).toBe('Chờ giáo viên chấm');
    expect(formatEssayScore(0, 2, 'NoAnswer')).toBe('0 / 2 điểm');
    expect(formatEssayScore(1.75, 2.5, 'TeacherGraded')).toBe('1.75 / 2.5 điểm');
    expect(formatEssayScore(2, 2, 'AiGraded')).toBe('2 / 2 điểm');
  });

  it('status labels are Vietnamese', () => {
    expect(getEssayGradingStatusLabel('Pending')).toBe('Đang chấm');
    expect(getEssayGradingStatusLabel('AiGraded')).toBe('AI đã chấm');
    expect(getEssayGradingStatusLabel('AwaitingTeacher')).toBe('Chờ giáo viên chấm');
    expect(getEssayGradingStatusLabel('TeacherGraded')).toBe('Giáo viên đã chấm');
    expect(getEssayGradingStatusLabel('NoAnswer')).toBe('Không trả lời');
    expect(getEssayGradingStatusLabel('NotApplicable')).toBe('');
    expect(getEssayGradingStatusLabel(undefined)).toBe('');
  });
});
