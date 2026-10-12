import { buildCreateQuestionPayload } from './questionPayload';
import { Question } from '../types';

// Requirements 1 + 9: request body for POST /questions and /questions/bulk
const base: Question = {
  id: 'tmp',
  content: '  Nội dung  ',
  competencyType: 'SelfDevelopment',
  questionFormat: 'SingleChoice',
  difficultyLevel: 'Medium',
  choices: [
    { optionLabel: 'A', content: ' a ', isCorrect: true },
    { optionLabel: 'B', content: 'b', isCorrect: false },
  ],
} as Question;

describe('buildCreateQuestionPayload', () => {
  it('single choice: keeps choices, no essay fields', () => {
    const p: any = buildCreateQuestionPayload(base);
    expect(p.content).toBe('Nội dung');
    expect(p.questionFormat).toBe('SingleChoice');
    expect(p.choices).toEqual([
      { optionLabel: 'A', content: 'a', isCorrect: true },
      { optionLabel: 'B', content: 'b', isCorrect: false },
    ]);
    expect('maxPoints' in p).toBe(false);
    expect('sampleAnswer' in p).toBe(false);
  });

  it('true/false: no essay fields', () => {
    const p: any = buildCreateQuestionPayload({ ...base, questionFormat: 'TrueFalse', maxPoints: 5, sampleAnswer: 'leak' });
    expect('maxPoints' in p).toBe(false);
    expect('sampleAnswer' in p).toBe(false);
  });

  it('essay: empty choices, trimmed sample answer, maxPoints passed through', () => {
    const p: any = buildCreateQuestionPayload({ ...base, questionFormat: 'Essay', maxPoints: 2.5, sampleAnswer: '  Ý 1; Ý 2  ' });
    expect(p.questionFormat).toBe('Essay');
    expect(p.choices).toEqual([]);
    expect(p.maxPoints).toBe(2.5);
    expect(p.sampleAnswer).toBe('Ý 1; Ý 2');
  });

  it('essay: default maxPoints 1 when missing', () => {
    const p: any = buildCreateQuestionPayload({ ...base, questionFormat: 'Essay', sampleAnswer: 'x', choices: undefined });
    expect(p.maxPoints).toBe(1);
    expect(p.choices).toEqual([]);
  });

  it('essay: whitespace-only sample answer becomes empty string (backend returns 400)', () => {
    const p: any = buildCreateQuestionPayload({ ...base, questionFormat: 'Essay', sampleAnswer: '   ' });
    expect(p.sampleAnswer).toBe('');
  });

  it('essay: null sample answer becomes empty string', () => {
    const p: any = buildCreateQuestionPayload({ ...base, questionFormat: 'Essay', sampleAnswer: null });
    expect(p.sampleAnswer).toBe('');
  });

  it('blank optional text fields are omitted (undefined)', () => {
    const p: any = buildCreateQuestionPayload({ ...base, passageText: '  ', passageGroupKey: '', sourceEvidence: ' ' });
    expect(p.passageText).toBeUndefined();
    expect(p.passageGroupKey).toBeUndefined();
    expect(p.sourceEvidence).toBeUndefined();
  });

  it('serializes to JSON with numeric maxPoints', () => {
    const json = JSON.stringify(buildCreateQuestionPayload({ ...base, questionFormat: 'Essay', maxPoints: 0.25, sampleAnswer: 's' }));
    expect(json).toContain('"maxPoints":0.25');
    expect(json).toContain('"questionFormat":"Essay"');
  });
});
