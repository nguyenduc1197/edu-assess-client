import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import EssayAnswerList from './EssayAnswerList';
import { fetchClient } from '../../../api/fetchClient';
import { EssayAnswerReview } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));
const mockedFetch = fetchClient as jest.Mock;

const item = (over: Partial<EssayAnswerReview> = {}): EssayAnswerReview => ({
  answerId: 'a1', questionId: 'q1', questionContent: 'Câu tự luận', maxPoints: 2, studentAnswer: 'Bài',
  score: null, gradingStatus: 'AwaitingTeacher', gradingFeedback: null, canRegradeWithAi: true, ...over,
});

const ok = (body: unknown, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
const pendingResult = () => ok({ studentExamId: 'se1', answer: item({ gradingStatus: 'Pending', canRegradeWithAi: false }), score: 2, behaviorAdjustmentScore: 20, selfDevelopmentScore: null, economicSocialParticipationScore: null, pendingEssayCount: 1, awaitingTeacherEssayCount: 0 }, 202);
const assessment = (answer: EssayAnswerReview) => ok({ studentExamId: 'se1', score: 9, behaviorAdjustmentScore: 90, selfDevelopmentScore: null, economicSocialParticipationScore: null, pendingEssayCount: 0, awaitingTeacherEssayCount: 0, essayAnswers: [answer] });

const assessmentCalls = () => mockedFetch.mock.calls.filter(([u]) => String(u) === '/student-exams/se1/assessment').length;

// Round 4, item 4 (FE details): 4 s interval, exact URL, stop when settled, 2-minute cap.
describe('EssayAnswerList async re-grade polling details', () => {
  beforeEach(() => { jest.useFakeTimers(); mockedFetch.mockReset(); });
  afterEach(() => jest.useRealTimers());

  const clickRegrade = async () => {
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" onGraded={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm lại bằng AI' }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  };

  it('polls every 4 s (not before), shows "Đang chấm", hides the regrade button and stops once settled', async () => {
    mockedFetch.mockImplementation((url: string) =>
      url.endsWith('/ai-regrade') ? pendingResult() : assessmentCalls() < 2 ? assessment(item({ gradingStatus: 'Pending' })) : assessment(item({ gradingStatus: 'AiGraded', score: 1.75 })));
    await clickRegrade();
    expect(await screen.findAllByText('Đang chấm')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Chấm lại bằng AI' })).not.toBeInTheDocument();

    await act(async () => { jest.advanceTimersByTime(3900); });
    expect(assessmentCalls()).toBe(0);
    await act(async () => { jest.advanceTimersByTime(200); });
    await waitFor(() => expect(assessmentCalls()).toBe(1));

    await act(async () => { jest.advanceTimersByTime(4000); });
    await act(async () => { jest.advanceTimersByTime(4000); });
    await waitFor(() => expect(screen.getByText('AI đã chấm lại câu tự luận.')).toBeInTheDocument());
    const settledAt = assessmentCalls();
    await act(async () => { jest.advanceTimersByTime(20000); });
    expect(assessmentCalls()).toBe(settledAt);
  });

  it('after 2 minutes still Pending: stops polling with the timeout message', async () => {
    mockedFetch.mockImplementation((url: string) => url.endsWith('/ai-regrade') ? pendingResult() : assessment(item({ gradingStatus: 'Pending' })));
    await clickRegrade();
    for (let i = 0; i < 31; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { jest.advanceTimersByTime(4000); });
    }
    expect(await screen.findByText('AI vẫn đang chấm câu này. Vui lòng tải lại trang sau ít phút.')).toBeInTheDocument();
    const calls = assessmentCalls();
    expect(calls).toBeLessThanOrEqual(30);
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(assessmentCalls()).toBe(calls);
  });

  it('keeps polling through transient errors', async () => {
    let n = 0;
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/ai-regrade')) return pendingResult();
      n++;
      if (n === 1) return Promise.reject(new Error('network'));
      if (n === 2) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      return assessment(item({ gradingStatus: 'AwaitingTeacher' }));
    });
    await clickRegrade();
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { jest.advanceTimersByTime(4000); });
    }
    expect(await screen.findByText('AI vẫn chưa chấm được câu này. Thầy/cô có thể chấm thủ công.')).toBeInTheDocument();
  });
});
