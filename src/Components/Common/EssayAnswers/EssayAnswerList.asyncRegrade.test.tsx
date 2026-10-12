import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import EssayAnswerList, { ESSAY_REGRADE_POLL_INTERVAL_MS, ESSAY_REGRADE_POLL_MAX_MS } from './EssayAnswerList';
import { fetchClient } from '../../../api/fetchClient';
import { EssayAnswerReview } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));
const mockedFetch = fetchClient as jest.Mock;

const item = (over: Partial<EssayAnswerReview> = {}): EssayAnswerReview => ({
  answerId: 'a1',
  questionId: 'q1',
  questionContent: 'Câu tự luận',
  maxPoints: 2,
  studentAnswer: 'Bài làm',
  score: null,
  gradingStatus: 'AwaitingTeacher',
  gradingFeedback: null,
  canRegradeWithAi: true,
  ...over,
});

const accepted = () => Promise.resolve({
  ok: true,
  status: 202,
  json: async () => ({
    studentExamId: 'se1',
    answer: item({ gradingStatus: 'Pending', canRegradeWithAi: false }),
    score: 2,
    behaviorAdjustmentScore: 20,
    selfDevelopmentScore: null,
    economicSocialParticipationScore: null,
    pendingEssayCount: 1,
    awaitingTeacherEssayCount: 0,
  }),
});

const assessmentWith = (answer: EssayAnswerReview) => Promise.resolve({
  ok: true,
  status: 200,
  json: async () => ({
    studentExamId: 'se1',
    score: 7,
    behaviorAdjustmentScore: 70,
    selfDevelopmentScore: null,
    economicSocialParticipationScore: null,
    pendingEssayCount: answer.gradingStatus === 'Pending' ? 1 : 0,
    awaitingTeacherEssayCount: 0,
    essayAnswers: [answer],
  }),
});

// Round 4: "Chấm lại bằng AI" returns 202 (Pending) and the card polls until the answer leaves Pending.
describe('EssayAnswerList asynchronous AI re-grade', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows "Đang chấm", polls the assessment and reports the AI grade', async () => {
    let pollCount = 0;
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/ai-regrade')) return accepted();
      pollCount++;
      return assessmentWith(pollCount < 2
        ? item({ gradingStatus: 'Pending', canRegradeWithAi: false })
        : item({ gradingStatus: 'AiGraded', score: 1.5, gradingFeedback: 'Tốt', canRegradeWithAi: false }));
    });
    const onGraded = jest.fn();
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" onGraded={onGraded} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chấm lại bằng AI' }));
    await waitFor(() => expect(onGraded).toHaveBeenCalledTimes(1));
    expect(onGraded.mock.calls[0][0].answer.gradingStatus).toBe('Pending');
    expect(screen.getByText('Đang chấm')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chấm lại bằng AI' })).not.toBeInTheDocument();

    await act(async () => { jest.advanceTimersByTime(ESSAY_REGRADE_POLL_INTERVAL_MS); });
    expect(onGraded).toHaveBeenCalledTimes(1); // still pending

    await act(async () => { jest.advanceTimersByTime(ESSAY_REGRADE_POLL_INTERVAL_MS); });
    await waitFor(() => expect(onGraded).toHaveBeenCalledTimes(2));
    const last = onGraded.mock.calls[1][0];
    expect(last.answer.gradingStatus).toBe('AiGraded');
    expect(last.score).toBe(7);
    expect(mockedFetch.mock.calls.some(([u]) => u === '/student-exams/se1/assessment')).toBe(true);
    expect(await screen.findByText('AI đã chấm lại câu tự luận.')).toBeInTheDocument();
  });

  it('reports failure when the answer goes back to awaiting teacher', async () => {
    mockedFetch.mockImplementation((url: string) =>
      url.endsWith('/ai-regrade') ? accepted() : assessmentWith(item({ gradingStatus: 'AwaitingTeacher' })));
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" onGraded={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm lại bằng AI' }));
    await waitFor(() => expect(screen.getByText('Đang chấm')).toBeInTheDocument());
    await act(async () => { jest.advanceTimersByTime(ESSAY_REGRADE_POLL_INTERVAL_MS); });
    expect(await screen.findByText(/AI vẫn chưa chấm được câu này/)).toBeInTheDocument();
  });

  it('stops polling after the cap', async () => {
    mockedFetch.mockImplementation((url: string) =>
      url.endsWith('/ai-regrade') ? accepted() : assessmentWith(item({ gradingStatus: 'Pending', canRegradeWithAi: false })));
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" onGraded={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm lại bằng AI' }));
    await waitFor(() => expect(screen.getByText('Đang chấm')).toBeInTheDocument());

    await act(async () => { jest.advanceTimersByTime(ESSAY_REGRADE_POLL_MAX_MS + ESSAY_REGRADE_POLL_INTERVAL_MS); });
    expect(await screen.findByText(/AI vẫn đang chấm câu này/)).toBeInTheDocument();
    const callsAfterCap = mockedFetch.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(ESSAY_REGRADE_POLL_INTERVAL_MS * 3); });
    expect(mockedFetch.mock.calls.length).toBe(callsAfterCap);
  });
});
