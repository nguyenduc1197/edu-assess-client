import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  {
    id: 'e1',
    content: 'Câu tự luận về pháp luật',
    competencyType: 'SelfDevelopment',
    questionFormat: 'Essay',
    difficultyLevel: 'Medium',
    maxPoints: 2,
    sampleAnswer: null,
    choices: [],
  },
  {
    id: 'm1',
    content: 'Câu trắc nghiệm',
    competencyType: 'SelfDevelopment',
    questionFormat: 'SingleChoice',
    difficultyLevel: 'Easy',
    choices: [
      { id: 'c1', optionLabel: 'A', content: 'Đáp án A' },
      { id: 'c2', optionLabel: 'B', content: 'Đáp án B' },
    ],
  },
];

const assessment = {
  studentExamId: 'se1',
  examId: 'ex1',
  examName: 'Đề',
  studentName: 'HS',
  score: 3.33,
  assessmentStatus: 'Completed',
  behaviorAdjustmentScore: null,
  selfDevelopmentScore: 33.33,
  economicSocialParticipationScore: null,
  overallFeedback: 'Nhận xét chung',
  wrongAnswers: [],
  essayAnswers: [
    {
      answerId: 'a1',
      questionId: 'e1',
      questionContent: 'Câu tự luận về pháp luật',
      maxPoints: 2,
      studentAnswer: 'Bài làm',
      score: null,
      gradingStatus: 'Pending',
      gradingFeedback: null,
    },
  ],
  pendingEssayCount: 1,
  awaitingTeacherEssayCount: 0,
  completedExamCount: 1,
  behaviorAdjustmentAccumulation: null,
  selfDevelopmentAccumulation: null,
  economicSocialParticipationAccumulation: null,
  assessmentError: null,
  finishedAt: new Date().toISOString(),
  assessedAt: null,
};

const assignment: Assignment = {
  id: 'ex1',
  title: 'Đề kiểm tra',
  subject: 'GDKTPL' as any,
  deadline: '',
  deadlineDisplay: '',
  status: AssignmentStatus.NEW,
  durationMinutes: 45,
  antiCheatEnabled: false,
};

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

const routeFetch = () => {
  mockedFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith('/questions')) return ok(questions);
    if (url.endsWith('/save-draft')) return Promise.resolve({ ok: true, status: 204, json: async () => null });
    if (url.endsWith('/submit')) return ok({ studentExamId: 'se1', assessmentStatus: 'Pending', score: 0 });
    if (url.includes('/assessment')) return ok(assessment);
    return ok({});
  });
};

// Requirement 9: draft/submit payloads include essayAnswer; result shows essay states
describe('ExamSession essay flow', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    routeFetch();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('submit payload includes trimmed essayAnswer and result shows "Đang chấm"', async () => {
    render(<ExamSession assignment={assignment} examId="ex1" onExit={jest.fn()} />);
    const textarea = await screen.findByLabelText('Bài làm của em');
    fireEvent.change(textarea, { target: { value: '   Pháp luật là công cụ quản lý xã hội   ' } });

    fireEvent.click(screen.getByRole('button', { name: /Review & Nộp bài/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Nộp Bài/ }));

    await waitFor(() => expect(mockedFetch.mock.calls.some(([u]) => String(u).endsWith('/submit'))).toBe(true));
    const [, init] = mockedFetch.mock.calls.find(([u]) => String(u).endsWith('/submit'))!;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.answers).toEqual([{ questionId: 'e1', choiceId: null, essayAnswer: 'Pháp luật là công cụ quản lý xã hội' }]);

    expect(await screen.findByText(/Câu tự luận đang chấm/)).toBeInTheDocument();
    expect(screen.getAllByText('Đang chấm').length).toBeGreaterThanOrEqual(1);
  });

  it('auto-saved draft payload includes essayAnswer', async () => {
    jest.useFakeTimers();
    render(<ExamSession assignment={assignment} examId="ex1" onExit={jest.fn()} />);
    const textarea = await screen.findByLabelText('Bài làm của em');
    fireEvent.change(textarea, { target: { value: 'Bản nháp tự luận' } });

    await act(async () => {
      jest.advanceTimersByTime(31000);
    });

    await waitFor(() => expect(mockedFetch.mock.calls.some(([u]) => String(u).endsWith('/save-draft'))).toBe(true));
    const [, init] = mockedFetch.mock.calls.find(([u]) => String(u).endsWith('/save-draft'))!;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).answers).toContainEqual({ questionId: 'e1', choiceId: null, essayAnswer: 'Bản nháp tự luận' });
  });
});
