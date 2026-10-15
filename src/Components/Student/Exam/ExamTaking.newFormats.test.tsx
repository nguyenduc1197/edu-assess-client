import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExamTaking from './ExamTaking';
import { Question } from '../../../types';

// Round 8 (D/F): fill-in-the-blank in the exam screen; essays sharing a situation show it once.
const fill: Question = {
  id: 'f1',
  content: 'Giá tăng thì [[1]] giảm.',
  questionFormat: 'FillInBlank',
  choices: [
    { id: 'w1', optionLabel: 'A', content: 'lượng cầu' },
    { id: 'w2', optionLabel: 'B', content: 'lạm phát' },
  ],
};

const essayA: Question = {
  id: 'ea', content: 'Câu a: nhận xét hành vi của anh A', questionFormat: 'Essay', maxPoints: 1,
  passageText: 'Anh A mở cửa hàng tạp hoá.', passageGroupKey: 'essay-1', choices: [],
};
const essayB: Question = {
  id: 'eb', content: 'Câu b: nếu là anh A em sẽ làm gì', questionFormat: 'Essay', maxPoints: 2,
  passageText: 'Anh A mở cửa hàng tạp hoá.', passageGroupKey: 'essay-1', choices: [],
};

const renderTaking = (questions: Question[], props: Partial<React.ComponentProps<typeof ExamTaking>> = {}) =>
  render(
    <ExamTaking
      examTitle="Đề"
      questions={questions}
      answers={{}}
      onAnswer={jest.fn()}
      onEssayAnswer={jest.fn()}
      onSlotAnswer={jest.fn()}
      onReview={jest.fn()}
      onExit={jest.fn()}
      {...props}
    />
  );

describe('ExamTaking – round 8 formats', () => {
  it('fill-in-the-blank: instruction heading, no raw markers, tap answers reported', () => {
    const onSlotAnswer = jest.fn();
    renderTaking([fill], { onSlotAnswer });
    expect(screen.getByText('Điền từ thích hợp vào chỗ trống')).toBeInTheDocument();
    expect(screen.queryByText(/\[\[1\]\]/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'lượng cầu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chỗ trống 1: trống' }));
    expect(onSlotAnswer).toHaveBeenCalledWith('f1', [{ slot: 1, choiceId: 'w1' }]);
  });

  it('essays sharing a situation: the situation is shown once with one textarea per question', () => {
    const onEssayAnswer = jest.fn();
    renderTaking([essayA, essayB], { onEssayAnswer });
    expect(screen.getAllByText('Anh A mở cửa hàng tạp hoá.')).toHaveLength(1);
    const boxes = screen.getAllByLabelText('Bài làm của em');
    expect(boxes).toHaveLength(2);
    fireEvent.change(boxes[1], { target: { value: 'Em sẽ đóng thuế' } });
    expect(onEssayAnswer).toHaveBeenCalledWith('eb', 'Em sẽ đóng thuế');
    expect(screen.getByText(/Tự luận · 2 điểm/)).toBeInTheDocument();
  });

  it('locked attempt disables the structured input', () => {
    const onSlotAnswer = jest.fn();
    renderTaking([fill], { onSlotAnswer, disableExamActions: true });
    fireEvent.click(screen.getByRole('button', { name: 'lượng cầu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chỗ trống 1: trống' }));
    expect(onSlotAnswer).not.toHaveBeenCalled();
  });
});
