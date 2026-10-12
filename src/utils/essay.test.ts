import { Question } from '../types';
import {
  buildAnswerPayload,
  formatEssayScore,
  formatPoints,
  getEssayGradingStatusLabel,
  hasAnswerContent,
  validateEssayMaxPoints,
  validateEssaySampleAnswer,
  validateEssayScore,
  restoreDraftAnswers,
} from './essay';

describe('essay utils', () => {
  it('builds the submit payload with essay text and choice ids', () => {
    expect(
      buildAnswerPayload({
        q1: { choiceId: 'c1', content: 'A' },
        q2: { essayAnswer: '  Bài làm của em  ' },
        q3: { essayAnswer: '   ' },
      })
    ).toEqual([
      { questionId: 'q1', choiceId: 'c1', essayAnswer: null },
      { questionId: 'q2', choiceId: null, essayAnswer: 'Bài làm của em' },
      { questionId: 'q3', choiceId: null, essayAnswer: null },
    ]);
  });

  it('detects answered state', () => {
    expect(hasAnswerContent({ choiceId: 'c1' })).toBe(true);
    expect(hasAnswerContent({ essayAnswer: 'abc' })).toBe(true);
    expect(hasAnswerContent({ essayAnswer: '  ' })).toBe(false);
    expect(hasAnswerContent(undefined)).toBe(false);
  });

  it('validates max points', () => {
    expect(validateEssayMaxPoints('1')).toBeNull();
    expect(validateEssayMaxPoints('0.25')).toBeNull();
    expect(validateEssayMaxPoints('10')).toBeNull();
    expect(validateEssayMaxPoints('2,5')).toBeNull();
    expect(validateEssayMaxPoints('0')).not.toBeNull();
    expect(validateEssayMaxPoints('40')).toBeNull();
    expect(validateEssayMaxPoints('40.25')).not.toBeNull();
    expect(validateEssayMaxPoints('-1')).not.toBeNull();
    expect(validateEssayMaxPoints('abc')).not.toBeNull();
    expect(validateEssayMaxPoints('1.125')).not.toBeNull();
  });

  it('requires a sample answer', () => {
    expect(validateEssaySampleAnswer('')).not.toBeNull();
    expect(validateEssaySampleAnswer('   ')).not.toBeNull();
    expect(validateEssaySampleAnswer('Ý 1: ...')).toBeNull();
    expect(validateEssaySampleAnswer('a'.repeat(4001))).not.toBeNull();
  });

  it('validates teacher scores within 0..maxPoints', () => {
    expect(validateEssayScore('0', 2)).toBeNull();
    expect(validateEssayScore('2', 2)).toBeNull();
    expect(validateEssayScore('1.75', 2)).toBeNull();
    expect(validateEssayScore('2.25', 2)).not.toBeNull();
    expect(validateEssayScore('-0.5', 2)).not.toBeNull();
    expect(validateEssayScore('', 2)).not.toBeNull();
  });

  it('formats scores and statuses', () => {
    expect(formatPoints(1.5)).toBe('1.5');
    expect(formatPoints(2)).toBe('2');
    expect(formatEssayScore(null, 2, 'Pending')).toBe('Đang chấm');
    expect(formatEssayScore(null, 2, 'AwaitingTeacher')).toBe('Chờ giáo viên chấm');
    expect(formatEssayScore(1.25, 2, 'AiGraded')).toBe('1.25 / 2 điểm');
    expect(getEssayGradingStatusLabel('TeacherGraded')).toBe('Giáo viên đã chấm');
  });
});

// Round 4: draft restore mapping
describe('restoreDraftAnswers', () => {
  const qs: Question[] = [
    { id: 'm1', content: 'MC', questionFormat: 'SingleChoice', choices: [{ id: 'c1', optionLabel: 'A', content: 'A1' }] },
    { id: 'e1', content: 'Essay', questionFormat: 'Essay', choices: [] },
  ];

  it('maps choices (with content) and essay text; drops unknown questions/choices and blank essays', () => {
    expect(
      restoreDraftAnswers(
        [
          { questionId: 'm1', choiceId: 'c1', essayAnswer: null },
          { questionId: 'e1', choiceId: null, essayAnswer: 'Bài' },
          { questionId: 'gone', choiceId: 'c1' },
          { questionId: 'm1', choiceId: 'missing' },
        ],
        qs
      )
    ).toEqual({
      m1: { choiceId: 'c1', content: 'A1' },
      e1: { content: 'Bài', essayAnswer: 'Bài' },
    });
    expect(restoreDraftAnswers([{ questionId: 'e1', essayAnswer: '   ' }], qs)).toEqual({});
    expect(restoreDraftAnswers(null, qs)).toEqual({});
  });
});
