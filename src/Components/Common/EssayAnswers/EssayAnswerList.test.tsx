import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EssayAnswerList from './EssayAnswerList';
import { fetchClient } from '../../../api/fetchClient';
import { EssayAnswerReview, EssayGradeResult } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));
const mockedFetch = fetchClient as jest.Mock;

const item = (over: Partial<EssayAnswerReview> = {}): EssayAnswerReview => ({
  answerId: 'a1',
  questionId: 'q1',
  questionContent: 'Nêu vai trò của pháp luật',
  maxPoints: 2,
  studentAnswer: 'Pháp luật giúp quản lý xã hội',
  score: 1.5,
  gradingStatus: 'AiGraded',
  gradingFeedback: 'Em nêu đúng ý chính.',
  sampleAnswer: 'ĐÁP ÁN MẪU BÍ MẬT',
  canRegradeWithAi: false,
  ...over,
});

const gradeResult = (answer: EssayAnswerReview): EssayGradeResult => ({
  studentExamId: 'se1',
  answer,
  score: 7.5,
  behaviorAdjustmentScore: 75,
  selfDevelopmentScore: null,
  economicSocialParticipationScore: null,
  pendingEssayCount: 0,
  awaitingTeacherEssayCount: 0,
});

// Requirement 9: result views show essay score/max/comment + grading states; teacher edit + AI regrade
describe('EssayAnswerList student mode', () => {
  it('shows score / max and AI comment, never the sample answer', () => {
    render(<EssayAnswerList items={[item()]} mode="student" />);
    expect(screen.getByText('1.5 / 2 điểm')).toBeInTheDocument();
    expect(screen.getByText('Em nêu đúng ý chính.')).toBeInTheDocument();
    expect(screen.getByText('Nhận xét của AI')).toBeInTheDocument();
    expect(screen.getByText('Điểm tối đa: 2')).toBeInTheDocument();
    expect(screen.queryByText('ĐÁP ÁN MẪU BÍ MẬT')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows "Đang chấm" for pending', () => {
    render(<EssayAnswerList items={[item({ gradingStatus: 'Pending', score: null, gradingFeedback: null })]} mode="student" />);
    expect(screen.getAllByText('Đang chấm').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Chờ giáo viên chấm" and the provisional-zero hint for awaiting teacher', () => {
    render(<EssayAnswerList items={[item({ gradingStatus: 'AwaitingTeacher', score: null, gradingFeedback: null })]} mode="student" />);
    expect(screen.getAllByText('Chờ giáo viên chấm').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/điểm tạm thời được tính là 0/)).toBeInTheDocument();
  });

  it('teacher comment is labelled as such; no-answer shows placeholder', () => {
    render(
      <EssayAnswerList
        items={[
          item({ gradingStatus: 'TeacherGraded', gradingFeedback: 'GV nhận xét' }),
          item({ answerId: 'a2', gradingStatus: 'NoAnswer', score: 0, studentAnswer: null, gradingFeedback: null }),
        ]}
        mode="student"
      />
    );
    expect(screen.getByText('Nhận xét của giáo viên')).toBeInTheDocument();
    expect(screen.getByText('Không có câu trả lời')).toBeInTheDocument();
    expect(screen.getByText('0 / 2 điểm')).toBeInTheDocument();
  });

  it('renders nothing for empty list', () => {
    const { container } = render(<EssayAnswerList items={[]} mode="student" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EssayAnswerList teacher mode', () => {
  beforeEach(() => mockedFetch.mockReset());

  it('shows sample answer and edit button; no AI regrade unless awaiting teacher', () => {
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" />);
    expect(screen.getByText('ĐÁP ÁN MẪU BÍ MẬT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa điểm' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chấm lại bằng AI' })).not.toBeInTheDocument();
  });

  it('validates the score client-side before calling the API', async () => {
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa điểm' }));
    fireEvent.change(screen.getByLabelText(/Điểm \(0 - 2\)/), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm' }));
    expect(await screen.findByText('Điểm phải nằm trong khoảng 0 đến 2.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Điểm \(0 - 2\)/), { target: { value: '1.333' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm' }));
    expect(await screen.findByText('Điểm chỉ được có tối đa 2 chữ số thập phân.')).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('PUTs {score, feedback} to the grade endpoint and reports result', async () => {
    const updated = item({ score: 2, gradingStatus: 'TeacherGraded', gradingFeedback: 'Tốt', isTeacherGraded: true });
    mockedFetch.mockResolvedValue({ ok: true, json: async () => gradeResult(updated) });
    const onGraded = jest.fn();
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" onGraded={onGraded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa điểm' }));
    fireEvent.change(screen.getByLabelText(/Điểm \(0 - 2\)/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Nhận xét cho học sinh'), { target: { value: '  Tốt  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm' }));

    await waitFor(() => expect(onGraded).toHaveBeenCalledTimes(1));
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/student-exams/se1/essay-answers/a1/grade');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ score: 2, feedback: 'Tốt' });
    expect(onGraded.mock.calls[0][0].score).toBe(7.5);
  });

  it('sends feedback null when blank and accepts comma decimals', async () => {
    mockedFetch.mockResolvedValue({ ok: true, json: async () => gradeResult(item({ score: 1.25 })) });
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa điểm' }));
    fireEvent.change(screen.getByLabelText(/Điểm \(0 - 2\)/), { target: { value: '1.25' } });
    fireEvent.change(screen.getByLabelText('Nhận xét cho học sinh'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm' }));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(JSON.parse(mockedFetch.mock.calls[0][1].body)).toEqual({ score: 1.25, feedback: null });
  });

  it('shows backend 400 message', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'Bài làm chưa được nộp nên chưa thể chấm.' }) });
    render(<EssayAnswerList items={[item()]} mode="teacher" studentExamId="se1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa điểm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm' }));
    expect(await screen.findByText('Bài làm chưa được nộp nên chưa thể chấm.')).toBeInTheDocument();
  });

  it('awaiting teacher: "Chấm điểm" + "Chấm lại bằng AI" POSTs to ai-regrade', async () => {
    const stillAwaiting = item({ gradingStatus: 'AwaitingTeacher', score: null, canRegradeWithAi: true });
    mockedFetch.mockResolvedValue({ ok: true, json: async () => gradeResult(stillAwaiting) });
    const onGraded = jest.fn();
    render(<EssayAnswerList items={[stillAwaiting]} mode="teacher" studentExamId="se1" onGraded={onGraded} />);
    expect(screen.getByRole('button', { name: 'Chấm điểm' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chấm lại bằng AI' }));
    await waitFor(() => expect(onGraded).toHaveBeenCalled());
    expect(mockedFetch.mock.calls[0][0]).toBe('/student-exams/se1/essay-answers/a1/ai-regrade');
    expect(mockedFetch.mock.calls[0][1].method).toBe('POST');
    expect(await screen.findByText(/AI vẫn chưa chấm được câu này/)).toBeInTheDocument();
  });

  it('AI regrade success message', async () => {
    const awaiting = item({ gradingStatus: 'AwaitingTeacher', score: null, canRegradeWithAi: true });
    mockedFetch.mockResolvedValue({ ok: true, json: async () => gradeResult(item({ gradingStatus: 'AiGraded', score: 1 })) });
    render(<EssayAnswerList items={[awaiting]} mode="teacher" studentExamId="se1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm lại bằng AI' }));
    expect(await screen.findByText('AI đã chấm lại câu tự luận.')).toBeInTheDocument();
  });
});
