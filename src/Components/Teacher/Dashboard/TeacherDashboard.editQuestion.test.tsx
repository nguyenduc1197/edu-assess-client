import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from './TeacherDashboard';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
  getCurrentUserId: jest.fn(() => null),
  decodeJwtPayload: jest.fn(() => null),
}));
const mockedFetch = fetchClient as jest.Mock;

const exam = {
  id: 'ex-1',
  name: 'Đề kiểm tra giữa kỳ',
  start: '2026-10-01T00:00:00',
  end: '2026-12-01T00:00:00',
  durationMinutes: 45,
  antiCheatEnabled: false,
};

const examQuestion = {
  id: 'q-1',
  content: 'Câu hỏi trong đề',
  competencyType: 'BehaviorAdjustment',
  competencyLabel: 'Điều chỉnh hành vi',
  questionFormat: 'SingleChoice',
  questionFormatLabel: 'Trắc nghiệm một đáp án',
  difficultyLevel: 'Medium',
  difficultyLabel: 'Trung bình',
  hasStudentAnswers: true,
  maxPoints: 1,
  choices: [
    { id: 'c-a', optionLabel: 'A', content: 'Phương án A', isCorrect: true },
    { id: 'c-b', optionLabel: 'B', content: 'Phương án B', isCorrect: false },
  ],
};

const json = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => body });

// Round 4, item 5: TeacherDashboard exam detail -> "Câu hỏi" tab -> edit question -> PUT -> refresh.
describe('TeacherDashboard exam-detail question edit', () => {
  let examQuestionCalls = 0;
  let putResponse: () => Promise<any>;

  beforeEach(() => {
    examQuestionCalls = 0;
    putResponse = () => json({ question: examQuestion, recalculatedStudentExamCount: 1, rescoredAnswerCount: 1, scaledEssayAnswerCount: 0, essayAnswersQueuedForRegrade: 0 });
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/exams?')) return json({ items: [exam], totalCount: 1, totalPages: 1 });
      if (url.startsWith('/exams/deleted')) return json({ items: [], totalCount: 0, totalPages: 1 });
      if (url.startsWith('/classes')) return json({ items: [] });
      if (url === '/exams/ex-1/students') return json({ examName: exam.name, students: [], questions: [] });
      if (url.startsWith('/questions?examId=ex-1')) { examQuestionCalls++; return json([examQuestion]); }
      if (url === '/questions/competency-types') return json([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      if (url === '/exams/ex-1/deleted-questions') return json([]);
      if (url === '/questions/q-1' && init?.method === 'PUT') return putResponse();
      return json([]);
    });
  });

  const openEditor = async () => {
    render(<TeacherDashboard onLogout={jest.fn()} />);
    const studentButtons = await screen.findAllByTitle('Xem học sinh');
    fireEvent.click(studentButtons[0]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Câu hỏi' }));
    await screen.findAllByText('Câu hỏi trong đề');
    fireEvent.click(screen.getAllByTitle('Chỉnh sửa câu hỏi')[0]);
    expect(await screen.findByText('Chỉnh Sửa Câu Hỏi')).toBeInTheDocument();
  };

  it('opens prefilled form (format locked), PUTs payload with choice ids, refreshes the list', async () => {
    await openEditor();
    expect(screen.getByDisplayValue('Câu hỏi trong đề')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Phương án A')).toBeInTheDocument();
    const formatSelect = screen.getByRole('option', { name: 'Tự luận' }).closest('select') as HTMLSelectElement;
    expect(formatSelect).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue('Câu hỏi trong đề'), { target: { value: 'Câu hỏi đã sửa' } });
    const radios = screen.getAllByTitle('Đáp án đúng');
    fireEvent.click(radios[1]); // move correct answer to B
    const before = examQuestionCalls;
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/ }));

    await waitFor(() => expect(mockedFetch.mock.calls.some(([u, i]) => u === '/questions/q-1' && i?.method === 'PUT')).toBe(true));
    const [, init] = mockedFetch.mock.calls.find(([u, i]) => u === '/questions/q-1' && i?.method === 'PUT')!;
    const body = JSON.parse(init.body);
    expect(body.content).toBe('Câu hỏi đã sửa');
    expect(body.questionFormat).toBe('SingleChoice');
    expect(body.choices).toEqual([
      { id: 'c-a', optionLabel: 'A', content: 'Phương án A', isCorrect: false, feedback: null },
      { id: 'c-b', optionLabel: 'B', content: 'Phương án B', isCorrect: true, feedback: null },
    ]);

    await waitFor(() => expect(examQuestionCalls).toBeGreaterThan(before));
    expect(await screen.findByText('Đã cập nhật câu hỏi và chấm lại các bài làm liên quan.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Chỉnh Sửa Câu Hỏi')).not.toBeInTheDocument());
  });

  it('shows the backend 400 message inside the edit form', async () => {
    putResponse = () => json({ message: 'Không thể đổi định dạng câu hỏi vì đã có học sinh làm câu này.' }, false, 400);
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/ }));
    expect(await screen.findByText('Không thể đổi định dạng câu hỏi vì đã có học sinh làm câu này.')).toBeInTheDocument();
    expect(screen.getByText('Chỉnh Sửa Câu Hỏi')).toBeInTheDocument();
  });
});
