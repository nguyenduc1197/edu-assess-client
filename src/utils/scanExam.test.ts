import { ExamScanResult } from '../types';
import {
  buildCreateFromScanPayload,
  collectScanReviewErrors,
  ScanExamFields,
  setCorrectChoice,
  toReviewQuestions,
  validateReviewQuestion,
  validateScanExamFields,
  validateScanFiles,
} from './scanExam';

const file = (name: string, size = 100, type = '') => ({ name, size, type });

// Round 5: "Tạo đề thi từ file" client-side rules
describe('validateScanFiles', () => {
  it('accepts one pdf, several images, one docx', () => {
    expect(validateScanFiles([file('de.pdf')])).toBeNull();
    expect(validateScanFiles([file('1.jpg'), file('2.png'), file('3.webp')])).toBeNull();
    expect(validateScanFiles([file('de.docx')])).toBeNull();
  });

  it.each([
    [[], /Vui lòng chọn file/],
    [[file('de.doc')], /không được hỗ trợ/],
    [[file('a.pdf'), file('b.jpg')], /không trộn/],
    [[file('a.pdf'), file('b.pdf')], /1 file PDF/],
    [[file('a.docx'), file('b.docx')], /1 file Word/],
    [[file('a.jpg', 0)], /rỗng/],
    [[file('a.jpg', 21 * 1024 * 1024)], /20MB/],
  ])('rejects %#', (files, message) => {
    expect(validateScanFiles(files as any)).toMatch(message as RegExp);
  });

  it('rejects more than 20 images', () => {
    expect(validateScanFiles(Array.from({ length: 21 }, (_, i) => file(`${i}.jpg`)))).toMatch(/20 ảnh/);
  });
});

const scanResult: ExamScanResult = {
  sourceFileNames: ['de.pdf'],
  sourceType: 'pdf',
  suggestedTitle: 'Đề giữa kì',
  suggestedDurationMinutes: 45,
  questions: [
    {
      order: 1, sourceNumber: 'Câu 1', questionFormat: 'SingleChoice', content: 'MC', competencyType: 'SelfDevelopment', difficultyLevel: 'Easy',
      choices: [{ optionLabel: 'A', content: 'a', isCorrect: false }, { optionLabel: 'B', content: 'b', isCorrect: true }],
      isAnswerAiGuessed: true, hasFigure: false,
    },
    {
      order: 2, sourceNumber: 'Câu 2', questionFormat: 'TrueFalse', content: 'Mệnh đề a', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium',
      passageText: 'Đoạn', passageGroupKey: 'scan-g1', statementOrder: 1,
      choices: [{ optionLabel: 'A', content: 'Đúng', isCorrect: false }, { optionLabel: 'B', content: 'Sai', isCorrect: false }],
      isAnswerAiGuessed: false, hasFigure: false,
    },
    {
      order: 3, sourceNumber: 'Câu 3', questionFormat: 'Essay', content: 'Tự luận', competencyType: 'EconomicSocialParticipation', difficultyLevel: 'Hard',
      choices: [], isAnswerAiGuessed: false, hasFigure: true, figureDescription: 'Hình', sampleAnswer: null, maxPoints: null, statedPoints: 2,
    },
  ],
  skippedQuestions: [],
  warnings: [],
};

const fields: ScanExamFields = {
  name: 'Đề', schoolClassId: 'c1', start: '2026-10-20T08:00', end: '2026-10-21T08:00', durationMinutes: '45', antiCheatEnabled: false, trueFalseScoringMode: 'Tiered',
};

describe('scan review validation', () => {
  it('flags AI-guessed answer, missing true/false answer, essay without rubric', () => {
    const [mc, tf, essay] = toReviewQuestions(scanResult);
    expect(mc.answerConfirmed).toBe(false);
    expect(validateReviewQuestion(mc, 1)).toEqual(['Câu 1: đáp án do AI đoán – cần kiểm tra và xác nhận.']);
    expect(validateReviewQuestion(tf, 2)).toEqual(['Câu 2: phải chọn đúng một đáp án đúng.']);
    expect(validateReviewQuestion(essay, 3)).toEqual(['Câu 3: Nội dung mỗi ý không được để trống.']);
  });

  it('choosing an answer confirms it; essay rubric needs quarter-step points, total up to 40', () => {
    const [mc, tf, essay] = toReviewQuestions(scanResult);
    expect(validateReviewQuestion(setCorrectChoice(mc, 0), 1)).toEqual([]);
    expect(validateReviewQuestion(setCorrectChoice(tf, 0), 2)).toEqual([]);
    const filled = { ...essay, rubricInputs: [{ content: 'Ý chính', points: '8' }] };
    expect(validateReviewQuestion(filled, 3)).toEqual([]);
    expect(validateReviewQuestion({ ...filled, rubricInputs: [{ content: 'Ý', points: '1.3' }] }, 3)[0]).toMatch(/bội số của 0\.25/);
    expect(validateReviewQuestion({ ...filled, rubricInputs: [{ content: 'Ý', points: '40' }, { content: 'Ý 2', points: '0.25' }] }, 3)[0]).toMatch(/không vượt quá 40/);
  });

  it('validates exam fields', () => {
    expect(validateScanExamFields(fields)).toEqual([]);
    expect(validateScanExamFields({ ...fields, name: ' ', schoolClassId: '', durationMinutes: '0', end: '2026-10-19T08:00' })).toEqual([
      'Vui lòng nhập tên bài thi.',
      'Vui lòng chọn lớp học.',
      'Thời gian kết thúc giao bài phải sau thời gian bắt đầu.',
      'Thời lượng làm bài phải là số nguyên lớn hơn 0 phút.',
    ]);
  });

  it('collects all blocking errors and requires at least one question', () => {
    expect(collectScanReviewErrors([], fields)).toContain('Đề thi cần có ít nhất một câu hỏi.');
    expect(collectScanReviewErrors(toReviewQuestions(scanResult), fields)).toHaveLength(3);
  });

  it('builds the create payload in order with essay fields', () => {
    const [mc, tf, essay] = toReviewQuestions(scanResult);
    const payload = buildCreateFromScanPayload(
      [setCorrectChoice(mc, 1), setCorrectChoice(tf, 1), { ...essay, rubricInputs: [{ content: ' Ý chính ', points: '5' }, { content: 'Ý phụ', points: '3' }] }],
      fields
    );
    expect(payload.name).toBe('Đề');
    expect(payload.durationMinutes).toBe(45);
    expect(payload.schoolClassId).toBe('c1');
    expect(payload.questions.map((q) => q.questionFormat)).toEqual(['SingleChoice', 'TrueFalse', 'Essay']);
    expect(payload.questions[0].choices).toEqual([
      { optionLabel: 'A', content: 'a', isCorrect: false },
      { optionLabel: 'B', content: 'b', isCorrect: true },
    ]);
    expect(payload.questions[1]).toMatchObject({ passageGroupKey: 'scan-g1', statementOrder: 1, passageText: 'Đoạn' });
    expect(payload.questions[2]).toMatchObject({ sampleAnswer: null, maxPoints: 8, choices: [] });
    expect(payload.questions[2].rubricItems).toEqual([{ content: 'Ý chính', points: 5 }, { content: 'Ý phụ', points: 3 }]);
    expect(payload.trueFalseScoringMode).toBe('Tiered');
  });
});
