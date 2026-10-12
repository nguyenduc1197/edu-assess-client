import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExamSession from './ExamSession';
import { fetchClient } from '../../../api/fetchClient';
import { Assignment, AssignmentStatus } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));

jest.mock('./useAntiCheatMonitoring', () => ({
  useAntiCheatMonitoring: () => ({
    recentEvents: [],
    totalEventCount: 0,
    syncErrorCount: 0,
    isMonitoring: false,
    flushPendingEvents: jest.fn().mockResolvedValue(undefined),
    waitForPendingSends: jest.fn().mockResolvedValue(undefined),
  }),
}));

const mockedFetch = fetchClient as jest.Mock;

const questions = [
  { id: 'm1', content: 'Câu trắc nghiệm', questionFormat: 'SingleChoice', choices: [
    { id: 'c1', optionLabel: 'A', content: 'Đáp án A' },
    { id: 'c2', optionLabel: 'B', content: 'Đáp án B' },
  ] },
  { id: 'e1', content: 'Câu tự luận', questionFormat: 'Essay', maxPoints: 2, choices: [] },
];

const assignment: Assignment = {
  id: 'ex1',
  title: 'Đề kiểm tra',
  subject: 'GDKTPL' as any,
  deadline: '',
  deadlineDisplay: '',
  status: AssignmentStatus.IN_PROGRESS,
  durationMinutes: 45,
  antiCheatEnabled: false,
};

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

// Round 4: reopening / reloading an in-progress attempt restores saved draft answers from the server.
describe('ExamSession draft restore', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/questions')) return ok(questions);
      if (url === '/exams/ex1/draft') {
        return ok({
          studentExamId: 'se1',
          answers: [
            { questionId: 'm1', choiceId: 'c2', essayAnswer: null },
            { questionId: 'e1', choiceId: null, essayAnswer: 'Bài làm đã lưu' },
          ],
        });
      }
      return ok({});
    });
  });

  it('restores the selected choice and essay text', async () => {
    render(<ExamSession assignment={assignment} examId="ex1" onExit={jest.fn()} />);

    const choiceB = await screen.findByRole('radio', { name: /Đáp án B/ });
    await waitFor(() => expect(choiceB).toBeChecked());
    expect(screen.getByRole('radio', { name: /Đáp án A/ })).not.toBeChecked();
    expect(mockedFetch.mock.calls.some(([u]) => u === '/exams/ex1/draft')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }));
    expect(await screen.findByLabelText('Bài làm của em')).toHaveValue('Bài làm đã lưu');
  });

  it('starts empty when there is no draft (404)', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/questions')) return ok(questions);
      if (url === '/exams/ex1/draft') return Promise.resolve({ ok: false, status: 404, json: async () => null });
      return ok({});
    });
    render(<ExamSession assignment={assignment} examId="ex1" onExit={jest.fn()} />);
    const choiceA = await screen.findByRole('radio', { name: /Đáp án A/ });
    expect(choiceA).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Đáp án B/ })).not.toBeChecked();
  });
});
