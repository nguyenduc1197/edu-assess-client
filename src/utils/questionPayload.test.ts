import { buildCreateQuestionPayload, buildUpdateQuestionPayload } from './questionPayload';
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

// Round 2: PUT /questions/{id} body keeps choice ids (update in place).
describe('buildUpdateQuestionPayload', () => {

  it('keeps existing choice ids and sends null for new choices', () => {
    const p: any = buildUpdateQuestionPayload({
      ...base,
      choices: [
        { id: 'c1', optionLabel: 'A', content: ' a ', isCorrect: true },
        { optionLabel: 'B', content: 'b', isCorrect: false },
      ],
    });
    expect(p.choices).toEqual([
      { id: 'c1', optionLabel: 'A', content: 'a', isCorrect: true },
      { id: null, optionLabel: 'B', content: 'b', isCorrect: false },
    ]);
  });

  it('essay: no choices, essay fields included', () => {
    const p: any = buildUpdateQuestionPayload({ ...base, questionFormat: 'Essay', maxPoints: 2.5, sampleAnswer: ' mẫu ' });
    expect(p.choices).toEqual([]);
    expect(p.maxPoints).toBe(2.5);
    expect(p.sampleAnswer).toBe('mẫu');
  });
});

// Round 8: rubric essays, fill-in-the-blank and matching payloads.
describe('question payload – round 8 formats', () => {
  const base = { id: 'q', competencyType: 'SelfDevelopment', difficultyLevel: 'Medium' as const };

  it('sends the rubric (not sampleAnswer/maxPoints) for rubric essays', () => {
    const payload: any = buildCreateQuestionPayload({
      ...base, content: 'E', questionFormat: 'Essay', choices: [], maxPoints: 1.5,
      rubricItems: [{ content: ' Ý 1 ', points: 1 }, { content: 'Ý 2', points: 0.5 }],
    });
    expect(payload.rubricItems).toEqual([{ content: 'Ý 1', points: 1 }, { content: 'Ý 2', points: 0.5 }]);
    expect(payload.sampleAnswer).toBeUndefined();
    expect(payload.maxPoints).toBeUndefined();
  });

  it('sends correctSlot / matchingPrompts and keeps choice ids on update', () => {
    const question = {
      ...base, content: 'Nối', questionFormat: 'Matching' as const, matchingPrompts: [' Cung ', 'Cầu'],
      choices: [
        { id: 'c1', optionLabel: 'A', content: 'Bán', correctSlot: 1 },
        { optionLabel: 'B', content: 'Mua', correctSlot: 2 },
        { optionLabel: 'C', content: 'Dư', correctSlot: null },
      ],
    };
    const created: any = buildCreateQuestionPayload(question);
    expect(created.matchingPrompts).toEqual(['Cung', 'Cầu']);
    expect(created.choices).toEqual([
      { optionLabel: 'A', content: 'Bán', isCorrect: true, correctSlot: 1 },
      { optionLabel: 'B', content: 'Mua', isCorrect: true, correctSlot: 2 },
      { optionLabel: 'C', content: 'Dư', isCorrect: false, correctSlot: null },
    ]);
    const updated: any = buildUpdateQuestionPayload(question);
    expect(updated.choices.map((c: any) => c.id)).toEqual(['c1', null, null]);
  });

  it('update of an essay without situation sends explicit nulls to clear the group', () => {
    const updated: any = buildUpdateQuestionPayload({ ...base, content: 'E', questionFormat: 'Essay', choices: [], rubricItems: [{ content: 'Ý', points: 1 }] });
    expect(updated.passageText).toBeNull();
    expect(updated.passageGroupKey).toBeNull();
  });
});
