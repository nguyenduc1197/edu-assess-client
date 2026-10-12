import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import EssayAnswerList, { ESSAY_REGRADE_POLL_INTERVAL_MS, ESSAY_REGRADE_POLL_MAX_MS, regradeOutcomeMessage } from './EssayAnswerList';
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

// Round 5 (A1): final message must match the final status, e.g. a teacher grade during polling.
describe('EssayAnswerList re-grade outcome messages', () => {

  it.each([
    ['AiGraded', 'AI đã chấm lại câu tự luận.'],
    ['AwaitingTeacher', 'AI vẫn chưa chấm được câu này. Thầy/cô có thể chấm thủ công.'],
    ['TeacherGraded', 'Câu này đã được giáo viên chấm điểm.'],
  ])('%s -> %s', (status, message) => {
    expect(regradeOutcomeMessage(status)).toBe(message);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockedFetch.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('poll finding a teacher grade does not claim the AI graded it', async () => {
    mockedFetch.mockImplementation((url: string) =>
      url.endsWith('/ai-regrade') ? accepted() : assessmentWith(item({ gradingStatus: 'TeacherGraded', score: 1, canRegradeWithAi: false })));
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" onGraded={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm lại bằng AI' }));
    await waitFor(() => expect(screen.getByText('Đang chấm')).toBeInTheDocument());
    await act(async () => { jest.advanceTimersByTime(ESSAY_REGRADE_POLL_INTERVAL_MS); });
    expect(await screen.findByText('Câu này đã được giáo viên chấm điểm.')).toBeInTheDocument();
    expect(screen.queryByText('AI đã chấm lại câu tự luận.')).not.toBeInTheDocument();
  });

  it('manual grade while polling stops polling and keeps the teacher message', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/ai-regrade')) return accepted();
      if (url.endsWith('/grade')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({
          studentExamId: 'se1', answer: item({ gradingStatus: 'TeacherGraded', score: 1, canRegradeWithAi: false }),
          score: 5, behaviorAdjustmentScore: 50, selfDevelopmentScore: null, economicSocialParticipationScore: null,
          pendingEssayCount: 0, awaitingTeacherEssayCount: 0 }) });
      }
      return assessmentWith(item({ gradingStatus: 'TeacherGraded', score: 1, canRegradeWithAi: false }));
    });
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" onGraded={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm lại bằng AI' }));
    await waitFor(() => expect(screen.getByText('Đang chấm')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Chấm điểm' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm' }));
    expect(await screen.findByText('Đã lưu điểm và cập nhật lại tổng điểm bài làm.')).toBeInTheDocument();

    const calls = mockedFetch.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(ESSAY_REGRADE_POLL_INTERVAL_MS * 3); });
    expect(mockedFetch.mock.calls.length).toBe(calls);
    expect(screen.queryByText('AI đã chấm lại câu tự luận.')).not.toBeInTheDocument();
  });
});
