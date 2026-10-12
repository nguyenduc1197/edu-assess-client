import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScanExamModal from './ScanExamModal';
import { fetchClient } from '../../../api/fetchClient';
import { ExamScanResult } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
const mockedFetch = fetchClient as jest.Mock;
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });

const scan: ExamScanResult = {
  sourceFileNames: ['p1.jpg', 'p2.jpg'], sourceType: 'images', suggestedTitle: 'Đề ảnh', suggestedDurationMinutes: 15,
  questions: [
    { order: 1, sourceNumber: 'Câu 1', questionFormat: 'TrueFalse', content: 'Mệnh đề a', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium',
      passageGroupKey: 'scan-g1', statementOrder: 1, passageText: 'Đoạn tư liệu',
      choices: [{ optionLabel: 'A', content: 'Đúng', isCorrect: true }, { optionLabel: 'B', content: 'Sai', isCorrect: false }], isAnswerAiGuessed: true, hasFigure: false },
    { order: 2, sourceNumber: 'Câu 2', questionFormat: 'SingleChoice', content: 'Câu MC', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium',
      choices: [{ optionLabel: 'A', content: 'x', isCorrect: false }, { optionLabel: 'B', content: 'y', isCorrect: false }], isAnswerAiGuessed: false, hasFigure: false },
  ],
  skippedQuestions: [], warnings: [],
} as ExamScanResult;

// Round 5 (TEST agent): image page order sent to the API, AI-guess confirmation and answer selection gate creation.
describe('ScanExamModal edge cases', () => {
  let sentFiles: string[] = [];
  let createBody: any = null;

  beforeEach(() => {
    sentFiles = []; createBody = null;
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/classes')) return ok([{ id: 'c1', name: '10A1' }]);
      if (url === '/questions/competency-types') return ok([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      if (url === '/exams/scan-file') {
        sentFiles = ((init!.body as FormData).getAll('files') as File[]).map((x) => x.name);
        return ok(scan);
      }
      if (url === '/exams/from-scan') { createBody = JSON.parse(init!.body as string); return ok({ examId: 'e1', questionIds: [] }, 201); }
      return ok({});
    });
  });

  it('reordered page images are uploaded in the displayed order', async () => {
    render(<ScanExamModal onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Chọn file đề thi'), {
      target: { files: ['p1.jpg', 'p2.jpg', 'p3.jpg'].map((n) => new File(['x'], n, { type: 'image/jpeg' })) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đưa p3.jpg lên' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đưa p1.jpg xuống' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đọc đề bằng AI' }));
    await waitFor(() => expect(sentFiles.length).toBe(3));
    expect(sentFiles).toEqual(['p3.jpg', 'p1.jpg', 'p2.jpg']); // [p1,p2,p3] -> p3 up -> [p1,p3,p2] -> p1 down -> [p3,p1,p2]
  });

  it('21 images: scan button disabled and no API call', async () => {
    render(<ScanExamModal onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Chọn file đề thi'), {
      target: { files: Array.from({ length: 21 }, (_, i) => new File(['x'], `p${i}.png`, { type: 'image/png' })) },
    });
    expect(screen.getByRole('button', { name: 'Đọc đề bằng AI' })).toBeDisabled();
    expect(screen.getAllByText('Chỉ được tải lên tối đa 20 ảnh.').length).toBeGreaterThan(0);
    expect(mockedFetch.mock.calls.some(([u]) => u === '/exams/scan-file')).toBe(false);
  });

  it('creation blocked until AI guess confirmed and missing answer chosen; then payload is in order', async () => {
    render(<ScanExamModal onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Chọn file đề thi'), { target: { files: [new File(['x'], 'p1.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Đọc đề bằng AI' }));
    const create = await screen.findByRole('button', { name: 'Tạo bài thi' });
    expect(screen.getByText('AI đoán – cần kiểm tra')).toBeInTheDocument();
    expect(screen.getByText('Chưa có đáp án đúng')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lớp'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('Thời gian bắt đầu'), { target: { value: '2026-10-20T08:00' } });
    fireEvent.change(screen.getByLabelText('Thời gian kết thúc'), { target: { value: '2026-10-21T08:00' } });
    expect(create).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Đã kiểm tra đáp án câu 1'));
    expect(create).toBeDisabled(); // question 2 still has no correct answer
    fireEvent.click(screen.getByLabelText('Câu 2: đáp án đúng là B'));
    await waitFor(() => expect(create).not.toBeDisabled());

    fireEvent.click(create);
    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody.name).toBe('Đề ảnh');
    expect(createBody.durationMinutes).toBe(15);
    expect(createBody.questions.map((q: any) => q.content)).toEqual(['Mệnh đề a', 'Câu MC']);
    expect(createBody.questions[0]).toMatchObject({ questionFormat: 'TrueFalse', passageGroupKey: 'scan-g1', statementOrder: 1 });
    expect(createBody.questions[1].choices.map((c: any) => c.isCorrect)).toEqual([false, true]);
  });
});
