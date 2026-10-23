import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SourceFeedbackUpdateModal from './SourceFeedbackUpdateModal';
import StructuredAnswerReviewList from '../../Common/StructuredAnswers/StructuredAnswerReviewList';
import CompetencyCommentList from '../../Common/CompetencyComments/CompetencyCommentList';
import AddQuestionMenu from './AddQuestionMenu';
import { fetchClient } from '../../../api/fetchClient';
import { buildApplySourceFeedbackPayload, SourceFeedbackPreview } from '../../../utils/sourceFeedback';
import { buildCreateFromScanPayload, toReviewQuestions, validateReviewQuestion } from '../../../utils/scanExam';
import { buildCreateQuestionPayload, buildUpdateQuestionPayload } from '../../../utils/questionPayload';
import { ExamScanResult, Question, StructuredAnswerReview } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
const mockedFetch = fetchClient as jest.Mock;

const json = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => data });

const scanResult: ExamScanResult = {
  sourceFileNames: ['Web_Bai1.docx'],
  sourceType: 'docx',
  questions: [
    {
      order: 1,
      sourceNumber: 'Câu 1',
      questionFormat: 'SingleChoice',
      content: 'Cạnh tranh là',
      competencyType: 'BehaviorAdjustment',
      difficultyLevel: 'Easy',
      choices: [
        { optionLabel: 'A', content: 'ganh đua', isCorrect: true, feedback: 'Chính xác!' },
        { optionLabel: 'B', content: 'hợp tác', isCorrect: false, feedback: '  Chưa đúng.  ' },
      ],
      isAnswerAiGuessed: false,
      hasFigure: false,
      explanation: ' Giải thích chung ',
    },
  ],
  skippedQuestions: [],
  warnings: [],
  competencyComments: [{ competencyType: 'BehaviorAdjustment', comment: 'NX NL I' }],
};

const preview: SourceFeedbackPreview = {
  matchedCount: 2,
  withFeedbackCount: 1,
  unmatchedScanned: ['Câu 9'],
  competencyComments: [{ competencyType: 'EconomicSocialParticipation', comment: 'NX NL III' }],
  questions: [
    {
      questionId: 'q1',
      examOrder: 1,
      questionFormat: 'SingleChoice',
      questionContent: 'Cạnh tranh là',
      matched: true,
      scannedNumber: 'Câu 1',
      explanation: null,
      currentExplanation: 'Giải thích cũ',
      choices: [
        { choiceId: 'c1', content: 'ganh đua', isCorrect: true, feedback: 'Chính xác!' },
        { choiceId: 'c2', content: 'hợp tác', isCorrect: false, feedback: null },
      ],
    },
    {
      questionId: 'q2',
      examOrder: 2,
      questionFormat: 'TrueFalse',
      questionContent: 'Ý a',
      matched: true,
      choices: [],
    },
    {
      questionId: 'q3',
      examOrder: 3,
      questionFormat: 'SingleChoice',
      questionContent: 'Câu không khớp',
      matched: false,
      explanation: 'không dùng',
      choices: [],
    },
  ],
};

describe('Source feedback – utils', () => {
  it('create-from-scan payload carries option feedback, explanation and competency comments', () => {
    const questions = toReviewQuestions(scanResult);
    const payload = buildCreateFromScanPayload(
      questions,
      { name: 'Bài 1', schoolClassId: 'c', start: '2026-10-24T08:00', end: '2026-10-24T09:00', durationMinutes: '15', antiCheatEnabled: false, trueFalseScoringMode: 'Tiered' },
      [...(scanResult.competencyComments || []), { competencyType: 'SelfDevelopment', comment: '   ' }],
    );
    expect(payload.questions[0].explanation).toBe('Giải thích chung');
    expect(payload.questions[0].choices).toEqual([
      { optionLabel: 'A', content: 'ganh đua', isCorrect: true, feedback: 'Chính xác!' },
      { optionLabel: 'B', content: 'hợp tác', isCorrect: false, feedback: 'Chưa đúng.' },
    ]);
    expect(payload.competencyComments).toEqual([{ competencyType: 'BehaviorAdjustment', comment: 'NX NL I' }]);
  });

  it('flags too long feedback in the scan review', () => {
    const [question] = toReviewQuestions(scanResult);
    question.choices[1].feedback = 'x'.repeat(2001);
    expect(validateReviewQuestion(question, 1)).toContain('Câu 1: phản hồi của phương án không được vượt quá 2000 ký tự.');
  });

  it('apply payload: only matched questions with file feedback, keeps current explanation, comments replaced', () => {
    const payload = buildApplySourceFeedbackPayload(preview, preview.competencyComments);
    expect(payload).toEqual({
      questions: [{ questionId: 'q1', explanation: 'Giải thích cũ', choices: [{ choiceId: 'c1', feedback: 'Chính xác!' }] }],
      competencyComments: [{ competencyType: 'EconomicSocialParticipation', comment: 'NX NL III' }],
    });
    expect(buildApplySourceFeedbackPayload(preview, []).competencyComments).toBeNull();
  });

  it('question payloads round-trip feedback and explanation so editing never drops them', () => {
    const question: Question = {
      id: 'q1',
      content: 'Câu',
      competencyType: 'BehaviorAdjustment',
      questionFormat: 'SingleChoice',
      difficultyLevel: 'Medium',
      explanation: 'Giải thích',
      choices: [
        { id: 'c1', optionLabel: 'A', content: 'x', isCorrect: true, feedback: 'Chính xác!' },
        { id: 'c2', optionLabel: 'B', content: 'y', isCorrect: false },
      ],
    };
    const update = buildUpdateQuestionPayload(question);
    expect(update.explanation).toBe('Giải thích');
    expect(update.choices).toEqual([
      { id: 'c1', optionLabel: 'A', content: 'x', isCorrect: true, feedback: 'Chính xác!' },
      { id: 'c2', optionLabel: 'B', content: 'y', isCorrect: false, feedback: null },
    ]);
    expect(buildCreateQuestionPayload({ ...question, explanation: '  ' }).explanation).toBeNull();
  });
});

describe('Source feedback – result display', () => {
  it('shows the explanation of a matching part', () => {
    const item: StructuredAnswerReview = {
      questionId: 'q',
      questionFormat: 'Matching',
      questionContent: 'Ghép',
      score: 0.5,
      correctCount: 1,
      slotCount: 2,
      slots: [
        { slot: 1, prompt: 'Vừa phải', selectedText: 'dưới 10%', correctText: 'dưới 10%', isCorrect: true },
        { slot: 2, prompt: 'Siêu', selectedText: 'giảm phát', correctText: 'trên 1 000%', isCorrect: false },
      ],
      explanation: 'Ngưỡng phân loại: dưới 10% – vừa phải',
    };
    render(<StructuredAnswerReviewList items={[item]} />);
    expect(screen.getByText('Ngưỡng phân loại: dưới 10% – vừa phải')).toBeInTheDocument();
  });

  it('lists competency comments with their labels and renders nothing when empty', () => {
    const { container, rerender } = render(<CompetencyCommentList comments={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CompetencyCommentList comments={[{ competencyType: 'BehaviorAdjustment', comment: 'Em cần củng cố.' }]} />);
    expect(screen.getByText('Nhận xét theo năng lực')).toBeInTheDocument();
    expect(screen.getByText('Điều chỉnh hành vi')).toBeInTheDocument();
    expect(screen.getByText('Em cần củng cố.')).toBeInTheDocument();
  });
});

describe('SourceFeedbackUpdateModal', () => {
  beforeEach(() => mockedFetch.mockReset());

  it('scans, matches, shows the preview and saves only the feedback', async () => {
    mockedFetch
      .mockResolvedValueOnce(json(scanResult))
      .mockResolvedValueOnce(json(preview))
      .mockResolvedValueOnce(json({ updatedQuestionCount: 1, clearedAiExplanationCount: 3 }));
    const onSaved = jest.fn();
    const onClose = jest.fn();
    render(<SourceFeedbackUpdateModal examId="exam-1" examTitle="Bài 1" onClose={onClose} onSaved={onSaved} />);

    const file = new File(['x'], 'Web_Bai1.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(screen.getByLabelText('Chọn file đề gốc'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Đọc file và đối chiếu' }));

    expect(await screen.findByTestId('source-feedback-preview')).toBeInTheDocument();
    expect(mockedFetch.mock.calls[0][0]).toBe('/exams/scan-file');
    expect(mockedFetch.mock.calls[1][0]).toBe('/exams/exam-1/source-feedback/match');
    expect(JSON.parse(mockedFetch.mock.calls[1][1].body).questions[0].content).toBe('Cạnh tranh là');
    expect(screen.getByText(/Khớp 2\/3 câu/)).toBeInTheDocument();
    expect(screen.getByText(/Câu 9/)).toBeInTheDocument();
    expect(screen.getByText(/Không tìm thấy câu này trong file/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nhận xét theo bài – Tìm hiểu/), { target: { value: 'NX đã sửa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phản hồi' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = mockedFetch.mock.calls[2];
    expect(url).toBe('/exams/exam-1/source-feedback/apply');
    expect(JSON.parse(init.body)).toEqual({
      questions: [{ questionId: 'q1', explanation: 'Giải thích cũ', choices: [{ choiceId: 'c1', feedback: 'Chính xác!' }] }],
      competencyComments: [{ competencyType: 'EconomicSocialParticipation', comment: 'NX đã sửa' }],
    });
    expect(onSaved.mock.calls[0][0]).toContain('1 câu hỏi');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the API message when matching fails', async () => {
    mockedFetch.mockResolvedValueOnce(json(scanResult)).mockResolvedValueOnce(json({ message: 'Không tìm thấy bài thi.' }, false));
    render(<SourceFeedbackUpdateModal examId="x" examTitle="Bài" onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Chọn file đề gốc'), { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Đọc file và đối chiếu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy bài thi.');
  });
});

describe('AddQuestionMenu feedback fields', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue(json([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]));
  });

  it('edits option feedback and explanation and keeps them on save', async () => {
    const onUpdateQuestion = jest.fn().mockResolvedValue(undefined);
    const initialQuestion: Question = {
      id: 'q1',
      content: 'Cạnh tranh là',
      competencyType: 'BehaviorAdjustment',
      questionFormat: 'SingleChoice',
      difficultyLevel: 'Medium',
      explanation: 'Giải thích cũ',
      choices: [
        { id: 'c1', optionLabel: 'A', content: 'ganh đua', isCorrect: true, feedback: 'Chính xác!' },
        { id: 'c2', optionLabel: 'B', content: 'hợp tác', isCorrect: false, feedback: null },
      ],
    };
    render(<AddQuestionMenu onClose={jest.fn()} initialQuestion={initialQuestion} onUpdateQuestion={onUpdateQuestion} />);

    expect(screen.getByLabelText('Phản hồi khi chọn A')).toHaveValue('Chính xác!');
    fireEvent.change(screen.getByLabelText('Phản hồi khi chọn B'), { target: { value: 'Chưa đúng. Hợp tác.' } });
    fireEvent.change(screen.getByLabelText('Giải thích khi học sinh làm sai (tùy chọn)'), { target: { value: 'Giải thích mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu Thay Đổi' }));

    await waitFor(() => expect(onUpdateQuestion).toHaveBeenCalled());
    const saved: Question = onUpdateQuestion.mock.calls[0][0];
    expect(saved.explanation).toBe('Giải thích mới');
    expect(saved.choices?.map((c) => c.feedback)).toEqual(['Chính xác!', 'Chưa đúng. Hợp tác.']);
  });
});
