import {
  buildCreateFromScanPayload,
  collectScanReviewErrors,
  setCorrectChoice,
  toReviewQuestions,
  validateReviewQuestion,
  validateScanFiles,
  ReviewQuestion,
  ScanExamFields,
} from './scanExam';
import { buildQuestionRenderGroups } from './groupQuestionsBySharedPassage';
import { ExamScanResult, Question, ScannedQuestion } from '../types';

// Round 5 (TEST agent): scan helpers boundaries + review validation + ordering.
const f = (name: string, size = 10, type = '') => ({ name, size, type });
const MB20 = 20 * 1024 * 1024;

describe('validateScanFiles boundaries', () => {
  it('20 images ok, 21 rejected', () => {
    expect(validateScanFiles(Array.from({ length: 20 }, (_, i) => f(`p${i}.jpg`)))).toBeNull();
    expect(validateScanFiles(Array.from({ length: 21 }, (_, i) => f(`p${i}.jpg`)))).toBe('Chỉ được tải lên tối đa 20 ảnh.');
  });

  it('exactly 20MB ok, 1 byte more rejected (sum of images too)', () => {
    expect(validateScanFiles([f('de.pdf', MB20)])).toBeNull();
    expect(validateScanFiles([f('de.pdf', MB20 + 1)])).toBe('Tổng dung lượng file vượt quá 20MB.');
    expect(validateScanFiles([f('1.png', MB20 / 2), f('2.png', MB20 / 2), f('3.png', 1)])).toBe('Tổng dung lượng file vượt quá 20MB.');
  });

  it.each([
    [[f('a.pdf'), f('b.docx')]],
    [[f('a.jpg'), f('b.pdf')]],
    [[f('a.png'), f('b.docx')]],
  ])('mixed types rejected %#', (files) => {
    expect(validateScanFiles(files)).toMatch(/không trộn/);
  });

  it('content-type only and uppercase extensions classified; gif/doc rejected; empty rejected', () => {
    expect(validateScanFiles([f('blob', 10, 'image/png')])).toBeNull();
    expect(validateScanFiles([f('DE.PDF')])).toBeNull();
    expect(validateScanFiles([f('p.HEIC'), f('q.heif')])).toBeNull();
    expect(validateScanFiles([f('a.gif')])).toMatch(/không được hỗ trợ/);
    expect(validateScanFiles([f('a.doc')])).toMatch(/không được hỗ trợ/);
    expect(validateScanFiles([f('a.jpg'), f('b.jpg', 0)])).toBe('File tải lên bị rỗng.');
    expect(validateScanFiles([])).toMatch(/Vui lòng chọn file/);
  });
});

const sq = (over: Partial<ScannedQuestion>): ScannedQuestion => ({
  order: 1, questionFormat: 'SingleChoice', content: 'Q', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium',
  choices: [{ optionLabel: 'A', content: 'a', isCorrect: true }, { optionLabel: 'B', content: 'b', isCorrect: false }],
  isAnswerAiGuessed: false, hasFigure: false, ...over,
});

const result = (questions: ScannedQuestion[]): ExamScanResult => ({
  sourceFileNames: ['x.pdf'], sourceType: 'pdf', questions, skippedQuestions: [], warnings: [],
} as ExamScanResult);

const fields: ScanExamFields = { name: 'Đề', schoolClassId: 'c1', start: '2026-10-20T08:00', end: '2026-10-21T08:00', durationMinutes: '45', antiCheatEnabled: false, trueFalseScoringMode: 'Tiered' };

describe('review validation', () => {
  it('AI-guessed true/false statement blocks until confirmed or answer chosen', () => {
    const [q] = toReviewQuestions(result([sq({ questionFormat: 'TrueFalse', passageGroupKey: 'scan-g1', statementOrder: 1, isAnswerAiGuessed: true,
      choices: [{ optionLabel: 'A', content: 'Đúng', isCorrect: false }, { optionLabel: 'B', content: 'Sai', isCorrect: true }] })]));
    expect(q.answerConfirmed).toBe(false);
    expect(validateReviewQuestion(q, 3)).toEqual(['Câu 3: đáp án do AI đoán – cần kiểm tra và xác nhận.']);
    expect(validateReviewQuestion({ ...q, answerConfirmed: true }, 3)).toEqual([]);
    const chosen = setCorrectChoice(q, 0);
    expect(chosen.choices.map((c) => c.isCorrect)).toEqual([true, false]);
    expect(validateReviewQuestion(chosen, 3)).toEqual([]);
  });

  it('missing answer cannot be "confirmed" away', () => {
    const [q] = toReviewQuestions(result([sq({ choices: [{ optionLabel: 'A', content: 'a', isCorrect: false }, { optionLabel: 'B', content: 'b', isCorrect: false }] })]));
    expect(validateReviewQuestion({ ...q, answerConfirmed: true }, 1)).toEqual(['Câu 1: phải chọn đúng một đáp án đúng.']);
  });

  it('content / choice length boundaries', () => {
    const [q] = toReviewQuestions(result([sq({})]));
    // Round 6: content limit raised from 1000 to 4000 characters, shared passage up to 8000.
    expect(validateReviewQuestion({ ...q, content: 'x'.repeat(4000) }, 1)).toEqual([]);
    expect(validateReviewQuestion({ ...q, content: 'x'.repeat(4001) }, 1)[0]).toMatch(/4000 ký tự/);
    expect(validateReviewQuestion({ ...q, passageText: 'p'.repeat(8000) }, 1)).toEqual([]);
    expect(validateReviewQuestion({ ...q, passageText: 'p'.repeat(8001) }, 1)[0]).toMatch(/8000 ký tự/);
    expect(validateReviewQuestion({ ...q, choices: [{ optionLabel: 'A', content: 'y'.repeat(501), isCorrect: true }, q.choices[1]] }, 1)[0]).toMatch(/500 ký tự/);
  });

  it.each([
    ['', 'mẫu', /bội số của 0\.25/],
    ['40.25', 'mẫu', /không vượt quá 40/],
    ['2.1', 'mẫu', /bội số của 0\.25/],
    ['8', '   ', /không được để trống/],
  ])('essay ý points=%p content=%p rejected', (points, content, pattern) => {
    const [q] = toReviewQuestions(result([sq({ questionFormat: 'Essay', choices: [] })]));
    const errors = validateReviewQuestion({ ...q, rubricInputs: [{ content, points }] } as ReviewQuestion, 2);
    expect(errors.join(' ')).toMatch(pattern);
    expect(errors.every((e) => e.startsWith('Câu 2:'))).toBe(true);
  });

  it('essay free-text answer with converted points becomes one ý and 40 is accepted', () => {
    const [q] = toReviewQuestions(result([sq({ questionFormat: 'Essay', choices: [], maxPoints: 40, sampleAnswer: 'mẫu' })]));
    expect(q.rubricInputs).toEqual([{ content: 'mẫu', points: '40' }]);
    expect(validateReviewQuestion(q, 1)).toEqual([]);
  });

  it('empty question list and bad exam fields block creation', () => {
    const errors = collectScanReviewErrors([], { ...fields, name: ' ', durationMinutes: '0' });
    expect(errors).toEqual(expect.arrayContaining(['Đề thi cần có ít nhất một câu hỏi.', 'Vui lòng nhập tên bài thi.']));
  });
});

describe('create payload', () => {
  it('keeps reviewed order, true/false keys, essay fields and never sends sourceEvidence', () => {
    const qs = toReviewQuestions(result([
      sq({ order: 1, content: 'S1', questionFormat: 'TrueFalse', passageGroupKey: 'scan-g1', statementOrder: 1, passageText: ' Đoạn ' }),
      sq({ order: 2, content: 'S2', questionFormat: 'TrueFalse', passageGroupKey: 'scan-g1', statementOrder: 2, passageText: ' Đoạn ' }),
      sq({ order: 3, content: '  MC3 ' }),
      sq({ order: 4, content: 'E4', questionFormat: 'Essay', choices: [], maxPoints: 8, sampleAnswer: ' mẫu ' }),
    ]));
    const p = buildCreateFromScanPayload(qs, fields);
    expect(p.questions.map((q) => q.content)).toEqual(['S1', 'S2', 'MC3', 'E4']);
    expect(p.questions[0]).toMatchObject({ passageGroupKey: 'scan-g1', statementOrder: 1, passageText: 'Đoạn', sourceEvidence: null, sampleAnswer: null, maxPoints: null });
    expect(p.questions[3]).toMatchObject({ choices: [], sampleAnswer: null, maxPoints: 8, rubricItems: [{ content: 'mẫu', points: 8 }] });
    expect(p.durationMinutes).toBe(45);
  });
});

describe('render order with examOrder', () => {
  const q = (id: string, over: Partial<Question> = {}): Question => ({
    id, content: id, competencyType: 'BehaviorAdjustment', questionFormat: 'SingleChoice', difficultyLevel: 'Medium', choices: [], ...over,
  } as Question);

  it('scanned exam keeps a true/false group in the middle; legacy exam moves it to the end', () => {
    const tf = (id: string, order: number, examOrder?: number) => q(id, { questionFormat: 'TrueFalse', passageGroupKey: 'scan-g1', statementOrder: order, passageText: 'P', examOrder } as any);
    const scanned = [q('MC1', { examOrder: 1 } as any), tf('S1', 1, 2), tf('S2', 2, 3), q('MC4', { examOrder: 4 } as any)];
    const flat = (groups: any[]) => groups.flatMap((g) => (g.questions ? g.questions.map((x: Question) => x.id) : [g.question?.id ?? g.items?.[0]?.id]));
    const scannedOrder = buildQuestionRenderGroups(scanned).map((g: any) => g.key);
    expect(scannedOrder.length).toBe(3);
    expect(flat(buildQuestionRenderGroups(scanned)).filter(Boolean)).toEqual(['MC1', 'S1', 'S2', 'MC4']);

    const legacy = scanned.map((x) => ({ ...x, examOrder: undefined } as any));
    expect(flat(buildQuestionRenderGroups(legacy)).filter(Boolean)).toEqual(['MC1', 'MC4', 'S1', 'S2']);
  });
});
