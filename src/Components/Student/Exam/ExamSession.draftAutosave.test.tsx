import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import ExamSession from './ExamSession';
import { fetchClient } from '../../../api/fetchClient';
import { Assignment, AssignmentStatus } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
jest.mock('./useAntiCheatMonitoring', () => ({
  useAntiCheatMonitoring: () => ({
    recentEvents: [], totalEventCount: 0, syncErrorCount: 0, isMonitoring: false,
    flushPendingEvents: jest.fn().mockResolvedValue(undefined), waitForPendingSends: jest.fn().mockResolvedValue(undefined),
  }),
}));
const mockedFetch = fetchClient as jest.Mock;

const questions = [
  { id: 'm1', content: 'Câu trắc nghiệm', questionFormat: 'SingleChoice', choices: [
    { id: 'c1', optionLabel: 'A', content: 'Đáp án A' }, { id: 'c2', optionLabel: 'B', content: 'Đáp án B' } ] },
  { id: 'e1', content: 'Câu tự luận', questionFormat: 'Essay', maxPoints: 2, choices: [] },
  { id: 'gone', content: 'x', questionFormat: 'SingleChoice', choices: [{ id: 'g1', optionLabel: 'A', content: 'g' }] },
];

const assignment: Assignment = {
  id: 'ex1', title: 'Đề', subject: 'GDKTPL' as any, deadline: '', deadlineDisplay: '',
  status: AssignmentStatus.IN_PROGRESS, durationMinutes: 45, antiCheatEnabled: false,
};

const ok = (body: unknown, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });

// Round 4, item 3: restored draft must survive the next auto-save (otherwise reload would wipe the saved draft),
// and invalid draft entries (unknown question / stale choice) are ignored.
describe('ExamSession draft restore + auto-save', () => {
  afterEach(() => jest.useRealTimers());

  it('first auto-save after reload re-sends the restored answers', async () => {
    jest.useFakeTimers();
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/questions')) return ok(questions);
      if (url === '/exams/ex1/draft') return ok({ studentExamId: 'se1', answers: [
        { questionId: 'm1', choiceId: 'c2', essayAnswer: null },
        { questionId: 'e1', choiceId: null, essayAnswer: 'Bài làm đã lưu' },
        { questionId: 'unknown', choiceId: 'zz', essayAnswer: null },
        { questionId: 'gone', choiceId: 'stale-choice', essayAnswer: null },
      ] });
      if (url.endsWith('/save-draft')) return ok(null, 204);
      return ok({});
    });
    render(<ExamSession assignment={assignment} examId="ex1" onExit={jest.fn()} />);
    const b = await screen.findByRole('radio', { name: /Đáp án B/ });
    await waitFor(() => expect(b).toBeChecked());

    await act(async () => { jest.advanceTimersByTime(31000); });
    await waitFor(() => expect(mockedFetch.mock.calls.some(([u]) => String(u).endsWith('/save-draft'))).toBe(true));
    const [, init] = mockedFetch.mock.calls.find(([u]) => String(u).endsWith('/save-draft'))!;
    const answers = JSON.parse(init.body).answers;
    expect(answers).toEqual(expect.arrayContaining([
      { questionId: 'm1', choiceId: 'c2', essayAnswer: null },
      { questionId: 'e1', choiceId: null, essayAnswer: 'Bài làm đã lưu' },
    ]));
    expect(answers.find((a: any) => a.questionId === 'unknown' || a.questionId === 'gone')).toBeUndefined();
  });

  it('draft endpoint 400 (already submitted) is ignored and the exam still loads', async () => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/questions')) return ok(questions);
      if (url === '/exams/ex1/draft') return Promise.resolve({ ok: false, status: 400, json: async () => ({ message: 'Bài làm đã được nộp.' }) });
      return ok({});
    });
    render(<ExamSession assignment={assignment} examId="ex1" onExit={jest.fn()} />);
    expect(await screen.findByRole('radio', { name: /Đáp án A/ })).not.toBeChecked();
  });
});
