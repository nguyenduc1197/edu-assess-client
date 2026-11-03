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
];

const ok = (body: unknown, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
const submitCalls = () => mockedFetch.mock.calls.filter(([u]) => String(u) === '/exams/ex1/submit');

const renderWithDeadline = (deadlineMs: number) => {
  const assignment: Assignment = {
    id: 'ex1', title: 'Đề', subject: 'GDKTPL' as any, deadline: '', deadlineDisplay: '',
    status: AssignmentStatus.IN_PROGRESS, durationMinutes: 45, antiCheatEnabled: false,
    startedAt: new Date(deadlineMs - 45 * 60 * 1000).toISOString(),
    attemptDeadlineUtc: new Date(deadlineMs).toISOString(),
  } as Assignment;
  mockedFetch.mockReset();
  mockedFetch.mockImplementation((url: string) => {
    if (url.startsWith('/questions')) return ok(questions);
    if (url === '/exams/ex1/draft') return ok({ studentExamId: 'se1', answers: [{ questionId: 'm1', choiceId: 'c2', essayAnswer: null }] });
    if (url === '/exams/ex1/submit') return ok({ studentExamId: 'se1', assessmentStatus: 'Pending' });
    return ok({});
  });
  return render(<ExamSession assignment={assignment} examId="ex1" onExit={jest.fn()} />);
};

describe('ExamSession auto-submit when time is up', () => {
  afterEach(() => jest.useRealTimers());

  it('submits the current answers once when the countdown reaches 0', async () => {
    jest.useFakeTimers();
    renderWithDeadline(Date.now() + 5000);
    await waitFor(() => expect(screen.getByRole('radio', { name: /Đáp án B/ })).toBeChecked());
    expect(submitCalls()).toHaveLength(0);

    await act(async () => { jest.advanceTimersByTime(6000); });
    await waitFor(() => expect(submitCalls()).toHaveLength(1));
    expect(JSON.parse(submitCalls()[0][1].body).answers).toEqual([{ questionId: 'm1', choiceId: 'c2', essayAnswer: null }]);

    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(submitCalls()).toHaveLength(1);
  });

  it('leaves long-expired attempts to the server sweep', async () => {
    jest.useFakeTimers();
    renderWithDeadline(Date.now() - 10 * 60 * 1000);
    await screen.findByRole('radio', { name: /Đáp án B/ });

    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(submitCalls()).toHaveLength(0);
  });
});
