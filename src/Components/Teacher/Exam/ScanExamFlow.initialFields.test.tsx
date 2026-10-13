import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ScanExamFlow from './ScanExamFlow';
import { fetchClient } from '../../../api/fetchClient';
import { ExamScanResult } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
const mockedFetch = fetchClient as jest.Mock;
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

const scan = {
  sourceFileNames: ['de.pdf'], sourceType: 'pdf', suggestedTitle: 'Tên trong file', suggestedDurationMinutes: 15,
  questions: [{ order: 1, questionFormat: 'Essay', content: 'Tự luận', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium',
    choices: [], isAnswerAiGuessed: false, hasFigure: false, sampleAnswer: 'Mẫu', maxPoints: 2 }],
  skippedQuestions: [], warnings: [],
} as unknown as ExamScanResult;

const scanFile = async () => {
  fireEvent.change(screen.getByLabelText('Chọn file đề thi'), { target: { files: [new File(['%PDF'], 'de.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Đọc đề bằng AI' }));
  await screen.findByText(/Đã đọc 1 câu hỏi/);
};

// Round 7: values the teacher already entered win over the file suggestions; suggestions fill empty fields.
describe('ScanExamFlow initialExamFields', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/classes')) return ok([{ id: 'c1', name: '10A1' }]);
      if (url === '/exams/scan-file') return ok(scan);
      return ok([]);
    });
  });

  it('teacher values have priority over suggestions', async () => {
    render(<ScanExamFlow initialExamFields={{ name: 'Tên GV nhập', schoolClassId: 'c1', start: '2026-10-20T08:00', end: '2026-10-21T08:00', durationMinutes: '40', antiCheatEnabled: true }} />);
    await scanFile();
    expect(screen.getByLabelText('Tên bài thi')).toHaveValue('Tên GV nhập');
    expect(screen.getByLabelText('Thời lượng làm bài (phút)')).toHaveValue(40);
    expect(screen.getByLabelText('Thời gian bắt đầu')).toHaveValue('2026-10-20T08:00');
    expect(screen.getByLabelText('Thời gian kết thúc')).toHaveValue('2026-10-21T08:00');
    expect(screen.getByLabelText('Bật giám sát vi phạm')).toBeChecked();
    expect(await screen.findByRole('option', { name: '10A1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Lớp')).toHaveValue('c1');
  });

  it('suggestions fill empty fields', async () => {
    render(<ScanExamFlow initialExamFields={{ name: '  ', schoolClassId: '', start: '', end: '' }} />);
    await scanFile();
    expect(screen.getByLabelText('Tên bài thi')).toHaveValue('Tên trong file');
    expect(screen.getByLabelText('Thời lượng làm bài (phút)')).toHaveValue(15);
  });

  it('no cancel button when no onClose is given (embedded in the AI window)', () => {
    render(<ScanExamFlow />);
    expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument();
  });
});
