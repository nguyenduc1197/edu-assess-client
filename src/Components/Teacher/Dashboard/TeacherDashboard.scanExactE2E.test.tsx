import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TeacherDashboard from './TeacherDashboard';
import AIQuestionGeneratorModal from '../Question/AIQuestionGeneratorModal';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
  getCurrentUserId: jest.fn(() => null),
  decodeJwtPayload: jest.fn(() => null),
}));
const mockedFetch = fetchClient as jest.Mock;
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

const scanResult = {
  sourceFileNames: ['de.pdf'], sourceType: 'pdf', suggestedTitle: 'Tên trong file', suggestedDurationMinutes: 15,
  questions: [
    { order: 1, sourceNumber: 'Câu 1', questionFormat: 'SingleChoice', content: 'Câu MC từ file', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium',
      choices: [{ optionLabel: 'A', content: 'x', isCorrect: true }, { optionLabel: 'B', content: 'y', isCorrect: false }], isAnswerAiGuessed: false, hasFigure: false },
  ],
  skippedQuestions: [], warnings: [],
};

// Round 7 (TEST agent): end-to-end Dashboard -> Tạo Mới -> Tạo câu hỏi bằng AI -> "Tạo đề giống file gốc" -> create.
describe('Dashboard scan-exact end to end', () => {
  let examListCalls = 0;
  let createBody: any = null;

  beforeEach(() => {
    examListCalls = 0; createBody = null;
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/exams?')) { examListCalls++; return json({ items: [], totalCount: 0, totalPages: 1 }); }
      if (url.startsWith('/exams/deleted')) return json({ items: [], totalCount: 0, totalPages: 1 });
      if (url.startsWith('/classes')) return json([{ id: 'c1', name: '10A1' }, { id: 'c2', name: '10A2' }]);
      if (url === '/questions/competency-types') return json([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      if (url === '/exams/scan-file') return json(scanResult);
      if (url === '/exams/from-scan') { createBody = JSON.parse(init!.body as string); return json({ examId: 'ex-new', questionIds: ['q1'] }, 201); }
      return json([]);
    });
  });

  it('teacher form values (incl. default 45 min) win over file suggestions; success closes windows, toasts and refreshes', async () => {
    render(<TeacherDashboard onLogout={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Tạo Mới/ }));

    // Fill the Create form (duration left at its default 45).
    fireEvent.change(await screen.findByLabelText(/Tên bài/i, { selector: 'input#name' }), { target: { value: 'Tên GV nhập' } });
    await waitFor(() => expect(document.querySelector('#classId option[value="c2"]')).not.toBeNull());
    fireEvent.change(document.getElementById('classId')!, { target: { value: 'c2' } });
    fireEvent.change(document.getElementById('start')!, { target: { value: '2026-11-01T07:30' } });
    fireEvent.change(document.getElementById('end')!, { target: { value: '2026-11-02T07:30' } });
    expect((document.getElementById('durationMinutes') as HTMLInputElement).value).toBe('45');

    fireEvent.click(screen.getByRole('button', { name: /Tạo câu hỏi bằng AI/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo đề giống file gốc' }));
    const flow = await screen.findByTestId('scan-exam-flow');
    expect(within(flow).queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument();

    fireEvent.change(within(flow).getByLabelText('Chọn file đề thi'), { target: { files: [new File(['%PDF'], 'de.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(within(flow).getByRole('button', { name: 'Đọc đề bằng AI' }));

    await waitFor(() => expect(within(flow).getByLabelText('Tên bài thi')).toHaveValue('Tên GV nhập'));
    expect(within(flow).getByLabelText('Thời lượng làm bài (phút)')).toHaveValue(45); // not the file's 15
    await waitFor(() => expect(within(flow).getByLabelText('Lớp')).toHaveValue('c2'));
    expect(within(flow).getByLabelText('Thời gian bắt đầu')).toHaveValue('2026-11-01T07:30');

    const before = examListCalls;
    const create = within(flow).getByRole('button', { name: 'Tạo bài thi' });
    await waitFor(() => expect(create).not.toBeDisabled());
    fireEvent.click(create);

    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody).toMatchObject({ name: 'Tên GV nhập', schoolClassId: 'c2', durationMinutes: 45 });
    expect(createBody.questions.map((q: any) => q.content)).toEqual(['Câu MC từ file']);

    expect(await screen.findByText('Đã tạo bài thi từ file đề.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('scan-exam-flow')).not.toBeInTheDocument());
    expect(screen.queryByText('Tạo bài thi bằng AI')).not.toBeInTheDocument();
    await waitFor(() => expect(examListCalls).toBeGreaterThan(before));
  });

  it('empty Create form: file title fills the name, and a cleared duration lets the file duration through', async () => {
    render(<TeacherDashboard onLogout={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Tạo Mới/ }));
    await screen.findByRole('button', { name: /Tạo câu hỏi bằng AI/ });
    fireEvent.change(document.getElementById('durationMinutes')!, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Tạo câu hỏi bằng AI/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo đề giống file gốc' }));
    const flow = await screen.findByTestId('scan-exam-flow');
    fireEvent.change(within(flow).getByLabelText('Chọn file đề thi'), { target: { files: [new File(['%PDF'], 'de.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(within(flow).getByRole('button', { name: 'Đọc đề bằng AI' }));
    await waitFor(() => expect(within(flow).getByLabelText('Tên bài thi')).toHaveValue('Tên trong file'));
    expect(within(flow).getByLabelText('Thời lượng làm bài (phút)')).toHaveValue(15);
  });
});

// Round 7 (TEST agent): the renamed variant tab still calls the old flow.
describe('AIQuestionGeneratorModal variant tab regression', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url === '/exams/ai-generate-from-scan') {
        return json({ variantCount: 1, examVariants: [{ variantIndex: 1, title: 'Biến thể 1', questions: [
          { id: 'g1', content: 'Câu biến thể', questionFormat: 'SingleChoice', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium',
            choices: [{ optionLabel: 'A', content: 'a', isCorrect: true }, { optionLabel: 'B', content: 'b', isCorrect: false }] }] }] });
      }
      if (url === '/questions/competency-types') return json([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      return json([]);
    });
  });

  it('"Tạo đề biến thể từ ảnh scan" uploads to /exams/ai-generate-from-scan and shows the variant', async () => {
    const { container } = render(
      <AIQuestionGeneratorModal onClose={jest.fn()} competencyOptions={[{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }] as any} enableExamVariantMode />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề biến thể từ ảnh scan' }));
    expect(screen.queryByTestId('scan-exam-flow')).not.toBeInTheDocument();
    const fileInput = container.querySelector('input[type="file"][accept*="image/png"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'scan.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: /Tạo đề mới từ ảnh scan/ }));
    await waitFor(() => expect(mockedFetch.mock.calls.some(([u]) => u === '/exams/ai-generate-from-scan')).toBe(true));
    const [, init] = mockedFetch.mock.calls.find(([u]) => u === '/exams/ai-generate-from-scan')!;
    expect(((init.body as FormData).get('file') as File).name).toBe('scan.png');
    expect((init.body as FormData).get('variantCount')).toBe('3');
    expect(await screen.findByText('Câu biến thể')).toBeInTheDocument();
  });
});
