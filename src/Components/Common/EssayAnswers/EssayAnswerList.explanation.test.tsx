import React from 'react';
import { render, screen } from '@testing-library/react';
import EssayAnswerList from './EssayAnswerList';
import { EssayAnswerReview } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));

const essay = (id: string, content: string, score: number, explanation: string | null): EssayAnswerReview => ({
  answerId: `a-${id}`,
  questionId: id,
  questionContent: content,
  maxPoints: 1,
  studentAnswer: 'bài làm',
  score,
  gradingStatus: 'AiGraded',
  gradingFeedback: null,
  passageText: 'Tình huống công ty may A',
  passageGroupKey: 'scan-e1',
  explanation,
});

// Round 12: short answers (Công cụ 4) – the explanation of Câu 1 is shared by its ý 1a, 1b: shown once.
describe('EssayAnswerList explanation', () => {
  it('shows each explanation once, after the last ý that carries it', () => {
    render(
      <EssayAnswerList
        mode="student"
        items={[
          essay('1a', 'Viết tên người thất nghiệp', 0.5, 'Giải thích câu 1'),
          essay('1b', 'Loại thất nghiệp', 0.25, 'Giải thích câu 1'),
          essay('2a', 'Nguyên nhân', 1, null),
          essay('4a', 'Đồng tình với anh K?', 0, 'Giải thích 4a'),
        ]}
      />
    );
    const blocks = screen.getAllByTestId('essay-explanation');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toHaveTextContent('Giải thích câu 1');
    expect(blocks[1]).toHaveTextContent('Giải thích 4a');
    expect(screen.getAllByText('Tình huống công ty may A')).toHaveLength(1);
  });
});
