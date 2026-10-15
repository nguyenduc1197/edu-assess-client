import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ScanExamFlow from './ScanExamFlow';
import { fetchClient } from '../../../api/fetchClient';
import { ExamScanResult } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
const mockedFetch = fetchClient as jest.Mock;
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });

const scan = {
  sourceFileNames: ['de.pdf'], sourceType: 'pdf', questions: [
    { order: 1, sourceNumber: 'Câu 1', questionFormat: 'FillInBlank', content: 'Giá tăng thì [[1]] giảm.', competencyType: 'BehaviorAdjustment',
      difficultyLevel: 'Medium', isAnswerAiGuessed: true, hasFigure: false,
      choices: [
        { optionLabel: 'A', content: 'lượng cầu', isCorrect: true, correctSlot: 1 },
        { optionLabel: 'B', content: 'lạm phát', isCorrect: false, correctSlot: null },
      ] },
  ], skippedQuestions: [], warnings: [],
} as unknown as ExamScanResult;

// Round 8 (G): an AI-guessed fill-in answer is confirmed only by changing the key or ticking the box, not by editing text.
describe('ScanExamFlow – AI-guessed fill-in answers', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/classes')) return ok([{ id: 'c1', name: '10A1' }]);
      if (url === '/questions/competency-types') return ok([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      if (url === '/exams/scan-file') return ok(scan);
      return ok({});
    });
  });

  const openReview = async () => {
    render(<ScanExamFlow onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Chọn file đề thi'), {
      target: { files: [new File(['x'], 'de.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đọc đề bằng AI' }));
    return (await screen.findByLabelText('Đã kiểm tra đáp án câu 1')) as HTMLInputElement;
  };

  it('editing a word does not confirm the AI answer', async () => {
    const confirm = await openReview();
    expect(confirm.checked).toBe(false);
    fireEvent.change(screen.getByLabelText('Câu 1 từ b'), { target: { value: 'lạm phát cao' } });
    expect((screen.getByLabelText('Đã kiểm tra đáp án câu 1') as HTMLInputElement).checked).toBe(false);
  });

  it('changing the answer key confirms it', async () => {
    await openReview();
    fireEvent.change(screen.getByLabelText('Câu 1 đáp án cho từ b'), { target: { value: '1' } });
    expect((screen.getByLabelText('Đã kiểm tra đáp án câu 1') as HTMLInputElement).checked).toBe(true);
  });
});
