import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExamSession from './ExamSession';
import { fetchClient } from '../../../api/fetchClient';
import { Assignment, AssignmentStatus } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
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
    id: 'm1',
    content: 'Câu trắc nghiệm',
    competencyType: 'EconomicSocialParticipation',
    questionFormat: 'SingleChoice',
    difficultyLevel: 'Easy',
    choices: [
      { id: 'c1', optionLabel: 'A', content: 'Đáp án A' },
      { id: 'c2', optionLabel: 'B', content: 'Đáp án B' },
    ],
  },
];

// The API returns an accumulation object for every competency, with null scores when the exam has no
// question of that competency (Bài 1–4 have no NL II, Bài 2 has no NL I). This used to crash the page.
const emptyAccumulation = { previousScore: null, latestScore: null, averageScore: null, bestScore: null, gainVsPreviousAttempt: null };
const assessment = {
  studentExamId: 'se1',
  examId: 'ex1',
  examName: 'Bài 2',
  studentName: 'HS',
  score: 10,
  assessmentStatus: 'Completed',
  behaviorAdjustmentScore: null,
  selfDevelopmentScore: null,
  economicSocialParticipationScore: 100,
  overallFeedback: 'Em làm tốt bài này',
  wrongAnswers: [],
  essayAnswers: [],
  completedExamCount: 1,
  behaviorAdjustmentAccumulation: emptyAccumulation,
  selfDevelopmentAccumulation: emptyAccumulation,
  economicSocialParticipationAccumulation: { previousScore: null, latestScore: 100, averageScore: 100, bestScore: 100, gainVsPreviousAttempt: null },
  competencyComments: [],
  assessmentError: null,
  finishedAt: new Date().toISOString(),
  assessedAt: new Date().toISOString(),
};

const assignment: Assignment = {
  id: 'ex1',
  title: 'Bài 2',
  subject: 'GDKTPL' as any,
  deadline: '',
  deadlineDisplay: '',
  status: AssignmentStatus.NEW,
  durationMinutes: 45,
  antiCheatEnabled: false,
};

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

describe('ExamSession result with competencies missing from the exam', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/questions')) return ok(questions);
      if (url.endsWith('/save-draft')) return Promise.resolve({ ok: true, status: 204, json: async () => null });
      if (url.endsWith('/submit')) return ok({ studentExamId: 'se1', assessmentStatus: 'Completed', score: 10 });
      if (url.includes('/assessment')) return ok(assessment);
      return ok({});
    });
  });

  it('renders the result without crashing and only shows the competency that has data', async () => {
    render(<ExamSession assignment={assignment} examId="ex1" onExit={jest.fn()} />);
    fireEvent.click(await screen.findByText('Đáp án A'));
    fireEvent.click(screen.getByRole('button', { name: /Review & Nộp bài/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Nộp Bài/ }));

    expect(await screen.findByText('Em làm tốt bài này')).toBeInTheDocument();
    expect(screen.queryByText('Năng lực điều chỉnh hành vi')).not.toBeInTheDocument();
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });
});
