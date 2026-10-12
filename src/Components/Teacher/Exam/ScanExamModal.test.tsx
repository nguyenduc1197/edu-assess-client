import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScanExamModal from './ScanExamModal';
import { fetchClient } from '../../../api/fetchClient';
import { ExamScanResult } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));
const mockedFetch = fetchClient as jest.Mock;

const ok = (body: unknown, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });

const scanResult: ExamScanResult = {
  sourceFileNames: ['de.pdf'],
  sourceType: 'pdf',
  suggestedTitle: 'Đề kiểm tra giữa kì',
  suggestedSubject: 'GDKT&PL',
  suggestedDurationMinutes: 30,
  questions: [
    {
      order: 1, sourceNumber: 'Câu 1', questionFormat: 'SingleChoice', content: 'Câu trắc nghiệm', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium',
      choices: [{ optionLabel: 'A', content: 'Một', isCorrect: true }, { optionLabel: 'B', content: 'Hai', isCorrect: false }],
      isAnswerAiGuessed: true, hasFigure: true, figureDescription: 'Biểu đồ cung cầu',
    },
    {
      order: 2, sourceNumber: 'Câu 2', questionFormat: 'Essay', content: 'Câu tự luận', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Hard',
      choices: [], isAnswerAiGuessed: false, hasFigure: false, sampleAnswer: null, maxPoints: null, statedPoints: 2,
    },
  ],
  skippedQuestions: [{ number: 'Câu 3', excerpt: 'Điền vào chỗ trống', reason: 'Câu điền khuyết' }],
  warnings: ['Đề gốc tính mỗi nhóm Đúng/Sai 1 điểm, khác 1 câu trắc nghiệm (0.25 điểm).'],
};

const route = (createResponse?: () => Promise<any>) =>
  mockedFetch.mockImplementation((url: string) => {
    if (url.startsWith('/classes')) return ok([{ id: 'c1', name: '10A1' }]);
    if (url === '/questions/competency-types') return ok([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
    if (url === '/exams/scan-file') return ok(scanResult);
    if (url === '/exams/from-scan') return createResponse ? createResponse() : ok({ examId: 'ex-new', questionIds: ['q1', 'q2'] }, 201);
    return ok({});
  });

const uploadAndScan = async () => {
  const input = screen.getByLabelText('Chọn file đề thi');
  fireEvent.change(input, { target: { files: [new File(['%PDF'], 'de.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Đọc đề bằng AI' }));
  await screen.findByText(/Đã đọc 2 câu hỏi/);
};

// Round 5: "Tạo đề thi từ file" upload -> review -> create
describe('ScanExamModal', () => {
  beforeEach(() => mockedFetch.mockReset());

  it('rejects unsupported / mixed files before calling the API', async () => {
    route();
    render(<ScanExamModal onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Chọn file đề thi'), {
      target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' }), new File(['y'], 'b.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByText(/không trộn các loại file/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đọc đề bằng AI' })).toBeDisabled();
    expect(mockedFetch.mock.calls.some(([u]) => u === '/exams/scan-file')).toBe(false);
  });

  it('shows flags, skipped questions and warnings, blocks creation until required fields are valid, then creates', async () => {
    route();
    const onCreated = jest.fn();
    const onClose = jest.fn();
    render(<ScanExamModal onClose={onClose} onCreated={onCreated} />);
    await uploadAndScan();

    const [, init] = mockedFetch.mock.calls.find(([u]) => u === '/exams/scan-file')!;
    expect(init.method).toBe('POST');
    expect((init.body as FormData).getAll('files')).toHaveLength(1);

    expect(screen.getByText('AI đoán – cần kiểm tra')).toBeInTheDocument();
    expect(screen.getByText('Có hình – đã mô tả bằng chữ')).toBeInTheDocument();
    expect(screen.getByText('Thiếu đáp án mẫu')).toBeInTheDocument();
    expect(screen.getByText('Thiếu điểm tối đa')).toBeInTheDocument();
    expect(screen.getByText(/Câu điền khuyết/)).toBeInTheDocument();
    expect(screen.getByText(/nhóm Đúng\/Sai 1 điểm/)).toBeInTheDocument();
    expect(screen.getByLabelText('Tên bài thi')).toHaveValue('Đề kiểm tra giữa kì');
    expect(screen.getByLabelText('Thời lượng làm bài (phút)')).toHaveValue(30);

    const create = screen.getByRole('button', { name: 'Tạo bài thi' });
    expect(create).toBeDisabled();
    expect(screen.getByTestId('scan-review-errors')).toHaveTextContent('đáp án do AI đoán');

    fireEvent.click(screen.getByLabelText('Đã kiểm tra đáp án câu 1'));
    fireEvent.change(screen.getByLabelText('Đáp án mẫu câu 2'), { target: { value: 'Ý 1, ý 2' } });
    fireEvent.change(screen.getByLabelText('Điểm tối đa câu 2'), { target: { value: '8' } });
    await waitFor(() => expect(screen.getByLabelText('Lớp')).toHaveTextContent('10A1'));
    fireEvent.change(screen.getByLabelText('Lớp'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('Thời gian bắt đầu'), { target: { value: '2026-10-20T08:00' } });
    fireEvent.change(screen.getByLabelText('Thời gian kết thúc'), { target: { value: '2026-10-21T08:00' } });

    await waitFor(() => expect(create).not.toBeDisabled());
    expect(screen.queryByTestId('scan-review-errors')).not.toBeInTheDocument();
    fireEvent.click(create);

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('ex-new'));
    expect(onClose).toHaveBeenCalled();
    const [, createInit] = mockedFetch.mock.calls.find(([u]) => u === '/exams/from-scan')!;
    const body = JSON.parse(createInit.body);
    expect(body.name).toBe('Đề kiểm tra giữa kì');
    expect(body.schoolClassId).toBe('c1');
    expect(body.durationMinutes).toBe(30);
    expect(body.questions).toHaveLength(2);
    expect(body.questions[1]).toMatchObject({ questionFormat: 'Essay', sampleAnswer: 'Ý 1, ý 2', maxPoints: 8 });
  });

  it('deleting a question and editing content are reflected in the payload; API errors are shown', async () => {
    route(() => Promise.resolve({ ok: false, status: 400, json: async () => ({ message: 'Câu 1: nội dung câu hỏi không được để trống.' }) }));
    render(<ScanExamModal onClose={jest.fn()} />);
    await uploadAndScan();

    fireEvent.click(screen.getByLabelText('Xóa câu 2'));
    expect(screen.getAllByTestId('scan-question')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Nội dung câu 1'), { target: { value: 'Nội dung đã sửa' } });
    fireEvent.click(screen.getByLabelText('Câu 1: đáp án đúng là B'));
    await waitFor(() => expect(screen.getByLabelText('Lớp')).toHaveTextContent('10A1'));
    fireEvent.change(screen.getByLabelText('Lớp'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('Thời gian bắt đầu'), { target: { value: '2026-10-20T08:00' } });
    fireEvent.change(screen.getByLabelText('Thời gian kết thúc'), { target: { value: '2026-10-21T08:00' } });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo bài thi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Câu 1: nội dung câu hỏi không được để trống.');
    const body = JSON.parse(mockedFetch.mock.calls.find(([u]) => u === '/exams/from-scan')![1].body);
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].content).toBe('Nội dung đã sửa');
    expect(body.questions[0].choices.map((c: any) => c.isCorrect)).toEqual([false, true]);
  });

  it('shows the API error when scanning fails', async () => {
    mockedFetch.mockImplementation((url: string) =>
      url === '/exams/scan-file'
        ? Promise.resolve({ ok: false, status: 400, json: async () => ({ message: 'Tổng dung lượng file vượt quá 20MB.' }) })
        : ok([]));
    render(<ScanExamModal onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Chọn file đề thi'), { target: { files: [new File(['x'], 'de.docx')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Đọc đề bằng AI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tổng dung lượng file vượt quá 20MB.');
  });
});
