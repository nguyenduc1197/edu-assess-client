import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import QuestionManagement from './QuestionManagement';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
  getCurrentUserId: jest.fn(() => null),
  decodeJwtPayload: jest.fn(() => null),
}));

const mockedFetch = fetchClient as jest.Mock;

const bankItem = {
  id: 'q-1',
  content: 'Câu hỏi ngân hàng',
  competencyType: 'BehaviorAdjustment',
  competencyLabel: 'Điều chỉnh hành vi',
  questionFormat: 'SingleChoice',
  questionFormatLabel: 'Trắc nghiệm một đáp án',
  difficultyLevel: 'Medium',
  hasStudentAnswers: false,
  maxPoints: 1,
  choices: [
    { id: 'c-a', optionLabel: 'A', content: 'Một', isCorrect: false },
    { id: 'c-b', optionLabel: 'B', content: 'Hai', isCorrect: true },
    { id: 'c-c', optionLabel: 'C', content: 'Ba', isCorrect: false },
  ],
};

const json = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => body });

// Round 2, item 6: edit button in question bank -> prefilled form -> PUT /questions/{id}; errors in form; refresh + summary.
describe('QuestionManagement edit question', () => {
  let putResponse: () => Promise<any>;
  let listCalls = 0;

  beforeEach(() => {
    listCalls = 0;
    mockedFetch.mockReset();
    putResponse = () => json({ question: bankItem, recalculatedStudentExamCount: 2, rescoredAnswerCount: 3, scaledEssayAnswerCount: 0, essayAnswersQueuedForRegrade: 1 });
    mockedFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/questions/competency-types') return json([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      if (url.startsWith('/questions/without-exam')) { listCalls++; return json([bankItem]); }
      if (url.startsWith('/questions/q-1') && init?.method === 'PUT') return putResponse();
      return json([]);
    });
  });

  const openEditor = async () => {
    render(<QuestionManagement />);
    await screen.findAllByText('Câu hỏi ngân hàng');
    const editButtons = screen.getAllByTitle('Chỉnh sửa');
    expect(editButtons[0]).not.toBeDisabled();
    fireEvent.click(editButtons[0]);
    expect(await screen.findByText('Chỉnh Sửa Câu Hỏi')).toBeInTheDocument();
  };

  it('opens a prefilled form and PUTs choice ids (removing C, editing A), then shows summary and refreshes', async () => {
    await openEditor();
    expect(screen.getByDisplayValue('Câu hỏi ngân hàng')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Một'), { target: { value: 'Một sửa' } });

    const before = listCalls;
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/ }));

    await waitFor(() => expect(mockedFetch.mock.calls.some(([u, i]) => u === '/questions/q-1' && i?.method === 'PUT')).toBe(true));
    const [, init] = mockedFetch.mock.calls.find(([u, i]) => u === '/questions/q-1' && i?.method === 'PUT')!;
    const body = JSON.parse(init.body);
    expect(body.content).toBe('Câu hỏi ngân hàng');
    expect(body.questionFormat).toBe('SingleChoice');
    expect(body.choices).toEqual([
      { id: 'c-a', optionLabel: 'A', content: 'Một sửa', isCorrect: false, feedback: null },
      { id: 'c-b', optionLabel: 'B', content: 'Hai', isCorrect: true, feedback: null },
      { id: 'c-c', optionLabel: 'C', content: 'Ba', isCorrect: false, feedback: null },
    ]);

    expect(await screen.findByText(/Cập nhật câu hỏi thành công/)).toBeInTheDocument();
    expect(screen.getByText(/chấm lại 3 câu trả lời trắc nghiệm/)).toBeInTheDocument();
    expect(screen.getByText(/gửi AI chấm lại 1 bài tự luận/)).toBeInTheDocument();
    await waitFor(() => expect(listCalls).toBeGreaterThan(before));
    expect(screen.queryByText('Chỉnh Sửa Câu Hỏi')).not.toBeInTheDocument();
  });

  it('shows the API 400 message inside the edit form and keeps it open', async () => {
    putResponse = () => json({ message: 'Không thể xóa đáp án đã có học sinh chọn.' }, false, 400);
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/ }));
    expect(await screen.findByText('Không thể xóa đáp án đã có học sinh chọn.')).toBeInTheDocument();
    expect(screen.getByText('Chỉnh Sửa Câu Hỏi')).toBeInTheDocument();
  });
});

// Round 8: editing from the bank keeps answer keys of the new formats and the essay rubric.
describe('QuestionManagement edit – round 8 formats', () => {
  const matchingItem = {
    id: 'q-m', content: 'Nối cột', competencyType: 'BehaviorAdjustment', questionFormat: 'Matching',
    questionFormatLabel: 'Ghép nối', difficultyLevel: 'Medium', hasStudentAnswers: false, maxPoints: 1,
    matchingPrompts: ['Cung', 'Cầu'],
    choices: [
      { id: 'b-1', optionLabel: 'A', content: 'Người bán', isCorrect: true, correctSlot: 1 },
      { id: 'b-2', optionLabel: 'B', content: 'Người mua', isCorrect: true, correctSlot: 2 },
      { id: 'b-3', optionLabel: 'C', content: 'Nhà nước', isCorrect: false, correctSlot: null },
    ],
  };
  const essayItem = {
    id: 'q-e', content: 'Tự luận ý', competencyType: 'BehaviorAdjustment', questionFormat: 'Essay',
    questionFormatLabel: 'Tự luận', difficultyLevel: 'Medium', hasStudentAnswers: false, maxPoints: 1.5,
    rubricItems: [{ content: 'Ý một', points: 1 }, { content: 'Ý hai', points: 0.5 }], choices: [],
  };

  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/questions/competency-types') return json([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      if (url.startsWith('/questions/without-exam')) return json([matchingItem, essayItem]);
      if (init?.method === 'PUT') return json({ question: matchingItem });
      return json([]);
    });
  });

  const saveFirstPut = async (index: number) => {
    render(<QuestionManagement />);
    await screen.findAllByText('Nối cột');
    fireEvent.click(screen.getAllByTitle('Chỉnh sửa')[index]);
    expect(await screen.findByText('Chỉnh Sửa Câu Hỏi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/ }));
    await waitFor(() => expect(mockedFetch.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true));
    const [, init] = mockedFetch.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    return JSON.parse(init.body);
  };

  it('matching question opens with its pairs and saves them unchanged', async () => {
    const body = await saveFirstPut(0);
    expect(body.matchingPrompts).toEqual(['Cung', 'Cầu']);
    expect(body.choices.map((c: any) => [c.id, c.correctSlot])).toEqual([['b-1', 1], ['b-2', 2], ['b-3', null]]);
  });

  it('rubric essay opens with its ý list and saves it', async () => {
    const body = await saveFirstPut(1);
    expect(body.rubricItems).toEqual([{ content: 'Ý một', points: 1 }, { content: 'Ý hai', points: 0.5 }]);
  });
});
