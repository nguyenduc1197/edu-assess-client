import React from 'react';
import { render, screen } from '@testing-library/react';
import StructuredAnswerReviewList from './StructuredAnswerReviewList';
import EssayAnswerList from '../EssayAnswers/EssayAnswerList';
import { EssayAnswerReview, StructuredAnswerReview } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));

// Round 8: results of fill-in-the-blank / matching, rubric points per ý (teachers only), shared situation once.
const fill: StructuredAnswerReview = {
  questionId: 'f1',
  questionFormat: 'FillInBlank',
  questionContent: 'Giá tăng thì [[1]] giảm, [[2]] tăng.',
  score: 0.5,
  correctCount: 1,
  slotCount: 2,
  slots: [
    { slot: 1, selectedText: 'lượng cầu', correctText: 'lượng cầu', isCorrect: true },
    { slot: 2, selectedText: null, correctText: 'lượng cung', isCorrect: false },
  ],
};

const match: StructuredAnswerReview = {
  questionId: 'm1',
  questionFormat: 'Matching',
  questionContent: 'Nối cột A với cột B',
  score: 1,
  correctCount: 2,
  slotCount: 2,
  slots: [
    { slot: 1, prompt: 'Cung', selectedText: 'Người bán', correctText: 'Người bán', isCorrect: true },
    { slot: 2, prompt: 'Cầu', selectedText: 'Người mua', correctText: 'Người mua', isCorrect: true },
  ],
};

const essay = (overrides: Partial<EssayAnswerReview>): EssayAnswerReview => ({
  answerId: 'a1',
  questionId: 'q1',
  questionContent: 'Câu a',
  maxPoints: 1.5,
  studentAnswer: 'Bài làm',
  score: 1,
  gradingStatus: 'AiGraded',
  ...overrides,
});

describe('StructuredAnswerReviewList', () => {
  it('shows per-slot results, score fraction and correct answers for wrong slots', () => {
    render(<StructuredAnswerReviewList items={[fill, match]} />);
    expect(screen.getByText('Đúng 1/2 · 0.5 câu')).toBeInTheDocument();
    expect(screen.getByText('Đúng 2/2 · 1 câu')).toBeInTheDocument();
    expect(screen.queryByText(/\[\[/)).not.toBeInTheDocument();
    expect(screen.getByText(/đáp án: lượng cung/)).toBeInTheDocument();
    expect(screen.getByText('bỏ trống')).toBeInTheDocument();
    expect(screen.getByText('1. Cung:')).toBeInTheDocument();
  });

  it('renders nothing without items', () => {
    const { container } = render(<StructuredAnswerReviewList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EssayAnswerList – rubric and situation', () => {
  const rubricEssay = essay({
    rubricItems: [{ content: 'Nêu khái niệm', points: 1 }, { content: 'Lấy ví dụ', points: 0.5 }],
    rubricResults: [
      { order: 1, points: 0.75, maxPoints: 1, comment: 'Thiếu một ý nhỏ' },
      { order: 2, points: 0.25, maxPoints: 0.5 },
    ],
  });

  it('teachers see each ý with AI points and comment', () => {
    render(<EssayAnswerList items={[rubricEssay]} mode="teacher" />);
    expect(screen.getByTestId('essay-rubric')).toBeInTheDocument();
    expect(screen.getByText('0.75 / 1 điểm')).toBeInTheDocument();
    expect(screen.getByText('0.25 / 0.5 điểm')).toBeInTheDocument();
    expect(screen.getByText('Thiếu một ý nhỏ')).toBeInTheDocument();
  });

  it('students never see the rubric', () => {
    render(<EssayAnswerList items={[rubricEssay]} mode="student" />);
    expect(screen.queryByTestId('essay-rubric')).not.toBeInTheDocument();
    expect(screen.queryByText('Nêu khái niệm')).not.toBeInTheDocument();
  });

  it('a shared situation is shown once above its group', () => {
    render(
      <EssayAnswerList
        mode="student"
        items={[
          essay({ answerId: 'a1', passageText: 'Tình huống chung', passageGroupKey: 'g1' }),
          essay({ answerId: 'a2', questionContent: 'Câu b', passageText: 'Tình huống chung', passageGroupKey: 'g1' }),
          essay({ answerId: 'a3', questionContent: 'Câu riêng' }),
        ]}
      />
    );
    expect(screen.getAllByText('Tình huống chung')).toHaveLength(1);
  });
});
